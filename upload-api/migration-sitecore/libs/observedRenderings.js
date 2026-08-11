/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const read = require('fs-readdir-recursive');
const helper = require('../utils/helper');
const { isContentTemplate } = require('./observedReferences.js');
const { RENDERING_CONFIG } = require('../constants/index.js');

// Sitecore composes a page in three places: the item's own fields, the rendering
// *definitions* under /sitecore/layout/Renderings, and the `__renderings` layout XML on
// the page item that ties them together — which component sits in which placeholder, in
// what order, pointing at which datasource item.
//
// Contentstack has no equivalent of a rendering definition (that is code, not content),
// so composition becomes a Modular Blocks field on the page: one block per component,
// ordered, each referencing its datasource entry.
//
// The central decision here is what a block is keyed on. Keying on the *rendering*
// looks obvious and is wrong at scale: `generic content page` alone uses 219 distinct
// renderings, which is an unusable content type, and it bakes presentation identity
// ("HTMLContentControl") into a content model. Those 219 renderings resolve to only 29
// distinct *datasource templates*, and those templates are already migrated content
// types — so keying on the datasource template gives a schema an order of magnitude
// smaller whose blocks are content-shaped (`page_content`, `brand_promotion`) and whose
// field shape is already known.
//
// Rendering identity is not lost; it moves from schema to data, as `rendering_id` and
// `rendering_name` fields carried on every block.

const GUID_RE = /\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}/;
const RENDERING_TAG_RE = /<r\b([^>]*?)\/?>/g;
const ATTR_RE = /([a-zA-Z:]+)="([^"]*)"/g;
const DEVICE_TAG_RE = /<d\b([^>]*?)>/g;

// A folder holds no content of its own. Renderings routinely point at a folder and
// render its children (5 of the 6 components on the giftcards page do exactly this), so
// a folder datasource must be dereferenced or the page migrates empty.
const FOLDER_TEMPLATE_RE = /(^|\s)folder$/i;

const XML_ENTITIES = [
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&quot;', '"'],
  ['&apos;', "'"],
  ['&#39;', "'"],
  // Last: decoding `&amp;` first would re-create entities that were already decoded.
  ['&amp;', '&']
];

const unescapeXml = (value) => {
  if (!value || typeof value !== 'string') return '';
  let out = value;
  for (const [entity, char] of XML_ENTITIES) out = out.split(entity).join(char);
  return out;
};

const safeDecode = (value) => {
  const plussed = `${value ?? ''}`.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(plussed);
  } catch (err) {
    // Authored values are not guaranteed to be valid percent-encoding; a stray `%`
    // must not lose the placement.
    return plussed;
  }
};

/**
 * Parse a rendering parameters query string (`s:par`).
 *
 * Bare keys with no `=` are common (`CSSStyles`) and are kept with an empty value —
 * their presence is the signal.
 */
const parseRenderingParams = (raw) => {
  const params = {};
  const decoded = unescapeXml(`${raw ?? ''}`).trim();
  if (!decoded) return params;
  for (const pair of decoded.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const key = safeDecode(eq === -1 ? pair : pair.slice(0, eq)).trim();
    if (!key) continue;
    params[key] = safeDecode(eq === -1 ? '' : pair.slice(eq + 1)).trim();
  }
  return params;
};

const readAttributes = (raw) => {
  const attrs = {};
  ATTR_RE.lastIndex = 0;
  let m;
  while ((m = ATTR_RE.exec(raw)) !== null) attrs[m[1]] = unescapeXml(m[2]);
  return attrs;
};

// Only the first device is honoured. Every observed package uses exactly one; merging
// two would interleave independent layouts into a single component list.
const firstDeviceOnly = (xml) => {
  DEVICE_TAG_RE.lastIndex = 0;
  const first = DEVICE_TAG_RE.exec(xml);
  if (!first) return xml;
  const second = DEVICE_TAG_RE.exec(xml);
  return second ? xml.slice(first.index, second.index) : xml;
};

/**
 * Parse a `__renderings` field value into placements.
 *
 * The field holds escaped XML inside an XML document, so it arrives escaped twice.
 * Unescaping once leaves the payload looking like text and yields zero placements,
 * which is the quietest possible way to migrate every page with no components.
 *
 * Kept deliberately in the same shape as parseLayoutXml in
 * api/src/utils/renderings.utils.ts — the mapper decides which blocks exist and the
 * migration writes values into them, so the two must agree on what a placement is.
 */
const parseLayoutXml = (content) => {
  if (!content || typeof content !== 'string') return [];
  let xml = unescapeXml(content);
  if (xml.includes('&lt;') || xml.includes('&amp;')) xml = unescapeXml(xml);
  if (!xml.includes('<r')) return [];
  xml = firstDeviceOnly(xml);

  const placements = [];
  RENDERING_TAG_RE.lastIndex = 0;
  let match;
  while ((match = RENDERING_TAG_RE.exec(xml)) !== null) {
    const attrs = readAttributes(match[1]);
    // `<r uid="..."><p:d /></r>` nodes carry no `s:id`: they are personalization and
    // standard-values override stubs, not components. The real package holds 8,388 of
    // them, so admitting them would emit that many junk blocks.
    if (!attrs['s:id']) continue;
    placements.push({
      uid: attrs['uid'] ?? '',
      renderingId: attrs['s:id'],
      datasource: attrs['s:ds'] ?? '',
      placeholder: attrs['s:ph'] ?? '',
      params: parseRenderingParams(attrs['s:par'])
    });
  }
  return placements;
};

/**
 * Resolve a datasource GUID to the template id(s) whose content the component renders.
 *
 * Normally one template. For a folder datasource the folder itself holds nothing, so
 * its children's templates are returned instead — depth 1 only, since a folder of
 * folders carries no content either and recursing would drag in unrelated subtrees.
 */
const resolveDatasourceTemplates = ({ guid, itemIndex, childIndex }) => {
  const item = itemIndex?.[`${guid ?? ''}`.toUpperCase()];
  if (!item) return { templateIds: [], viaFolder: false, unresolved: true };

  const isFolder = FOLDER_TEMPLATE_RE.test(`${item.template ?? ''}`);
  if (!isFolder) {
    if (item.isMedia || !isContentTemplate(item.template)) {
      return { templateIds: [], viaFolder: false, unresolved: true };
    }
    return {
      templateIds: item.templateId ? [item.templateId] : [],
      viaFolder: false,
      unresolved: !item.templateId
    };
  }

  const templateIds = [];
  for (const childGuid of childIndex?.[`${guid}`.toUpperCase()] ?? []) {
    const child = itemIndex?.[childGuid];
    if (!child || child.isMedia || !isContentTemplate(child.template)) continue;
    if (child.templateId && !templateIds.includes(child.templateId)) {
      templateIds.push(child.templateId);
    }
  }
  return { templateIds, viaFolder: true, unresolved: templateIds.length === 0 };
};

/**
 * Walk the package once and record, per page template, what its layouts contain.
 *
 * Reuses the itemIndex/childIndex built by observePackage rather than re-reading 4,650
 * files. Returns observations keyed by lowercased template key, matching the convention
 * ExtractRef already uses (an entry's `template` attribute carries the key, while the
 * template item's name is title-cased).
 */
const observeRenderings = ({ sitecoreFolder, itemIndex, childIndex }) => {
  const renderingIndex = {};
  const observations = {};
  const contentRoot = path.join(sitecoreFolder, 'master', 'sitecore');

  let allPaths = [];
  try {
    allPaths = read(contentRoot) ?? [];
  } catch (err) {
    console.error('observeRenderings: unable to read package root', err);
    return { renderingIndex, observations };
  }
  const files = allPaths.filter((p) => p?.endsWith('data.json'));

  // Rendering definitions: their item name becomes the human-readable block/component
  // name. Far more useful in the Contentstack UI than a bare GUID.
  for (const file of files) {
    if (!file.includes('Renderings')) continue;
    const data = helper.readFile(path.join(contentRoot, file));
    const meta = data?.item?.$;
    if (!meta?.id) continue;
    renderingIndex[meta.id.toUpperCase()] = {
      name: meta.name ?? '',
      template: meta.template ?? ''
    };
  }

  for (const file of files) {
    const data = helper.readFile(path.join(contentRoot, file));
    const meta = data?.item?.$;
    if (!meta?.template) continue;

    const fields = data?.item?.fields?.field;
    const list = Array.isArray(fields) ? fields : fields ? [fields] : [];
    const layout = list.find((f) => f?.$?.key === '__renderings');
    if (!layout?.content) continue;

    const placements = parseLayoutXml(layout.content);
    if (!placements.length) continue;

    const key = `${meta.template}`.toLowerCase();
    if (!observations[key]) {
      observations[key] = {
        template: meta.template,
        pages: 0,
        placements: 0,
        byTemplate: {},
        renderings: {},
        placeholders: new Set(),
        noDatasource: 0,
        unresolved: 0
      };
    }
    const obs = observations[key];
    obs.pages += 1;

    for (const p of placements) {
      obs.placements += 1;
      if (p.placeholder) obs.placeholders.add(p.placeholder);

      const rid = `${p.renderingId}`.toUpperCase();
      if (!obs.renderings[rid]) {
        obs.renderings[rid] = {
          count: 0,
          name: renderingIndex[rid]?.name ?? ''
        };
      }
      obs.renderings[rid].count += 1;

      const guid = GUID_RE.exec(p.datasource ?? '')?.[0];
      if (!guid) {
        obs.noDatasource += 1;
        continue;
      }
      const resolved = resolveDatasourceTemplates({
        guid,
        itemIndex,
        childIndex
      });
      if (resolved.unresolved || !resolved.templateIds.length) {
        obs.unresolved += 1;
        continue;
      }
      for (const tid of resolved.templateIds) {
        if (!obs.byTemplate[tid]) {
          obs.byTemplate[tid] = { count: 0, pages: new Set(), viaFolder: false };
        }
        obs.byTemplate[tid].count += 1;
        obs.byTemplate[tid].pages.add(meta.id);
        if (resolved.viaFolder) obs.byTemplate[tid].viaFolder = true;
      }
    }
  }

  return { renderingIndex, observations };
};

/**
 * Choose which datasource templates earn a dedicated block.
 *
 * A template qualifies on both share of placements and spread across pages — a
 * template used 400 times on one page is a page-specific quirk, not a component worth
 * its own block. Everything below the cut, plus every placement with no datasource or
 * an unresolvable one, goes to the shared fallback block, so nothing is dropped.
 */
const selectBlocks = ({ observation, contentTypeKeys, options = {} }) => {
  const coverage = options.coverageThreshold ?? RENDERING_CONFIG.COVERAGE_THRESHOLD;
  const minPages = options.minPages ?? RENDERING_CONFIG.MIN_PAGES;
  const maxBlocks = options.maxBlocks ?? RENDERING_CONFIG.MAX_BLOCKS_PER_TEMPLATE;

  const total = observation?.placements || 0;
  const candidates = [];
  for (const [tid, stat] of Object.entries(observation?.byTemplate ?? {})) {
    const ctUid = contentTypeKeys?.[tid] ?? contentTypeKeys?.[tid?.toUpperCase?.()];
    // No migrated content type for this template — a reference to it would point at
    // nothing, so it belongs in the fallback.
    if (!ctUid) continue;
    const share = total ? stat.count / total : 0;
    if (share < coverage) continue;
    if (stat.pages.size < minPages) continue;
    candidates.push({
      templateId: tid,
      contentTypeUid: ctUid,
      count: stat.count,
      pages: stat.pages.size,
      viaFolder: stat.viaFolder
    });
  }

  candidates.sort((a, b) => b.count - a.count || a.contentTypeUid.localeCompare(b.contentTypeUid));
  const selected = candidates.slice(0, maxBlocks);

  // Block uids come from the content type uid, which is already normalised. Collisions
  // are still possible once suffixes are stripped, so they are resolved here where the
  // source names are known rather than in the schema builder.
  const seen = new Set();
  for (const block of selected) {
    let uid = block.contentTypeUid;
    let n = 2;
    while (seen.has(uid)) uid = `${block.contentTypeUid}_${n++}`;
    seen.add(uid);
    block.blockUid = uid;
  }

  return { selected, demoted: candidates.slice(maxBlocks) };
};

/**
 * Build the flat fieldMapping rows for the components field.
 *
 * The mapper represents modular blocks as a flat list with dotted uids
 * (`field.block.leaf`); buildSchemaTree assembles the nesting later. Mirrors
 * buildUnionBlockMapping in observedReferences.js, except `multiple` is true here —
 * this is an ordered, repeating component list, not a discriminated union.
 */
const buildRenderingBlockMapping = ({ selected, fieldUid, sitecoreKey }) => {
  const uid = fieldUid ?? RENDERING_CONFIG.COMPONENTS_FIELD_UID;
  const key = sitecoreKey ?? '__renderings';

  const rows = [
    {
      uid: key,
      otherCmsField: 'Components',
      otherCmsType: 'layout',
      contentstackField: 'Components',
      contentstackFieldUid: uid,
      // `modular_blocks`, not a bespoke type: buildSchemaTree/buildFieldSchema in
      // api/src/utils/content-type-creator.utils.ts match on this exact string to nest
      // `modular_blocks_child` rows and emit `data_type: "blocks"`. Anything else falls
      // through their default branch and becomes a plain text field, which is a schema
      // the entry values cannot be written into.
      contentstackFieldType: 'modular_blocks',
      backupFieldUid: uid,
      backupFieldType: 'modular_blocks',
      isDeleted: false,
      // An ordered, repeating list: order is the composition. (The union-block case in
      // observedReferences.js sets this false to model a discriminated union instead.)
      multiple: true,
      // Marks this blocks field as layout composition rather than a reference union, so
      // the entry side can find it without depending on its uid.
      isRenderingBlocks: true
    }
  ];

  const child = (blockUid, blockTitle) => ({
    uid: `${key}.${blockUid}`,
    otherCmsField: blockTitle,
    otherCmsType: 'block',
    contentstackField: blockTitle,
    contentstackFieldUid: `${uid}.${blockUid}`,
    contentstackFieldType: 'modular_blocks_child',
    backupFieldUid: `${uid}.${blockUid}`,
    backupFieldType: 'modular_blocks_child',
    isDeleted: false
  });

  const leaf = (blockUid, leafUid, type, extra = {}) => ({
    uid: `${key}.${blockUid}.${leafUid}`,
    otherCmsField: leafUid,
    otherCmsType: type,
    contentstackField: leafUid,
    contentstackFieldUid: `${uid}.${blockUid}.${leafUid}`,
    contentstackFieldType: type,
    backupFieldUid: `${uid}.${blockUid}.${leafUid}`,
    backupFieldType: type,
    isDeleted: false,
    ...extra
  });

  const commonLeaves = (blockUid) => [
    leaf(blockUid, 'placeholder', 'single_line_text'),
    leaf(blockUid, 'rendering_id', 'single_line_text'),
    leaf(blockUid, 'rendering_name', 'single_line_text'),
    // Params are 13 distinct keys across the whole package and 97.6% empty, with no
    // type information anywhere. One json field beats generating schema for them.
    leaf(blockUid, 'parameters', 'json')
  ];

  for (const block of selected ?? []) {
    rows.push(child(block.blockUid, block.contentTypeUid));
    rows.push(
      leaf(block.blockUid, 'datasource', 'reference', {
        refrenceTo: [block.contentTypeUid],
        // Usually one entry, but a folder datasource resolves to every child the
        // rendering could display — which child it picked lives in the .cshtml and is
        // not in the package — so the field has to hold a list.
        multiple: true
      })
    );
    rows.push(...commonLeaves(block.blockUid));
  }

  // The fallback carries everything without a dedicated block: below-threshold
  // templates, components with no datasource, and unresolvable datasources. It has no
  // reference field — there is no single content type it could point at — so the
  // Sitecore path is kept as text for post-migration triage.
  const fb = RENDERING_CONFIG.FALLBACK_BLOCK_UID;
  rows.push(child(fb, 'Component'));
  rows.push(leaf(fb, 'datasource_id', 'single_line_text'));
  rows.push(...commonLeaves(fb));

  return rows;
};

/** One log line per page template, in the style of describeResolution. */
const describeRenderingResolution = (observation, selection) => {
  const where = `page template "${observation.template}"`;
  const blocks = selection?.selected?.length ?? 0;
  const renderings = Object.keys(observation?.renderings ?? {}).length;
  const demoted = selection?.demoted?.length ?? 0;
  const tail =
    observation.noDatasource || observation.unresolved || demoted
      ? ` ${observation.noDatasource} placement(s) have no datasource, ${observation.unresolved} could not be resolved, and ${demoted} datasource template(s) fell below the threshold — all carried by the "${RENDERING_CONFIG.FALLBACK_BLOCK_UID}" block.`
      : '';
  return `Renderings on ${where}: ${observation.placements} placement(s) across ${observation.pages} page(s) using ${renderings} distinct rendering(s) resolved to ${blocks} component block(s) keyed by datasource template.${tail}`;
};

module.exports = {
  parseLayoutXml,
  parseRenderingParams,
  resolveDatasourceTemplates,
  observeRenderings,
  selectBlocks,
  buildRenderingBlockMapping,
  describeRenderingResolution,
  unescapeXml,
  FOLDER_TEMPLATE_RE
};
