/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const read = require('fs-readdir-recursive');
const helper = require('../utils/helper');
const { MIGRATION_DATA_CONFIG } = require('../constants/index.js');

// Sitecore reference fields declare their allowed targets in a `source` field on the
// template-field definition, and the schema builder reads only template definitions —
// it never sees entry values. That is why reference resolution used to regex GUIDs out
// of `source`. Most sources have no GUIDs to find: across a real package every
// QueryableTreelist source is a Sitecore query (`query:./ancestor-or-self::*[...]`),
// Droptree is mostly paths or empty, and even Treelist only carries GUIDs in a minority
// of definitions. So those fields ended up as references with an empty `refrenceTo` —
// present in the schema, pointing at nothing.
//
// This module resolves targets from the values entries actually hold instead. It runs
// from ExtractRef, which the pipeline invokes after extractEntries, so the extracted
// items are on disk by then.

const GUID_RE = /\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}/g;

// Sitecore field types that become Contentstack references.
const REFERENCE_TYPES = new Set([
  'droptree',
  'droplink',
  'multilist',
  'multilist with search',
  'treelist',
  'tree list',
  'treelistex',
  'queryabletreelist'
]);

// Sitecore templates that are engine machinery rather than content. Referencing these
// would drag templates, renderings and validation rules into the content graph.
const NON_CONTENT_TEMPLATES = new Set([
  'template',
  'branch',
  'template field',
  'template section',
  'settings',
  'validation rule',
  'base theme',
  'grid theme',
  'grid definition',
  'theme',
  'available renderings',
  'variants grouping',
  'datafolder',
  'command',
  'workflow',
  'workflow state',
  'device',
  'field type',
  'controller rendering',
  'view rendering',
  'xsl rendering',
  'webcontrol',
  // SXA / rendering-pipeline internals. These are configuration items that renderings
  // point at, not content an editor authors.
  'rendering contents resolver',
  'rendering parameters',
  'rendering variant',
  'placeholder settings',
  'sublayout',
  'submit action',
  'field type',
  'action type',
  'profile cards',
  'item buckets settings',
  'jss settings',
  'schedule'
]);

// A folder holds no content of its own; referencing one is almost never the intent.
const FOLDER_TEMPLATE_RE = /(^|\s)folder$/i;

const isReferenceType = (type) => REFERENCE_TYPES.has(`${type ?? ''}`.toLowerCase());

const isContentTemplate = (template) => {
  const t = `${template ?? ''}`.toLowerCase().trim();
  if (!t) return false;
  if (NON_CONTENT_TEMPLATES.has(t)) return false;
  if (FOLDER_TEMPLATE_RE.test(t)) return false;
  return true;
};

const extractGuids = (content) => {
  if (!content || typeof content !== 'string') return [];
  return content.match(GUID_RE) ?? [];
};

/**
 * Walk the extracted package once, building:
 *   itemIndex   GUID -> { template, templateId, isMedia }
 *   observations "<template>|<fieldKey>" -> observed reference facts
 *
 * Both come from the same pass so the package is only read once.
 */
const observePackage = ({ sitecoreFolder }) => {
  const itemIndex = {};
  const observations = {};
  const contentRoot = path.join(sitecoreFolder, 'master', 'sitecore');
  let allPaths = [];
  try {
    allPaths = read(contentRoot) ?? [];
  } catch (err) {
    console.error('observePackage: unable to read package root', err);
    return { itemIndex, observations };
  }

  const files = allPaths.filter((p) => p?.endsWith('data.json'));

  // Pass 1: index every item so a GUID can be resolved to its template.
  for (const file of files) {
    const data = helper.readFile(path.join(contentRoot, file));
    const meta = data?.item?.$;
    if (!meta?.id) continue;
    const existing = itemIndex[meta.id.toUpperCase()];
    // An item ships once per (language, version). Keep the highest version so tree attributes
    // describe the current state of the item rather than whichever file the walk saw last.
    const version = Number.parseInt(`${meta.version ?? 1}`, 10) || 1;
    if (existing && (existing.version ?? 1) > version) continue;
    itemIndex[meta.id.toUpperCase()] = {
      template: meta.template ?? '',
      templateId: meta.tid ?? '',
      // Tree attributes, used to rebuild the item hierarchy (see libs/navigation.js). Sitecore has
      // no children field, so `parentid` + `sortorder` are the only expression of structure — and
      // this index is the one full walk of the package, so carrying them here avoids a second.
      parentid: meta.parentid ?? '',
      sortorder: meta.sortorder,
      name: meta.name ?? '',
      language: meta.language ?? '',
      version,
      // Media items become assets, which a reference field cannot hold.
      isMedia: file.includes(`media library${path.sep}`) || file.includes('media library/')
    };
  }

  // Pass 2: fold every reference field value into its field's observation.
  for (const file of files) {
    const data = helper.readFile(path.join(contentRoot, file));
    const meta = data?.item?.$;
    if (!meta?.template) continue;
    const fields = data?.item?.fields?.field;
    const list = Array.isArray(fields) ? fields : fields ? [fields] : [];
    for (const field of list) {
      const key = field?.$?.key;
      const type = field?.$?.type;
      if (!key || key.startsWith('__') || !isReferenceType(type)) continue;
      // Lowercased so it matches the key ExtractRef builds from the content type's
      // `otherCmsUid` (the template key), independent of casing on either side.
      const mapKey = `${meta.template}|${key}`.toLowerCase();
      if (!observations[mapKey]) {
        observations[mapKey] = {
          template: meta.template,
          fieldKey: key,
          fieldType: type,
          values: 0,
          multiValues: 0,
          maxCardinality: 0,
          targets: {},
          assetTargets: 0,
          folderTargets: 0,
          unresolved: 0
        };
      }
      observeValue({
        observation: observations[mapKey],
        content: field?.content,
        itemIndex
      });
    }
  }

  return { itemIndex, observations };
};

const observeValue = ({ observation, content, itemIndex }) => {
  const guids = extractGuids(content);
  if (!guids.length) return;
  observation.values += 1;
  if (guids.length > 1) observation.multiValues += 1;
  if (guids.length > observation.maxCardinality) {
    observation.maxCardinality = guids.length;
  }
  for (const guid of guids) {
    const item = itemIndex[guid.toUpperCase()];
    if (!item) {
      observation.unresolved += 1;
      continue;
    }
    if (item.isMedia) {
      // An asset or a media folder. Counted separately so a field mixing assets with
      // entries is identifiable — it needs an asset or union field, not a reference.
      if (`${item.template}`.toLowerCase() === 'media folder') {
        observation.folderTargets += 1;
      } else {
        observation.assetTargets += 1;
      }
      continue;
    }
    if (!isContentTemplate(item.template)) {
      observation.unresolved += 1;
      continue;
    }
    // Store the template id; it is mapped to a content type uid later, once
    // contentTypeKey.json is available (it is keyed by template id, never by name).
    const tid = item.templateId;
    if (!tid) {
      observation.unresolved += 1;
      continue;
    }
    observation.targets[tid] = (observation.targets[tid] ?? 0) + 1;
  }
};

/**
 * Turn one observation into the field's reference configuration.
 *
 * `multiple` comes from observed cardinality rather than the Sitecore type name, which
 * matters in both directions: a QueryableTreelist whose every value holds one GUID
 * becomes a single reference, while a field where only a few values hold two still
 * needs an array or those values lose data.
 */
const resolveObservation = ({ observation, contentTypeKeys }) => {
  const referenceTo = [];
  for (const tid of Object.keys(observation?.targets ?? {})) {
    const uid = contentTypeKeys?.[tid] ?? contentTypeKeys?.[tid?.toUpperCase?.()];
    if (uid && !referenceTo.includes(uid)) referenceTo.push(uid);
  }
  referenceTo.sort();
  return {
    referenceTo,
    multiple: (observation?.multiValues ?? 0) > 0,
    // No resolvable target: emitting the field is what produced references pointing at
    // nothing, so the caller leaves it out instead.
    usable: referenceTo.length > 0
  };
};

// One log line per field, so a field that is dropped or narrower than expected is
// visible rather than silently absent.
const describeResolution = (observation, resolved) => {
  const where = `"${observation.fieldKey}" (${observation.fieldType}) on ${observation.template}`;
  if (!resolved.usable) {
    if (!observation.values) {
      return `Reference field ${where} was dropped: no entry populates it, so its target content type could not be determined.`;
    }
    const assets = observation.assetTargets || observation.folderTargets;
    const detail = assets
      ? ` ${observation.assetTargets} asset and ${observation.folderTargets} media-folder target(s) found — this field needs an asset or union field rather than a reference.`
      : '';
    return `Reference field ${where} was dropped: none of its ${observation.values} value(s) resolved to a migratable content type.${detail}`;
  }
  const card = resolved.multiple
    ? `multiple (max ${observation.maxCardinality} per value)`
    : 'single';
  const skipped = observation.unresolved
    ? ` ${observation.unresolved} target(s) skipped as unresolvable or non-content.`
    : '';
  const assets = observation.assetTargets
    ? ` ${observation.assetTargets} asset target(s) are not part of this reference.`
    : '';
  return `Reference field ${where} resolved to [${resolved.referenceTo.join(', ')}], ${card}, from ${observation.values} value(s).${skipped}${assets}`;
};

/**
 * True when a field's targets span more than one kind of thing (entry / asset / media
 * folder). A plain reference field can only hold entries, so a mixed field needs the
 * union block below — otherwise its asset and folder values are silently dropped.
 */
const needsUnionBlock = (observation) => {
  const kinds = observedKinds(observation);
  return kinds.length > 1;
};

// Which target kinds this field actually points at, in schema order.
const observedKinds = (observation) => {
  const kinds = [];
  if (Object.keys(observation?.targets ?? {}).length) kinds.push('entry');
  if (observation?.assetTargets) kinds.push('asset');
  if (observation?.folderTargets) kinds.push('folder');
  return kinds;
};

/**
 * Build the flat fieldMapping rows for a union block field.
 *
 * The mapper represents modular blocks as a flat list with dotted uids
 * (`field.block.leaf`); buildSchemaTree assembles the nesting later, so this returns
 * rows in that shape rather than a nested object.
 *
 * `multiple: false` on the parent makes this a discriminated union — exactly one block
 * is populated — rather than a repeating list. Every observed value holds a single GUID
 * and never mixes kinds, so there is nothing to repeat or order here.
 */
const buildUnionBlockMapping = ({ field, observation, referenceTo }) => {
  const fieldUid = field?.contentstackFieldUid;
  const sitecoreKey = field?.uid;
  const displayName = field?.contentstackField ?? field?.otherCmsField;
  const kinds = observedKinds(observation);

  const rows = [
    {
      ...field,
      contentstackFieldType: 'modular_blocks',
      backupFieldType: 'modular_blocks',
      // Single-select: a union of possible target kinds, not a repeating list.
      multiple: false,
      refrenceTo: undefined,
      sourceKey: undefined
    }
  ];

  const child = (blockUid, blockTitle) => ({
    uid: `${sitecoreKey}.${blockUid}`,
    otherCmsField: blockTitle,
    otherCmsType: 'block',
    contentstackField: blockTitle,
    contentstackFieldUid: `${fieldUid}.${blockUid}`,
    contentstackFieldType: 'modular_blocks_child',
    backupFieldUid: `${fieldUid}.${blockUid}`,
    backupFieldType: 'modular_blocks_child',
    isDeleted: false
  });

  const leaf = (blockUid, leafUid, type, extra = {}) => ({
    uid: `${sitecoreKey}.${blockUid}.${leafUid}`,
    otherCmsField: leafUid,
    otherCmsType: type,
    contentstackField: leafUid,
    contentstackFieldUid: `${fieldUid}.${blockUid}.${leafUid}`,
    contentstackFieldType: type,
    backupFieldUid: `${fieldUid}.${blockUid}.${leafUid}`,
    backupFieldType: type,
    isDeleted: false,
    ...extra
  });

  if (kinds.includes('entry') && referenceTo?.length) {
    rows.push(child('entry', 'Entry'));
    rows.push(leaf('entry', 'target', 'reference', { refrenceTo: referenceTo }));
  }
  if (kinds.includes('asset')) {
    rows.push(child('asset', 'Asset'));
    rows.push(leaf('asset', 'target', 'file'));
  }
  if (kinds.includes('folder')) {
    rows.push(child('folder', 'Media folder'));
    // A Contentstack file field cannot hold a folder, so the folder is carried as a
    // path plus the uid of the folder the asset pipeline created. `path` is kept
    // alongside `folder_uid` so a failed folder migration still records where the
    // reference pointed instead of leaving a dead uid.
    rows.push(leaf('folder', 'path', 'single_line_text'));
    rows.push(leaf('folder', 'folder_uid', 'single_line_text'));
  }

  return rows;
};

module.exports = {
  observePackage,
  observeValue,
  resolveObservation,
  describeResolution,
  isReferenceType,
  isContentTemplate,
  extractGuids,
  needsUnionBlock,
  observedKinds,
  buildUnionBlockMapping,
  REFERENCE_TYPES
};