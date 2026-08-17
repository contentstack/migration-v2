/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import fs, { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { MIGRATION_DATA_CONFIG, LOCALE_MAPPER } from "../constants/index.js";
import jsdom from "jsdom";
import { htmlToJson, jsonToHtml } from "@contentstack/json-rte-serializer";
import customLogger from "../utils/custom-logger.utils.js";
import { getLogMessage } from "../utils/index.js";
import { v4 as uuidv4 } from "uuid";
import { orgService } from "./org.service.js";
import * as cheerio from 'cheerio';
import { fetchPostData, hasMeaningfulHtmlContent, normalizeHtmlFragment, setupWordPressBlocks, stripHtmlTags } from "../utils/wordpressParseUtil.js";
import { getMimeTypeFromExtension } from "../utils/mimeTypes.js";
import { MEDIA_BLOCK_NAMES, WORDPRESS_MISSSING_BLOCKS  } from "../constants/index.js";

const { JSDOM } = jsdom;

/**
 * Prefix identifying Yoast SEO postmeta keys.
 */
const YOAST_SEO_KEY_PREFIX = "_yoast_wpseo_";

/**
 * Raw Yoast postmeta suffix → authored SEO global-field sub-field uid. The authored SEO global field
 * (config/seo-global-field.json, matching the naming convention of export-data/global-fields/review_seo.json)
 * names its fields meta_title/meta_description/yoast_wpseo_focuskeywords/… while the raw Yoast key
 * suffixes are title/metadesc/focuskeywords/…, so entry values must be re-keyed to the authored uids.
 * Contentstack drops entry keys that have no matching schema field on import, so an un-mapped key
 * silently loses its value.
 */
const YOAST_TO_SEO_FIELD_UID: Record<string, string> = {
  title: "meta_title",
  metadesc: "meta_description",
  focuskeywords: "yoast_wpseo_focuskeywords",
  keywordsynonyms: "yoast_wpseo_keywordsynonyms",
  canonical: "canonical_url",
  opengraph_image: "og_image",
  schema_page_type: "yoast_wpseo_schema_page_type",
  meta_robots_noindex: "no_index",
};

/**
 * Derive the SEO global-field sub-field uid from a Yoast postmeta key. The raw `_yoast_wpseo_`
 * suffix is normalized (`_yoast_wpseo_opengraph-image-id` → `opengraph_image_id`) and then re-keyed
 * to the authored SEO global-field uid via YOAST_TO_SEO_FIELD_UID so entry values and the global
 * field definition use identical sub-field uids. Returns '' for non-Yoast keys.
 */
const yoastSeoSubFieldUid = (metaKey: string | undefined): string => {
  if (!metaKey) return "";
  const normalized = metaKey.startsWith("_") ? metaKey : `_${metaKey}`;
  if (!normalized.startsWith(YOAST_SEO_KEY_PREFIX)) return "";
  const raw = normalized
    .slice(YOAST_SEO_KEY_PREFIX.length)
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return YOAST_TO_SEO_FIELD_UID[raw] ?? raw;
};

export interface PostTypeTarget {
  /** Contentstack content-type uid this WordPress post type is migrated into. */
  contentType: string;
  /** Optional discriminator value written to a `content_kind`-style field (the Article model uses this). */
  contentKind?: string;
}

/**
 * Single source of truth mapping WordPress post types → the Contentstack content type they migrate
 * into. It drives BOTH the entry routing (which content-type folder entries are written/merged to)
 * and the fixed-schema transform (which builder shapes the entry).
 *
 * Today `post` and `case_study` fold into the merged `article` model, distinguished by `content_kind`.
 * To onboard another post type in the same flow: (1) add a row here, (2) drop that content type's JSON
 * into the authored model folder (see resolveArticleModelDir), and (3) if it needs a bespoke body
 * transform, add its own builder and gate it in saveEntry — otherwise it falls back to the mapper path.
 */
export const POST_TYPE_TARGETS: Record<string, PostTypeTarget> = {
  post: { contentType: "article", contentKind: "blog" },
  case_study: { contentType: "case_studies", contentKind: "case_study" },
  videos: { contentType: "review_videos" },
  event: { contentType: "event_revised" },
  course: { contentType: "course" },
  page: { contentType: "generic_pages" },
  'external-links': { contentType: "external_link" },
};

/**
 * Contentstack uid of the merged Article content type — the one post type target that has a bespoke
 * body-section transform (buildArticleEntry). Must match the uid of the authored article.json in the
 * model folder.
 */
export const ARTICLE_TARGET_CT_UID = "article";

/**
 * ACF / custom-field values are stored in `wp:postmeta` keyed by the ACF field name. The engine fills
 * any Contentstack field (top-level scalar/boolean/number or group sub-field) whose uid MATCHES an ACF
 * field name automatically (e.g. `show_on_blog`, `is_featured`). Use this map only when the target
 * Contentstack uid differs from the WordPress meta key — `contentstackUid: 'wpMetaKey'`.
 * e.g. `key_takeaways: 'case_study_results'`. Term-ID and asset-URL fields (e.g. industry as
 * `_primary_term_industry`, customer_logo as `ImageURL`) need resolution and are intentionally omitted.
 */
/**
 * Target field uid → WordPress postmeta key, for cases where the Contentstack field name differs from
 * the WP meta_key. Global (applies to every target), so keep entries uid-specific enough not to collide
 * across content types. Event fields below are stored by the scaledagile theme as post-type-registered
 * postmeta (camelCase), NOT as ACF groups, so they never appear in the ACF export.
 */
export const ACF_FIELD_ALIASES: Record<string, string> = {
  start_date_time: 'eventStartDate',
  end_date_time: 'eventEndDate',
  timezone: 'eventTimeZone',
  location_name: 'eventLocation',
  course_level: 'level',
  // Case-study details group ← WordPress postmeta. `ImageID` is a pipe-separated list of the post's
  // attachment ids (featured first), resolved to a single asset by resolveAssetFromMetaValue.
  // NB: key_takeaways is deliberately NOT aliased to `case_study_results` — that ACF field is stale
  // template content cloned from an unrelated original post on ~24 entries (confirmed: the exact same
  // "Vantiv" text duplicated verbatim across France Travail, PlayStation Network, TomTom, etc., none of
  // which are actually about Vantiv). The real per-entry key-takeaways/quick-facts data only exists as
  // free-text "Key Takeaways:"/"Quick Facts:" headings in the body — see extractHeadingListSection.
  customer_name: 'page_header_title',
  customer_logo: 'ImageID',
  // external_link's summary ← the ACF `description` field (only external_link ever populates that key).
  summary: 'description',
  is_featured: 'eventFeatured'
};

/**
 * course.template_variant ← WP post id, per the "Components, Pages, and Post Types" content-inventory
 * doc's 4 layout groupings (Latest design / Outdated design / Micro-Credentials / AI-Native). There is no
 * WordPress field this maps from — it's purely a fixed list of the 30 known course post ids, keyed by
 * which of the 3 template variants that doc assigns each one to. "Outdated design template" entries also
 * get `safe_course` (the field's own description: "Adapted legacy pages use safe_course with fewer
 * sections" — same template, just fewer sections at render time, not a distinct variant).
 */
export const COURSE_TEMPLATE_VARIANT_BY_POST_ID: Record<string, string> = {
  // Latest design template
  '203900': 'safe_course', '203869': 'safe_course', '203363': 'safe_course', '203915': 'safe_course',
  '203388': 'safe_course', '203182': 'safe_course', '203399': 'safe_course', '203583': 'safe_course',
  '204099': 'safe_course', '203141': 'safe_course',
  // Outdated design template (same variant, fewer sections)
  '195572': 'safe_course', '201776': 'safe_course', '195849': 'safe_course', '195018': 'safe_course',
  '196090': 'safe_course', '196164': 'safe_course', '196193': 'safe_course', '196109': 'safe_course',
  '194374': 'safe_course', '201272': 'safe_course',
  // Micro-Credentials/Simple template
  '182670': 'micro_credential', '184241': 'micro_credential', '143560': 'micro_credential',
  '192720': 'micro_credential', '189648': 'micro_credential', '3671': 'micro_credential',
  '187272': 'micro_credential',
  // AI-Native template
  '201038': 'ai_native', '204316': 'ai_native', '199131': 'ai_native',
};

/** Returns the migration target for a WordPress post type, or undefined when it is not mapped. */
function targetForPostType(postType: string | undefined): PostTypeTarget | undefined {
  const key = String(postType ?? "").toLowerCase().trim();
  return Object.prototype.hasOwnProperty.call(POST_TYPE_TARGETS, key)
    ? POST_TYPE_TARGETS[key]
    : undefined;
}

/**
 * Per-item content-type overrides, loaded from `page-remap.json` in the content-model folder. WordPress
 * uses a single `page` post type for content that belongs in several Contentstack models (a Japanese
 * blog article, a customer case study, a course landing page …), so the post type alone can't decide
 * the target. The file maps a page SLUG to the content type it should migrate into; slugs it doesn't
 * list fall through to the post type's normal target. Keeping the list in data (not code) lets the
 * mapping be reviewed and edited without a code change.
 */
interface PageRemapDoc {
  postType?: string;
  defaultContentType?: string;
  rules?: Record<string, { contentType?: string; contentKind?: string; reason?: string }>;
}
const PAGE_REMAP_FILE = 'page-remap.json';
let pageRemapCache: { dir: string; doc: PageRemapDoc } | null = null;

/** Read (and memoize) the remap file for a model dir; returns an empty doc when absent/unparseable. */
function loadPageRemap(modelDir: string): PageRemapDoc {
  if (pageRemapCache && pageRemapCache.dir === modelDir) return pageRemapCache.doc;
  let doc: PageRemapDoc = {};
  try {
    const file = path.join(modelDir, PAGE_REMAP_FILE);
    if (existsSync(file)) doc = JSON.parse(fs.readFileSync(file, 'utf8')) as PageRemapDoc;
  } catch (err) {
    console.warn(`Could not read ${PAGE_REMAP_FILE}:`, err);
  }
  pageRemapCache = { dir: modelDir, doc };
  return doc;
}

/**
 * The migration target for a specific item: a slug override from page-remap.json when one applies to
 * this item's post type, else the post type's default target.
 */
function targetForItem(item: any, modelDir?: string): PostTypeTarget | undefined {
  const postType = String(item?.['wp:post_type'] ?? '').toLowerCase().trim();
  if (modelDir) {
    const doc = loadPageRemap(modelDir);
    const scoped = String(doc?.postType ?? 'page').toLowerCase();
    if (postType === scoped) {
      const slug = String(item?.['wp:post_name'] ?? '').trim();
      const rule = slug ? doc?.rules?.[slug] : undefined;
      if (rule?.contentType) {
        return { contentType: rule.contentType, contentKind: rule.contentKind };
      }
    }
  }
  return targetForPostType(postType);
}

// Get the current file's path
const __filename = fileURLToPath(import.meta.url);

// Get the current directory
const __dirname = path.dirname(__filename);

const { DATA, EXPORT_INFO_FILE } = MIGRATION_DATA_CONFIG

let assetsSave = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME
);

const entrySave = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME
);
let postFolderPath = path.join(
  entrySave,
  MIGRATION_DATA_CONFIG.POSTS_DIR_NAME,
  MIGRATION_DATA_CONFIG.POSTS_FOLDER_NAME
);

let authorsFolderPath = path.join(
  entrySave,
  MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME
);
let authorsFilePath = path.join(
  authorsFolderPath,
  MIGRATION_DATA_CONFIG.AUTHORS_FILE_NAME
);


const TaxonomiesSave = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.TAXONOMIES_DIR_NAME
);


let assetMasterFolderPath = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  "logs",
  MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME
);

interface Asset {
  "wp:post_type": string;
  [key: string]: any;
}


const idCorrector = (id: any) => {
  const newId = id?.replace(/[-{}]/g, (match: any) => match === '-' ? '' : '')
  if (newId) {
    return newId?.toLowerCase()
  } else {
    return id
  }
}

const normalizeNicenameForUid = (nicename: unknown) =>
  String(nicename ?? "").replace(/-/g, "_").replace(/\s+/g, "_");

/** Humanize a domain/nicename slug into a display name, e.g. "post_format" -> "Post Format". */
const humanizeSlug = (slug: unknown) =>
  String(slug ?? "")
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Nest a taxonomy's terms whose hierarchy is encoded in the term NAME with `>` (WordPress convention,
 * e.g. "Country>Australia", "Customer Story>Aviation"). For each such term, the text before the last
 * `>` is the parent and the text after is the leaf. The parent is resolved by matching an EXISTING
 * term's name (case/trim-insensitive) so the child's `parent_uid` points at the parent's real
 * nicename-derived uid (`country`), never a name-synthesized one; the child is leaf-renamed so
 * Contentstack shows "Australia" nested under "Country". A term whose parent doesn't exist is left
 * top-level (`parent_uid` stays null) rather than emitting a dangling parent_uid the CLI would reject.
 * Mutates the terms in place and returns them.
 */
export function nestHierarchicalTerms(
  terms: Array<{ uid: string; name: string; parent_uid: string | null }>,
): Array<{ uid: string; name: string; parent_uid: string | null }> {
  const uidByName = new Map<string, string>();
  for (const t of terms) {
    const key = String(t?.name ?? "").trim().toLowerCase();
    if (key && !uidByName.has(key)) uidByName.set(key, t.uid);
  }
  for (const t of terms) {
    const name = String(t?.name ?? "");
    if (!name.includes(">")) continue;
    const idx = name.lastIndexOf(">");
    const parentName = name.slice(0, idx).trim();
    const leaf = name.slice(idx + 1).trim();
    const parentUid = uidByName.get(parentName.toLowerCase());
    if (parentUid && parentUid !== t.uid) {
      t.parent_uid = parentUid;
      if (leaf) t.name = leaf;
    }
  }
  return terms;
}

let failedJSONFilePath = path.join(
  assetMasterFolderPath,
  MIGRATION_DATA_CONFIG.ASSETS_FAILED_FILE
);
const failedJSON: Record<string, any> = {};
let assetData: Record<string, any> | any = {};

// import { parse, serialize } from '@wordpress/blocks';
// import { registerCoreBlocks } from '@wordpress/block-library';


const getFieldName = (key: string   ) => {
  if(key?.includes('/')){
      return key?.split('/')?.[1];
  }
  else if(key?.includes('wp:')){
      const parts = key.split('_');  // e.g. ['wp', 'post', 'title']
      
      //let displayName : string = '';
      const displayName = parts
      .filter(item => !item.includes('wp:'))
      .join(' ');
      return displayName;
  }
  return key;
}

// Top-level bare inline elements (no block wrapper) that `htmlToJson` can't reliably place as a doc
// child — see the comment in RteJsonConverter below.
const INLINE_WRAP_TAGS = new Set([
  'A', 'STRONG', 'EM', 'SPAN', 'B', 'I', 'SMALL', 'SUB', 'SUP', 'U', 'MARK', 'CODE', 'ABBR', 'CITE', 'Q', 'TIME',
]);

const RteJsonConverter = (html: string) => {
  const cleanedHtml = html
    ?.replace(/<figure[^>]*>/g, "")
    ?.replace(/<\/figure>/g, "")
    // `htmlToJson` has no mapping for <figcaption> and silently DISCARDS the element together with its
    // text, losing every image caption ("Figure 1. …", "Example: …"). Re-tag it as a paragraph — the
    // closest supported node — so the caption survives as visible content beneath its image.
    ?.replace(/<figcaption[^>]*>/g, "<p>")
    ?.replace(/<\/figcaption>/g, "</p>");
  const dom = new JSDOM(cleanedHtml);
  const doc = dom.window.document;
  const htmlDoc = doc.querySelector("body");
  // `htmlToJson` only reliably converts a bare inline element (no <p>/<div> wrapper) when it's the very
  // first top-level node — any later bare inline sibling gets wrapped in an unsupported "fragment" node
  // Contentstack can't render ("file is corrupt and cannot be shown"). Real source: WordPress's
  // `salsa-blocks/badge` block's own markup is a raw `<a>...</a>` with no wrapper, so once its html is
  // concatenated after other prose it silently corrupts. Wrap every such child in a <p> so it always
  // converts to a normal, renderable node regardless of position.
  if (htmlDoc) {
    Array.from(htmlDoc.children).forEach((el: any) => {
      if (INLINE_WRAP_TAGS.has(el.tagName)) {
        const p = doc.createElement('p');
        el.replaceWith(p);
        p.appendChild(el);
      }
    });
  }
  return htmlToJson(htmlDoc);

}

const getLocale = (master_locale: string, project: any) => {
  for (const key of Object.keys(project?.master_locale || {})) {
    if (key === master_locale) {
      return key;
    }
  }
  //return project?.master_locale?.[master_locale] ? project.master_locale[master_locale] : master_locale;
}

function getLastUid(uid : string) {
  return uid?.split?.('.')?.[uid?.split?.('.')?.length - 1];
}

/** Align WP block slugs (`accordion_item`) with mapper (`accordion-item`). */
function normalizedWpSlug(raw: string | undefined): string {
  return (raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/_/g, "-");
}

/** Descendant fields may use Contentstack UIDs under the modular child, or legacy backup/wp paths when only some nested fields were remapped in CS. */
function fieldMappedUnderModularChild(modularChild: any, field: any): boolean {
  const childCsUid = modularChild?.contentstackFieldUid || '';
  const fUid = field?.contentstackFieldUid || '';
  if (childCsUid && fUid.startsWith(`${childCsUid}.`)) return true;
  const wpRoot = modularChild?.backupFieldUid || modularChild?.uid || '';
  if (!wpRoot) return false;
  const fieldWpKey = field?.backupFieldUid || field?.uid || '';
  return Boolean(fieldWpKey && fieldWpKey.startsWith(`${wpRoot}.`));
}

/** Only `advanced.multiple` reflects the Contentstack field for group/array payloads against CS validation. */
function fieldIsMultipleInContentstack(field: any): boolean {
  return field?.advanced?.multiple === true;
}

/**
 * Repeatable sibling leaves inside groups.
 * When the mapper has a Contentstack UID, cardinality must match Contentstack (`advanced.multiple` only);
 * `advanced.initial.multiple` is WP/list hints and must not force arrays for single CS fields.
 */
function fieldAllowsRepeatedLeaves(field: any): boolean {
  if (field?.contentstackFieldUid !== field?.backupFieldUid) {
    return fieldIsMultipleInContentstack(field);
  }
  return (
    fieldIsMultipleInContentstack(field) ||
    field?.advanced?.initial?.multiple === true
  );
}

function isDirectFieldOfModularBlock(modularChild: any, f: any): boolean {
  const mb = modularChild?.contentstackFieldUid || '';
  const fUid = f?.contentstackFieldUid || '';
  if (!mb || !fUid.startsWith(`${mb}.`)) return false;
  const rest = fUid?.slice(mb?.length + 1);
  return Boolean(rest && !rest?.includes('.'));
}

/**
 * Pull mb*-level sibling groups (group2, group3, …) off a nested group's output so they land on the modular row,
 * even when WP nested them inside group1 (e.g. core/details beside inner quote).
 */
function partitionModularDirectSiblings(
  processedGroup: Record<string, any>,
  modularChild: any | undefined,
  allFields: any[],
  currentGroupLastUid: string,
): { remainder: Record<string, any>; hoisted: Record<string, any> } {
  const remainder: Record<string, any> = {};
  const hoisted: Record<string, any> = {};
  if (!processedGroup || !Object.keys(processedGroup)?.length || !modularChild) {
    return { remainder: { ...processedGroup }, hoisted: {} };
  }
  const directSegs = new Set(
    allFields
      .filter((f: any) => isDirectFieldOfModularBlock(modularChild, f))
      .map((f: any) => getLastUid(f.contentstackFieldUid)),
  );
  for (const [seg, val] of Object.entries(processedGroup)) {
    if (directSegs?.has(seg) && seg !== currentGroupLastUid) {
      hoisted[seg] = val;
    } else {
      remainder[seg] = val;
    }
  }
  return { remainder, hoisted };
}

/** Direct CS children of a group, plus same-level children on backupFieldUid (mixed CS/legacy mappers). */
function getNestedFieldsForGroup(childField: any, modularChild: any | undefined, allFields: any[]): any[] {
  const groupFieldUid = childField?.contentstackFieldUid || '';
  const groupWpRoot = childField?.backupFieldUid || childField?.uid || '';
  const byCs =
    allFields?.filter((field: any) => {
      const fieldUid = field?.contentstackFieldUid || '';
      if (!fieldUid || !groupFieldUid) return false;
      if (!fieldUid.startsWith(`${groupFieldUid}.`)) return false;
      const remainder = fieldUid?.substring(groupFieldUid.length + 1);
      return Boolean(remainder && !remainder.includes('.'));
    }) || [];
  if (!groupWpRoot || !modularChild) {
    return byCs;
  }
  const byWp =
    allFields?.filter((field: any) => {
      const bk = field?.backupFieldUid || field?.uid || '';
      if (!bk.startsWith(`${groupWpRoot}.`)) return false;
      const rest = bk.slice(groupWpRoot.length + 1);
      if (!rest || rest.includes('.')) return false;
      return fieldMappedUnderModularChild(modularChild, field);
    }) || [];
  const seen = new Set(byCs.map((f: any) => f?.contentstackFieldUid || f?.id));
  const merged = [...byCs];
  for (const f of byWp) {
    const k = f?.contentstackFieldUid || f?.id;
    if (k != null && !seen.has(k)) {
      seen.add(k);
      merged.push(f);
    }
  }
  return merged;
}

/** Modular children by CS uid (`modular_blocks_2.mb1`) union backup/wp uid (`modular_blocks.paragraph_*`) when CS uids weren't all remapped. */
function getModularBlockChildrenForField(modularField: any, allFields: any[]): any[] {
  const parentCsUid = modularField?.contentstackFieldUid || '';
  const parentWpRoot = modularField?.backupFieldUid || modularField?.uid || '';
  const byCs =
    allFields?.filter((f: any) => {
      const fUid = f?.contentstackFieldUid || '';
      return (
        f?.contentstackFieldType === 'modular_blocks_child' &&
        !!parentCsUid &&
        fUid.startsWith(`${parentCsUid}.`) &&
        !fUid.substring(parentCsUid?.length + 1)?.includes('.')
      );
    }) || [];
  const byWp =
    parentWpRoot
      ? allFields?.filter((f: any) => {
          const bk = f?.backupFieldUid || f?.uid || '';
          return (
            f?.contentstackFieldType === 'modular_blocks_child' &&
            bk.startsWith(`${parentWpRoot}.`) &&
            !bk.slice(parentWpRoot.length + 1)?.includes('.')
          );
        }) || []
      : [];
  const seen = new Set(
    byCs.map((f: any) => `${f?.id ?? ''}:${f?.contentstackFieldUid ?? ''}`),
  );
  const merged = [...byCs];
  for (const f of byWp) {
    const k = `${f?.id ?? ''}:${f?.contentstackFieldUid ?? ''}`;
    if (!seen.has(k)) {
      seen.add(k);
      merged.push(f);
    }
  }
  return merged;
}


const resolvedBlockName = (block: any) => {
  // 1. If metadata name exists, use it first
  if (block?.attrs?.metadata?.name) {
    return block.attrs.metadata.name;
  }

  // 2. Handle missing/invalid WordPress blocks
  const isMissingBlock =
    block?.blockName === WORDPRESS_MISSSING_BLOCKS ||
    (block?.blockName === null &&
      block?.innerHTML !== ' ');
  if (isMissingBlock) {
    // fallback to originalName, otherwise use body
   
    return block?.attrs?.originalName ?? "paragraph";
  }

  // 3. Handle media-related blocks
  if (MEDIA_BLOCK_NAMES?.includes?.(block?.blockName)) {
    return "media";
  }

  // 4. Default fallback
  return block?.blockName;
};

/** WordPress core/group with one inner block is not an extra schema level (matches upload-api schemaMapper). */
function unwrapSingleChildGroup(block: any): any {
  let current = block;
  while (
    current?.blockName === 'core/group' &&
    Array.isArray(current?.innerBlocks) &&
    current.innerBlocks.length === 1
  ) {
    current = current.innerBlocks[0];
  }
  return current;
}

/**
 * Convert a WordPress date ("2026-05-07 19:40:17", usually GMT from *_gmt fields) to an ISO8601
 * string for Contentstack `isodate` fields. Returns undefined for missing/invalid values so the
 * caller can skip the field rather than write garbage.
 */
/**
 * Reduce a WordPress permalink to the site-relative path stored in an entry's `url` field: strip the
 * scheme + host (the site domain), keep the path onward (query/hash preserved). A value that is already
 * relative or unparseable is returned unchanged. e.g. `https://scaledagile.com/a/b?x=1` → `/a/b?x=1`.
 */
function toEntryUrlPath(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!s) return s;
  try {
    const u = new URL(s);
    return `${u.pathname}${u.search}${u.hash}` || '/';
  } catch {
    return s;
  }
}

function toIsoDate(value: any): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw || raw.startsWith('0000-00-00')) return undefined;
  // WP emits zone-less datetimes as "YYYY-MM-DD HH:mm:ss" (pubdate) or "YYYY-MM-DDTHH:mm:ss" (event
  // meta). With no zone, JS Date would parse them as server-local — making output depend on the host
  // timezone. Pin them to UTC so migration is deterministic; strings that already carry a Z/offset pass
  // through untouched.
  const naive = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  const normalized = naive ? `${naive[1]}T${naive[2]}Z` : raw;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

/**
 * core/columns and core/column are pure layout wrappers — the schema (upload-api schemaMapper)
 * flattens them away and bubbles their descendant content up. The entry walker must mirror that,
 * otherwise content buried under columns/column (e.g. headings, lists, paragraphs) is never matched
 * to its child fields and silently dropped. core/list is expanded to its core/list-item children so
 * each maps to a list_item field.
 *
 * core/cover and core/media-text also CONTAIN content (the schema emits a media file field plus the
 * inner blocks). When such a block is nested as an inner child, surface a synthetic image leaf for
 * its background media AND recurse into its inner content, so both the media and the inner
 * headings/paragraphs/lists are captured — matching schemaMapper's cover/media-text handling.
 * Named/leaf blocks pass through untouched so their existing handling still runs.
 */
function flattenLayoutWrappers(blocks: any[]): any[] {
  const out: any[] = [];
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const current = unwrapSingleChildGroup(block);
    const name = current?.blockName;
    if (name === 'core/columns' || name === 'core/column' || name === 'core/list') {
      out.push(...flattenLayoutWrappers(current?.innerBlocks || []));
    } else if (name === 'core/cover' || name === 'core/media-text') {
      const url = String(current?.attrs?.url ?? current?.attrs?.mediaUrl ?? '').trim();
      if (url) {
        out.push({
          blockName: 'core/image',
          attrs: { ...(current?.attrs || {}), url, src: url },
          innerHTML: current?.innerHTML,
          innerBlocks: []
        });
      }
      out.push(...flattenLayoutWrappers(current?.innerBlocks || []));
    } else {
      out.push(current);
    }
  }
  return out;
}

/**
 * Top-level mirror of the schema's flattenTopLevelLayout: unwrap layout-only wrappers that hold a
 * SINGLE child (core/columns, core/column, anonymous single-child core/group) so single-content
 * columns surface their real block. A MULTI-child column is kept intact so it stays a single
 * "column" modular child whose fields are populated during the inner descent — its contents are
 * not scattered to the root. Lists are not expanded here; named groups are preserved.
 */
function flattenTopLevelLayout(blocks: any[]): any[] {
  const out: any[] = [];
  for (const block of Array.isArray(blocks) ? blocks : []) {
    const name = block?.blockName;
    const innerCount = Array.isArray(block?.innerBlocks) ? block.innerBlocks.length : 0;
    const isSingleLayoutWrap =
      (name === 'core/columns' || name === 'core/column') && innerCount === 1;
    const isAnonSingleGroup =
      name === 'core/group' && !block?.attrs?.metadata?.name && innerCount === 1;
    if (isSingleLayoutWrap || isAnonSingleGroup) {
      out.push(...flattenTopLevelLayout(block?.innerBlocks || []));
    } else {
      out.push(block);
    }
  }
  return out;
}

/** core/cover puts the image in attrs — not in innerBlocks; schema maps it to a file field otherCmsField "media". */
function attachCoverBackgroundMediaToChildren(
  coverBlock: any,
  modularChild: any,
  fields: any[],
  assetData: any,
  out: Record<string, any>,
): void {
  const url = String(coverBlock?.attrs?.url ?? '').trim();
  if (coverBlock?.blockName !== 'core/cover' || !url || !modularChild) return;

  const mediaField = fields?.find(
    (f: any) =>
      f?.contentstackFieldType === 'file' &&
      fieldMappedUnderModularChild(modularChild, f) &&
      ((f?.otherCmsField || '')?.toLowerCase() === 'media' ||
        (f?.otherCmsType || '')?.toLowerCase() === 'media'),
  );
  if (!mediaField) return;

  const key = getLastUid(mediaField?.contentstackFieldUid);
  if (out[key] != null && out[key] !== '') return;

  const asset = formatChildByType(
    {
      blockName: 'core/image',
      attrs: { ...(coverBlock?.attrs || {}), url, src: url },
      innerHTML: coverBlock?.innerHTML,
      innerBlocks: [],
    },
    mediaField,
    assetData,
    fields,
  
);
  if (asset != null && asset !== '') out[key] = asset;
}

/** Populate one core/block's attrs.content labels into the modular child's matching fields. */
function populateCoreBlockContent(
  coreBlock: any,
  modularChild: any,
  fields: any[],
  assetData: any,
  out: Record<string, any>,
): void {
  const content = coreBlock?.attrs?.content;
  if (!content || typeof content !== 'object' || Array.isArray(content)) return;

  for (const [label, rawVal] of Object.entries(content)) {
    const field = fields?.find(
      (f: any) =>
        fieldMappedUnderModularChild(modularChild, f) && f?.otherCmsField === label,
    );
    if (!field) continue;
    const key = getLastUid(field?.contentstackFieldUid);
    if (out[key] != null && out[key] !== '') continue;

    const v: any = rawVal;
    const isObj = v && typeof v === 'object';
    const html = isObj ? (v.content ?? '') : String(v ?? '');
    const synthetic =
      field?.contentstackFieldType === 'link'
        ? { blockName: 'core/button', attrs: isObj ? v : {}, innerHTML: '', innerBlocks: [] }
        : { blockName: 'core/paragraph', attrs: {}, innerHTML: String(html), innerBlocks: [] };

    const value = formatChildByType(synthetic, field, assetData, fields, html);
    if (value != null && value !== '') out[key] = value;
  }
}

/**
 * core/block (reusable/synced block) has no innerBlocks — its content lives in attrs.content as
 * { "<label>": { content: "<html>" } | { url: "..." } }. schemaMapper emits one field per label
 * (matched by the raw label in otherCmsField). A core/block can sit at ANY depth under the matched
 * modular child (e.g. cover > columns > column > core/block), so walk the whole subtree and populate
 * every core/block found — keeping this generic across content shapes and files.
 */
function attachCoreBlockContentToChildren(
  blockNode: any,
  modularChild: any,
  fields: any[],
  assetData: any,
  out: Record<string, any>,
): void {
  if (!blockNode || typeof blockNode !== 'object' || !modularChild) return;
  const visit = (node: any): void => {
    if (!node || typeof node !== 'object') return;
    if (node.blockName === 'core/block') {
      populateCoreBlockContent(node, modularChild, fields, assetData, out);
    }
    if (Array.isArray(node.innerBlocks)) {
      for (const child of node.innerBlocks) visit(child);
    }
  };
  visit(blockNode);
}

function firstImgSrcFromInnerHtml(innerHtml?: string): string {
  if (!innerHtml || typeof innerHtml !== 'string') return '';
  try {
    const $ = cheerio.load(innerHtml);
    return String($('img')?.first()?.attr('src') || '')?.trim();
  } catch {
    return '';
  }
}

/** core/media-text keeps mediaId / mediaType in attrs and image URL in innerHTML (not innerBlocks). */
function attachMediaTextFieldsToChildren(
  mediaTextBlock: any,
  modularChild: any,
  fields: any[],
  assetData: any,
  out: Record<string, any>,
): void {
  if (mediaTextBlock?.blockName !== 'core/media-text' || !modularChild) return;

  const attrs = mediaTextBlock?.attrs || {};

  const mediaField = fields?.find(
    (f: any) =>
      f?.contentstackFieldType === 'file' &&
      fieldMappedUnderModularChild(modularChild, f) &&
      ((f?.otherCmsField || '').toLowerCase() === 'media' ||
        (f?.otherCmsType || '').toLowerCase() === 'media'),
  );

  const rawId = attrs?.mediaId ?? attrs?.media_id;
  const idNum = Number(rawId);
  const hasPositiveMediaId =
    rawId != null && rawId !== '' && !Number.isNaN(idNum) && idNum > 0;

  const urlFromAttrs = String(attrs?.url ?? attrs?.src ?? '')?.trim();
  const urlFromMarkup = firstImgSrcFromInnerHtml(mediaTextBlock?.innerHTML);
  const resolvedUrl = urlFromAttrs || urlFromMarkup;

  if (mediaField) {
    const key = getLastUid(mediaField?.contentstackFieldUid);
    const slotFree = out[key] == null || out[key] === '';
    const shouldAttach = slotFree && (hasPositiveMediaId || Boolean(resolvedUrl));
    if (shouldAttach) {
      const asset = formatChildByType(
        {
          blockName: 'core/image',
          attrs: {
            ...attrs,
            id: hasPositiveMediaId ? idNum : attrs?.id,
            url: resolvedUrl || urlFromAttrs,
            src: resolvedUrl || urlFromAttrs,
          },
          innerHTML: mediaTextBlock?.innerHTML,
          innerBlocks: [],
        },
        mediaField,
        assetData,
        fields,
      );
      if (asset != null && asset !== '') out[key] = asset;
    }
  }

  const mtRaw = attrs?.mediaType;
  const mt = typeof mtRaw === 'string' ? mtRaw.trim() : mtRaw != null ? String(mtRaw).trim() : '';
  if (!mt) return;

  const mediatypeField = fields?.find(
    (f: any) =>
      (f?.backupFieldType === 'single_line_text' ||
        f?.backupFieldType === 'text') &&
      fieldMappedUnderModularChild(modularChild, f) &&
      (f?.otherCmsField || '')?.toLowerCase() === 'mediatype',
  );
  if (!mediatypeField) return;

  const mtk = getLastUid(mediatypeField?.contentstackFieldUid);
  if (out[mtk] != null && out[mtk] !== '') return;

  const textValue = formatChildByType(
    { blockName: 'core/paragraph', attrs: {}, innerHTML: `<p>${mt}</p>`, innerBlocks: [] },
    mediatypeField,
    assetData,
  );
  if (textValue != null && textValue !== '') out[mtk] = textValue;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Article body-section router
 *
 * Converts a parsed Gutenberg block tree (from `content:encoded`) directly into the fixed
 * `body_sections` modular-block array of the merged "Article" content type — WITHOUT going through
 * the mapper-driven `createSchema`. It is used only for post types whose POST_TYPE_TARGETS entry maps to the Article content type, so
 * every other CMS content type keeps its existing inferred behavior untouched.
 *
 * Routing rules (see the approved router table):
 *   core/quote, core/pullquote            → quote        block
 *   core/video, core/embed                → video_embed  block
 *   core/button                           → cta_section  block
 *   core/spacer, core/separator           → dropped (pure spacing)
 *   everything else (paragraph, heading,  → accumulated into a single rich_text block; consecutive
 *   list, table, image, media-text, …)      rich blocks merge so we emit few clean sections, not one
 *                                            per paragraph. Content is never dropped — the default is
 *                                            always rich_text.
 * stats_band has no native WordPress block and therefore never appears unless the source grows one.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * A url-bearing `core/block` override entry (see coreBlockOverrideHtml/isCoreBlockImageText) is only
 * genuinely an IMAGE if its url actually points at an image file. Real example: ref 195618's "csbft:
 * button 1.1" entry — `{"url":".../SAI_SHWA_SAFeProfessionalCertification-8.5x11.7.pdf","linkTarget":
 * "_blank","rel":"..."}` — is a PDF download button, not an image, but has the exact same shape (a bare
 * `url`, no `.content`) as a real image override entry. Treating it as an image renders `<img src="....
 * pdf">`, which Contentstack's RTE can't display ("file is corrupt and cannot be shown"). Checking the
 * extension is the only reliable signal available — these override entries carry no `.text`/label
 * consistently enough to distinguish a button from an image any other way.
 */
function isImageUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /\.(png|jpe?g|gif|svg|webp|avif|bmp|tiff?|ico)(\?|#|$)/i.test(url.trim());
}

/**
 * core/block (a reusable/synced-pattern reference) has no innerBlocks/innerHTML of its own — a plain
 * `{"ref":N}` genuinely has no content available without the referenced wp_block post (not exported by
 * this WordPress site). But a synced block WITH per-instance overrides carries its actual text right in
 * `attrs.content` as `{"<label>": {content: "<html>"} | {url: "<src>"}}` — reconstruct that into real
 * HTML so the block isn't silently dropped when the content was there all along.
 */
function coreBlockOverrideHtml(block: any): string {
  const content = block?.attrs?.content;
  if (!content || typeof content !== 'object' || Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const raw of Object.values(content)) {
    if (!raw || typeof raw !== 'object') continue;
    const v: any = raw;
    if (typeof v.content === 'string' && v.content.trim()) parts.push(`<p>${v.content}</p>`);
    else if (typeof v.url === 'string' && v.url.trim()) {
      if (isImageUrl(v.url)) parts.push(`<img src="${v.url}" alt="" />`);
      // Not an image (e.g. a PDF download button) — render as a real link instead of a broken <img>.
      else parts.push(`<p><a href="${v.url}">${typeof v.text === 'string' && v.text.trim() ? v.text.trim() : v.url}</a></p>`);
    }
  }
  return parts.join('');
}

/** Reconstruct a block's full HTML by interleaving its innerContent string parts with its innerBlocks. */
function serializeBlockToHtml(block: any): string {
  if (!block) return '';
  if (block?.blockName === 'core/block') {
    const overrideHtml = coreBlockOverrideHtml(block);
    if (overrideHtml) return overrideHtml;
  }
  const inner = Array.isArray(block?.innerBlocks) ? block.innerBlocks : [];
  if (Array.isArray(block?.innerContent)) {
    let idx = 0;
    return block.innerContent
      .map((part: any) => (typeof part === 'string' ? part : serializeBlockToHtml(inner[idx++])))
      .join('');
  }
  if (typeof block?.innerHTML === 'string' && block.innerHTML.trim()) {
    return block.innerHTML;
  }
  return collectHtmlFromInnerBlocks(block);
}

/** Flatten layout-only wrappers (columns/column/group/buttons) so content blocks form a linear stream in document order. */
function* linearizeContentBlocks(
  blocks: any[],
  keepWhole?: (block: any) => boolean,
): Generator<any> {
  for (const raw of Array.isArray(blocks) ? blocks : []) {
    // Walk down single-child group wrappers, but stop and yield intact at any recognized pattern group
    // (FAQ / card-grid) so the caller can route it as a unit. A plain unwrap would collapse past the
    // card-grid group down to its `columns` child, stripping the metadata.patternName we key on.
    let block = raw;
    let kept = false;
    while (true) {
      if (keepWhole && keepWhole(block)) { yield block; kept = true; break; }
      if (
        block?.blockName === 'core/group' &&
        Array.isArray(block?.innerBlocks) &&
        block.innerBlocks.length === 1
      ) {
        block = block.innerBlocks[0];
      } else {
        break;
      }
    }
    if (kept) continue;
    const name = block?.blockName;
    // A cover that isn't kept whole is treated as a transparent wrapper, but its BACKGROUND lives in
    // the block's own attrs (`url`/`id`) and would be discarded with the wrapper. Yield it first as a
    // synthetic image block so it flows through the normal image handling (asset reference when the
    // file was downloaded, raw <img> in rich text otherwise) instead of being lost.
    if (name === 'core/cover') {
      const bgUrl = String(block?.attrs?.url ?? '').trim();
      const bgId = block?.attrs?.id;
      if (bgUrl || bgId) {
        yield {
          blockName: 'core/image',
          attrs: { id: bgId, url: bgUrl || undefined },
          innerBlocks: [],
          innerHTML: bgUrl ? `<img src="${bgUrl}" alt="" />` : '',
        };
      }
    }
    if (
      name === 'core/columns' ||
      name === 'core/column' ||
      name === 'core/group' ||
      name === 'core/cover' ||
      name === 'core/buttons' ||
      name === 'salsa-blocks/card' ||
      name === 'salsa-blocks/card-face' ||
      // Jetpack's layout-grid is a pure layout wrapper (like core/columns) — real content (heading,
      // paragraph, button) is frequently nested several levels deep inside grid > grid-column > group.
      // Without unwrapping these too, that content is invisible to every downstream shape detector
      // (e.g. a gutenslider slide's title/body/CTA all sit inside one), so it all collapses into one
      // opaque rich-text blob instead of being recognized block-by-block.
      name === 'jetpack/layout-grid' ||
      name === 'jetpack/layout-grid-column'
    ) {
      // Icon/caption cards (careers, partner-opportunities, safe-micro-credentials): a card is just a
      // decorative frame around an image + short caption, no repeating grid metadata to preserve. Unwrap
      // so the image flows through the normal core/image handling instead of being silently orphaned.
      yield* linearizeContentBlocks(block?.innerBlocks || [], keepWhole);
    } else {
      yield block;
    }
  }
}

/** core/quote & core/pullquote → { quote_text, attribution?, attribution_role? }; null when no text. */
function parseQuoteBlock(block: any): Record<string, any> | null {
  const $q = cheerio.load(serializeBlockToHtml(block));
  const attribution = $q('cite').first().text().replace(/\s+/g, ' ').trim();
  $q('cite').remove();
  const quoteText = $q.root().text().replace(/\s+/g, ' ').trim();
  if (!quoteText) return null;
  const quote: Record<string, any> = { quote_text: quoteText };
  if (attribution) quote.attribution = attribution;
  return quote;
}

/** core/video (src in markup) & core/embed (url in attrs) → { video_url, caption? }; null when no URL. */
function parseVideoBlock(block: any): Record<string, any> | null {
  const html = serializeBlockToHtml(block);
  let url = String(block?.attrs?.url ?? '').trim();

  // Vidyard embeds (salsa-blocks/vidyard-embed) carry only a `videoId` in attrs; the inline <img src>
  // is a `.jpg` thumbnail, not the video. Reconstruct the player URL from the id (also recoverable from
  // the img's data-uuid), and keep the thumbnail separately.
  let thumbnail = '';
  if (!url) {
    const videoId =
      String(block?.attrs?.videoId ?? '').trim() ||
      html.match(/data-uuid=["']([^"']+)["']/i)?.[1]?.trim() ||
      '';
    if (videoId) {
      url = `https://play.vidyard.com/${videoId}`;
      thumbnail = `https://play.vidyard.com/${videoId}.jpg`;
    }
  }

  if (!url) {
    const srcMatch = html.match(/src=["']([^"']+)["']/i);
    url = srcMatch?.[1]?.trim() ?? '';
  }
  if (!url) return null;
  const caption = cheerio.load(html)('figcaption').first().text().replace(/\s+/g, ' ').trim();
  const video: Record<string, any> = { video_url: url };
  if (caption) video.caption = caption;
  if (thumbnail) video.thumbnail = thumbnail;
  return video;
}

/** core/button → { heading, body }; heading is the button label (mandatory), body keeps the link. null when unlabeled. */
function parseCtaBlock(block: any): Record<string, any> | null {
  const $c = cheerio.load(serializeBlockToHtml(block));
  const anchor = $c('a').first();
  const label = anchor.text().replace(/\s+/g, ' ').trim();
  const href = String(anchor.attr('href') ?? '').trim();
  if (!label) return null;
  const cta: Record<string, any> = { heading: label };
  const bodyHtml = href ? `<p><a href="${href}">${label}</a></p>` : `<p>${label}</p>`;
  const body = RteJsonConverter(bodyHtml);
  if (body) cta.body = body;
  return cta;
}

/** Build the Article `body_sections` array from a parsed Gutenberg block tree. */
/**
 * Contentstack rejects any single JSON-RTE field value larger than 30KB ("content: JSON must not
 * exceed 30KB in size"). Because the router merges every consecutive rich block into ONE rich_text
 * section, a long body (e.g. multi-thousand-word case studies) can produce a single `content` value
 * far over the limit. Keep headroom below the hard 30720-byte cap for JSON string escaping.
 */
const MAX_RTE_FIELD_BYTES = 30000;

/** Heading level (1-6) when an HTML fragment begins with a heading element, else 0. */
function leadingHeadingLevel(html: string): number {
  const m = /^\s*<h([1-6])\b/i.exec(html || '');
  return m ? Number(m[1]) : 0;
}

/**
 * Pack accumulated per-block HTML fragments into one or more rich_text sections, keeping each emitted
 * value under MAX_RTE_FIELD_BYTES. Splits are HEADING-AWARE: blocks are first grouped into logical
 * sections (a heading plus every block beneath it, up to the next same-or-higher-level heading), and a
 * new field is started BEFORE a section that would overflow — so a field never ends on an orphaned
 * heading nor begins with heading-less prose. A single section larger than the cap is split internally
 * on block boundaries, with its heading kept on the first piece. Sizing sums each block's serialized
 * value — a slight over-estimate versus the merged value — so the concatenated result stays under the
 * cap. `toValue` renders a fragment (JSON RTE object or HTML string); `wrap` builds the section object.
 */
function packRichTextSections(
  blockHtmls: string[],
  toValue: (html: string) => any,
  wrap: (value: any) => any,
): any[] {
  const bytesOf = (html: string): number => {
    const value = toValue(html);
    return value ? Buffer.byteLength(JSON.stringify(value), 'utf8') : 0;
  };

  // 1) Group blocks into heading-led logical sections. A heading whose level is same-or-higher than the
  //    one that opened the current section starts a new section (deeper subheadings stay within it).
  //    Content before the first heading forms an initial heading-less section.
  const sections: string[][] = [];
  let current: string[] = [];
  let currentLevel = 0; // heading level that opened `current` (0 = pre-heading content)
  for (const bh of blockHtmls) {
    const level = leadingHeadingLevel(bh);
    if (level > 0 && current.length && (currentLevel === 0 || level <= currentLevel)) {
      sections.push(current);
      current = [];
      currentLevel = 0;
    }
    if (level > 0 && current.length === 0) currentLevel = level;
    current.push(bh);
  }
  if (current.length) sections.push(current);

  // 2) Pack whole sections into fields; flush before a section that would overflow so every field
  //    starts at a heading (or the document's leading content).
  const out: any[] = [];
  let chunk: string[] = [];
  let bytes = 0;
  const emit = (htmls: string[]) => {
    const html = htmls.join('');
    if (!hasMeaningfulHtmlContent(html)) return;
    const value = toValue(html);
    if (value) out.push(wrap(value));
  };
  const flush = () => {
    if (chunk.length) emit(chunk);
    chunk = [];
    bytes = 0;
  };

  for (const section of sections) {
    const secBytes = section.reduce((n, bh) => n + bytesOf(bh), 0);
    if (secBytes > MAX_RTE_FIELD_BYTES) {
      // Section too big to be one field: emit any pending chunk, then split this section on block
      // boundaries (its heading rides on the first piece).
      flush();
      let sub: string[] = [];
      let subBytes = 0;
      for (const bh of section) {
        const b = bytesOf(bh);
        if (sub.length && subBytes + b > MAX_RTE_FIELD_BYTES) { emit(sub); sub = []; subBytes = 0; }
        sub.push(bh);
        subBytes += b;
      }
      if (sub.length) emit(sub);
      continue;
    }
    if (chunk.length && bytes + secBytes > MAX_RTE_FIELD_BYTES) flush();
    chunk.push(...section);
    bytes += secBytes;
  }
  flush();
  return out;
}

export function buildBodySections(blocksJson: any[]): any[] {
  const sections: any[] = [];
  let buffer: string[] = [];

  const flushRichText = () => {
    if (buffer.length === 0) return;
    const blockHtmls = buffer;
    buffer = [];
    sections.push(
      ...packRichTextSections(blockHtmls, RteJsonConverter, (content) => ({ rich_text: { content } })),
    );
  };

  for (const block of linearizeContentBlocks(blocksJson)) {
    const name = block?.blockName;
    if (name === 'core/quote' || name === 'core/pullquote') {
      flushRichText();
      const quote = parseQuoteBlock(block);
      if (quote) sections.push({ quote });
      continue;
    }
    if (name === 'core/video' || name === 'core/embed') {
      flushRichText();
      const video = parseVideoBlock(block);
      if (video) sections.push({ video_embed: video });
      continue;
    }
    if (name === 'core/button') {
      flushRichText();
      const cta = parseCtaBlock(block);
      if (cta) sections.push({ cta_section: cta });
      continue;
    }
    if (name === 'core/spacer' || name === 'core/separator') {
      continue; // pure spacing — no content to carry
    }
    // Default: rich content. Accumulate so consecutive blocks merge into one rich_text section.
    const html = serializeBlockToHtml(block);
    if (html && html.trim()) buffer.push(html);
  }
  flushRichText();
  return sections;
}

/** Coerce a WXR guid (string or `{ '#text' | _ }` object) to a plain string. */
function guidToString(guid: any): string {
  if (guid == null) return '';
  if (typeof guid === 'string') return guid;
  return String(guid?.['#text'] ?? guid?._ ?? guid?.text ?? '');
}

/**
 * Build the base Article entry object (title, url, content_kind, body_sections, published_date,
 * migration_metadata) for one Article-targeted post. Shared extraction in saveEntry (excerpt,
 * featured_image, seo, taxonomies, authors) layers on top of this.
 */
export function buildArticleEntry(
  blocksJson: any[],
  item: any,
  kind: string,
  uid: string,
  link?: string,
): Record<string, any> {
  const permalink = String(link ?? item?.link ?? '').trim();
  const publishedIso = toIsoDate(item?.['wp:post_date_gmt'] ?? item?.['wp:post_date']);
  const entry: Record<string, any> = {
    title: item?.title,
    uid,
    url: permalink,
    content_kind: kind,
  };
  const bodySections = buildBodySections(blocksJson);
  if (bodySections.length > 0) entry.body_sections = bodySections;
  if (publishedIso) entry.published_date = publishedIso;

  const wpPostId = Number(item?.['wp:post_id']);
  const migrationMetadata: Record<string, any> = {
    wp_post_name: item?.['wp:post_name'] ?? '',
    wp_guid: guidToString(item?.guid),
    original_permalink: permalink,
  };
  if (!Number.isNaN(wpPostId)) migrationMetadata.wp_post_id = wpPostId;
  if (publishedIso) migrationMetadata.wp_published_at = publishedIso;
  entry.migration_metadata = migrationMetadata;

  return entry;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Generic schema-driven entry builder
 *
 * Reads the TARGET content type's authored schema and maps WordPress content into it, so any content
 * type (article, video, …) is handled by one engine — no per-type builder. Roles are detected by
 * field data_type + uid conventions; the body router emits only the modular blocks the target declares.
 * ──────────────────────────────────────────────────────────────────────────── */

/** WP Gutenberg block → semantic block uid the router understands. */
const WP_BLOCK_TO_SEMANTIC: Record<string, string> = {
  'core/paragraph': 'rich_text',
  'core/list': 'rich_text',
  'core/table': 'rich_text',
  'core/image': 'rich_text',
  'core/html': 'rich_text',
  'core/heading': 'heading',
  'core/quote': 'quote',
  'core/pullquote': 'quote',
  'core/video': 'video_embed',
  'core/embed': 'video_embed',
  'salsa-blocks/vidyard-embed': 'video_embed',
  'core/button': 'cta_section',
  'core/spacer': 'spacer',
  'core/separator': 'spacer',
};

/** Normalize a field's reference_to (string or array) to a string[]. */
function referenceTargets(field: any): string[] {
  const rt = field?.reference_to;
  return Array.isArray(rt) ? rt : rt ? [rt] : [];
}

/** Sub-field uids declared by a modular block definition. */
function blockSubUids(blockDef: any): Set<string> {
  return new Set((blockDef?.schema || []).map((f: any) => f?.uid));
}

/** Enum choice values for a sub-field uid within a block/field definition. */
function choiceValues(def: any, subUid: string): string[] {
  const f = (def?.schema || []).find((x: any) => x?.uid === subUid);
  return (f?.enum?.choices || []).map((c: any) => c?.value).filter(Boolean);
}

/** True when a field renders as a dropdown/enum. */
function isDropdownField(field: any): boolean {
  return field?.display_type === 'dropdown' || Array.isArray(field?.enum?.choices);
}

/**
 * Match a raw value against a dropdown's declared choices, returning the CANONICAL choice value (not the
 * raw input) or undefined when none matches. Comparison is normalized (trim, lowercase, spaces/hyphens →
 * underscore) so a WP label like "Foundational" maps to a choice value `foundational`. Returning
 * undefined on no match means an out-of-range value is skipped rather than written as an invalid enum.
 */
function matchDropdownChoice(field: any, raw: any): string | undefined {
  if (raw === undefined || raw === null || String(raw).trim() === '') return undefined;
  const norm = (s: any) => String(s).trim().toLowerCase().replace(/[\s-]+/g, '_');
  const target = norm(raw);
  for (const c of field?.enum?.choices || []) {
    if (c?.value != null && norm(c.value) === target) return c.value;
  }
  return undefined;
}

/** Locate a block's rich-text content sub-field + whether it wants JSON RTE (vs an HTML string). */
function richTextSlot(blockDef: any): { uid: string; json: boolean } | null {
  const sub = (blockDef?.schema || []).find(
    (f: any) =>
      (f?.data_type === 'json' && f?.field_metadata?.allow_json_rte) ||
      (f?.data_type === 'text' && (f?.field_metadata?.allow_rich_text || f?.field_metadata?.multiline)) ||
      f?.uid === 'content',
  );
  return sub ? { uid: sub.uid, json: sub.data_type === 'json' } : null;
}

/** Block uids the router already handles as their own semantic sections — never the rich-text fallback. */
const RESERVED_SEMANTIC_BLOCK_UIDS = new Set(['heading', 'quote', 'video_embed', 'cta_section', 'spacer']);

/**
 * Locate the block a target declares as its generic rich-text container — the one arbitrary prose folds
 * into. Prefers a block literally named `rich_text` (article/video convention); otherwise scores blocks
 * by role so a model that names it differently (e.g. event's `rich_text_section`) still works without a
 * mapping row. A container must own a real rich-text field (JSON RTE or advanced HTML — not a bare
 * multiline textarea) and carry no structural fields (file/link/reference/global_field/number/…), which
 * disqualifies composite blocks like hero_section or speaker that merely happen to include a text area.
 */
function findRichTextBlockDef(blocksField: any): any | null {
  const blocks = Array.isArray(blocksField?.blocks) ? blocksField.blocks : [];
  const exact = blocks.find((b: any) => b?.uid === 'rich_text');
  if (exact) return exact;

  let best: any = null;
  let bestScore = 0;
  for (const b of blocks) {
    const uid = String(b?.uid || '');
    if (!uid || RESERVED_SEMANTIC_BLOCK_UIDS.has(uid)) continue;
    const subs = Array.isArray(b?.schema) ? b.schema : [];
    const richField = subs.find(
      (f: any) =>
        (f?.data_type === 'json' && f?.field_metadata?.allow_json_rte) ||
        (f?.data_type === 'text' && f?.field_metadata?.allow_rich_text),
    );
    if (!richField) continue;
    const hasStructural = subs.some(
      (f: any) =>
        f !== richField &&
        ['file', 'link', 'reference', 'global_field', 'number', 'boolean', 'isodate'].includes(f?.data_type),
    );
    if (hasStructural) continue;
    let score = 10 - subs.length; // purer container (fewer extra fields) scores higher
    if (/rich|text|content|body|paragraph/i.test(uid)) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}

function providerFromUrl(url: string): string | undefined {
  const u = String(url || '').toLowerCase();
  if (!u) return undefined;
  if (u.includes('youtube') || u.includes('youtu.be')) return 'youtube';
  if (u.includes('vimeo')) return 'vimeo';
  return 'other';
}

/** Yoast SEO object + featured-image asset derived from an item's postmeta. */
/**
 * Sub-field uids the SEO global field actually declares, read from the in-memory content_mapper —
 * the SAME fieldMapping the Contentstack global-field schema is built from (see content-type-creator
 * convertToSchemaFormate). Entry SEO values are filtered to this set so a Yoast postmeta key with no
 * matching schema field is never written: Contentstack silently drops entry keys absent from the
 * referenced global field's schema, which would lose the value. Returns undefined when the SEO global
 * field or its mapping isn't present, so callers skip filtering and preserve prior behavior.
 */
/** A global field whose uid is `seo` or ends in `_seo` (e.g. `review_seo`) is the SEO global field. */
const isSeoUid = (uid: unknown): boolean => /(^|_)seo$/i.test(String(uid ?? ''));

function seoAllowedSubUids(contentTypes: any[]): Set<string> | undefined {
  const seoGf = Array.isArray(contentTypes)
    ? contentTypes.find(
        (c: any) =>
          c?.type === 'global_field' && (isSeoUid(c?.contentstackUid) || isSeoUid(c?.otherCmsUid)),
      )
    : undefined;
  const mapping = seoGf?.fieldMapping;
  if (!Array.isArray(mapping) || mapping.length === 0) return undefined;
  const uids = mapping
    .map((f: any) => f?.contentstackFieldUid ?? f?.uid)
    .filter((u: any): u is string => typeof u === 'string' && u.length > 0)
    // The content_mapper still carries the raw Yoast-derived uids (title, metadesc, …) from
    // config/seo-global-field.json, but the authored SEO global field that is actually imported
    // (article-model/seo) declares meta_title/meta_description/…. Re-key through the same table
    // yoastSeoSubFieldUid uses so this allow-set matches the schema entry values are written with.
    .map((u: string) => YOAST_TO_SEO_FIELD_UID[u] ?? u);
  return uids.length ? new Set(uids) : undefined;
}

/**
 * Yoast stores `_yoast_wpseo_keywordsynonyms` as a JSON array of phrase strings, with empty-string slots
 * for rows the author never filled in (e.g. `["AI, agile, ...", "", ""]`, or just `[""]`/`[]` when none
 * were entered at all). The SEO field is plain text, so this needs collapsing to a clean comma-separated
 * list — a raw copy of the JSON array (the previous behavior) produces literal `[""]`/`[" "]` noise, or
 * the whole JSON-array string jammed into the field when synonyms actually exist.
 */
function parseYoastKeywordSynonyms(raw: any): string {
  if (raw === undefined || raw === null) return '';
  let arr: any[];
  try {
    const parsed = JSON.parse(String(raw));
    arr = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return String(raw).trim();
  }
  return arr
    .map((v) => String(v ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * Yoast stores `_yoast_wpseo_focuskeywords` (the "additional keyphrases" list, distinct from the single
 * primary `_yoast_wpseo_focuskw`) as a JSON array of `{ keyword, score }` objects, e.g.
 * `[{"keyword":"agile","score":67},{"keyword":"SAFe","score":81}]`, or `[]`/`""` when none are set. The
 * SEO field is plain text, so this extracts just the `keyword` strings into a comma-separated list
 * instead of writing the raw JSON (or the literal `[]`) into the field.
 */
function parseYoastFocusKeywords(raw: any): string {
  if (raw === undefined || raw === null) return '';
  let arr: any[];
  try {
    const parsed = JSON.parse(String(raw));
    arr = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return String(raw).trim();
  }
  return arr
    .map((v) => String(v?.keyword ?? v ?? '').trim())
    .filter(Boolean)
    .join(', ');
}

function derivePostmeta(
  item: any,
  assetData: any,
  allowedSeoUids?: Set<string>,
): { seo: Record<string, any>; featuredAsset: any } {
  const seo: Record<string, any> = {};
  let thumbnailId: string | undefined;
  let ogImageId: string | undefined;
  const postmeta = Array.isArray(item?.['wp:postmeta']) ? item['wp:postmeta'] : [];
  for (const meta of postmeta) {
    const sub = yoastSeoSubFieldUid(meta?.['wp:meta_key']);
    // The Yoast OG-image ID (`_yoast_wpseo_opengraph-image-id`) is captured for asset resolution, not
    // stored as a value — the SEO global field's `og_image` is a FILE field, so it needs an asset ref.
    if (sub === 'opengraph_image_id') {
      if (meta?.['wp:meta_value']) ogImageId = String(meta['wp:meta_value']);
      continue;
    }
    if (sub && (!allowedSeoUids || allowedSeoUids.has(sub))) {
      const raw = meta?.['wp:meta_value'];
      // `no_index` is a boolean field on the SEO global field, but Yoast's postmeta value is always a
      // string ('1' when set) — store the real boolean Contentstack expects, not the raw string.
      if (sub === 'no_index') {
        seo[sub] = raw === '1' || raw === 1 || raw === true || String(raw).toLowerCase() === 'true';
      } else if (sub === 'yoast_wpseo_keywordsynonyms') {
        const joined = parseYoastKeywordSynonyms(raw);
        if (joined) seo[sub] = joined;
      } else if (sub === 'yoast_wpseo_focuskeywords') {
        const joined = parseYoastFocusKeywords(raw);
        if (joined) seo[sub] = joined;
      } else {
        seo[sub] = raw;
      }
    }
    if (meta?.['wp:meta_key'] === '_thumbnail_id' && meta?.['wp:meta_value']) {
      thumbnailId = String(meta['wp:meta_value']);
    }
  }
  // `og_image` is a FILE field: the Yoast postmeta gives a URL, but Contentstack needs an asset
  // reference. Resolve it to a downloaded asset — by the OG-image attachment id, else by URL match —
  // and drop it when no asset is available (a bare URL is an invalid file-field value on import).
  if (typeof seo.og_image === 'string' && seo.og_image.trim()) {
    const ogUrl = seo.og_image.trim();
    let asset = ogImageId ? assetData?.[`assets_${ogImageId}`] : undefined;
    if (!asset) {
      const key = assetBaseKey(ogUrl, '');
      asset = Object.values(assetData ?? {}).find(
        (a: any) => a?.url && assetBaseKey(a.url, '') === key,
      );
    }
    if (asset) seo.og_image = asset;
    else delete seo.og_image;
  }
  const featuredAsset = thumbnailId ? assetData?.[`assets_${thumbnailId}`] : undefined;
  return { seo, featuredAsset };
}

// --- Per-block builders (fill only the sub-fields the target block declares) -------------------

function buildHeadingSubBlock(def: any, block: any): Record<string, any> | null {
  const uids = blockSubUids(def);
  const text = cheerio.load(serializeBlockToHtml(block)).root().text().replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const out: Record<string, any> = {};
  if (uids.has('text')) out.text = text;
  if (uids.has('level')) {
    const lvlNum = Number(block?.attrs?.level ?? 2);
    let level = `h${Number.isNaN(lvlNum) ? 2 : lvlNum}`;
    const allowed = choiceValues(def, 'level');
    if (allowed.length && !allowed.includes(level)) level = allowed[0];
    out.level = level;
  }
  return Object.keys(out).length ? out : null;
}

function buildQuoteSubBlock(def: any, block: any): Record<string, any> | null {
  const parsed = parseQuoteBlock(block);
  if (!parsed) return null;
  const uids = blockSubUids(def);
  const out: Record<string, any> = {};
  if (uids.has('quote_text')) out.quote_text = parsed.quote_text;
  if (uids.has('attribution') && parsed.attribution) out.attribution = parsed.attribution;
  return Object.keys(out).length ? out : null;
}

function buildVideoEmbedSubBlock(def: any, block: any): Record<string, any> | null {
  const parsed = parseVideoBlock(block);
  if (!parsed) return null;
  const uids = blockSubUids(def);
  const out: Record<string, any> = {};
  if (uids.has('video_url')) out.video_url = parsed.video_url;
  if (uids.has('caption') && parsed.caption) out.caption = parsed.caption;
  if (uids.has('provider')) {
    const p = providerFromUrl(parsed.video_url);
    const allowed = choiceValues(def, 'provider');
    if (p && (!allowed.length || allowed.includes(p))) out.provider = p;
  }
  return Object.keys(out).length ? out : null;
}

function buildCtaSubBlock(def: any, block: any): Record<string, any> | null {
  const parsed = parseCtaBlock(block);
  if (!parsed) return null;
  const uids = blockSubUids(def);
  const out: Record<string, any> = {};
  if (uids.has('heading')) out.heading = parsed.heading;
  if (uids.has('body') && parsed.body) out.body = parsed.body;
  return Object.keys(out).length ? out : null;
}

function buildSpacerSubBlock(def: any, block: any): Record<string, any> {
  const subs: any[] = Array.isArray(def?.schema) ? def.schema : [];
  const h = parseInt(String(block?.attrs?.height ?? ''), 10); // WP stores e.g. "15px"
  const out: Record<string, any> = {};

  // Numeric height field (e.g. event's `height_px`): carry the raw pixel value.
  const numField = subs.find((f: any) => f?.data_type === 'number');
  if (numField && !Number.isNaN(h)) out[numField.uid] = h;

  // Size-bucket dropdown (e.g. video's `size`): map px → small/medium/large.
  const sizeField = subs.find((f: any) => f?.uid === 'size' || (f?.data_type === 'text' && isDropdownField(f)));
  if (sizeField) {
    let size = Number.isNaN(h) ? 'medium' : h <= 24 ? 'small' : h >= 64 ? 'large' : 'medium';
    const allowed = choiceValues(def, sizeField.uid);
    if (allowed.length && !allowed.includes(size)) size = allowed[0];
    out[sizeField.uid] = size;
  }
  return out;
}

/**
 * True when a block a target names `speaker` is actually speaker-shaped — it must declare a `name`
 * field plus at least one of `bio`/`headshot`. This is what scopes media-text→speaker routing: a
 * coincidentally-named block with a different shape (or any model without a real speaker block) never
 * triggers it, so blogs/case studies/videos keep folding media-text into rich_text.
 */
function isSpeakerBlock(def: any): boolean {
  if (!def) return false;
  const uids = blockSubUids(def);
  return uids.has('name') && (uids.has('bio') || uids.has('headshot'));
}

/**
 * Parse a core/media-text "speaker card" (event content) into speaker fields. In events these blocks
 * pair a headshot image with, in order: the speaker name, a "Role (Company)" line, then a bio
 * paragraph. Headshot resolves via the block's mediaId against the already-migrated assets (keyed
 * `assets_<attachmentId>`, same mechanism as featured images).
 */
function parseSpeakerBlock(
  block: any,
  assetData: any,
): { name?: string; title?: string; company?: string; bio?: string; headshot?: any } | null {
  const $ = cheerio.load(serializeBlockToHtml(block));
  const scoped = $('.wp-block-media-text__content p'); // content column only, excludes the media figure
  const paras = (scoped.length ? scoped : $('p')).toArray().map((el: any) => $(el));
  const textAt = (i: number) => (paras[i] ? paras[i].text().replace(/\s+/g, ' ').trim() : '');

  const name = textAt(0);
  const roleLine = textAt(1);
  let title: string | undefined;
  let company: string | undefined;
  const m = roleLine.match(/^(.*?)\s*\(([^)]*)\)\s*$/); // "Field CTO (Apptio)" → title / company
  if (m) {
    title = m[1].trim() || undefined;
    company = m[2].trim() || undefined;
  } else if (roleLine) {
    title = roleLine;
  }

  const bioHtml = paras.slice(2).map((p: any) => $.html(p)).join('');
  const bio = hasMeaningfulHtmlContent(bioHtml) ? normalizeHtmlFragment(bioHtml) : undefined;

  const rawId = block?.attrs?.mediaId ?? block?.attrs?.media_id;
  const idNum = Number(rawId);
  const headshot = !Number.isNaN(idNum) && idNum > 0 ? assetData?.[`assets_${idNum}`] : undefined;

  if (!name && !title && !bio && !headshot) return null;
  return { name: name || undefined, title, company, bio, headshot };
}

/** Map a parsed media-text speaker card onto the declared sub-fields of a `speaker` block. */
function buildSpeakerSubBlock(def: any, block: any, assetData: any): Record<string, any> | null {
  const parsed = parseSpeakerBlock(block, assetData);
  if (!parsed) return null;
  const uids = blockSubUids(def);
  const out: Record<string, any> = {};
  if (uids.has('name') && parsed.name) out.name = parsed.name;
  if (uids.has('title') && parsed.title) out.title = parsed.title;
  if (uids.has('company') && parsed.company) out.company = parsed.company;
  if (uids.has('bio') && parsed.bio) out.bio = parsed.bio;
  if (uids.has('headshot') && parsed.headshot) out.headshot = parsed.headshot;
  return Object.keys(out).length ? out : null;
}

/** True when a block declares a `global_field` sub-field that references the `cta` global field. */
function hasCtaGlobalField(def: any): boolean {
  return (def?.schema || []).some(
    (f: any) => f?.data_type === 'global_field' && referenceTargets(f).includes('cta'),
  );
}

/**
 * Resolve the block a target uses for a WP button/CTA, and how to fill it:
 *  - 'heading_body' — the article-style `cta_section` (heading + body rich text). Also the mode for any
 *    block that declares a `heading` field, so article's cta_section (which ALSO carries an optional
 *    primary_cta global field) keeps its existing behavior.
 *  - 'global_field' — a block whose CTA *is* a `cta` global field with no heading/body (event's `button`).
 * Prefers an exact `cta_section`; otherwise the first heading-less block that owns a cta global field.
 * Returns null when the target declares no CTA block, so buttons fold into rich_text as before.
 */
function findCtaBlockDef(blocksField: any): { def: any; mode: 'heading_body' | 'global_field' } | null {
  const blocks = Array.isArray(blocksField?.blocks) ? blocksField.blocks : [];
  const exact = blocks.find((b: any) => b?.uid === 'cta_section');
  if (exact) return { def: exact, mode: 'heading_body' };
  // A dedicated button/CTA block owns a cta global field and is NOT a composite section — it declares no
  // heading and no file/image field. That excludes blocks like hero_section/promo_tile that merely carry
  // an optional cta alongside their own imagery. Prefer a button/cta-named block, then the leanest one.
  const candidates = blocks
    .filter((b: any) => {
      if (!hasCtaGlobalField(b)) return false;
      const schema: any[] = b?.schema || [];
      if (schema.some((f: any) => f?.uid === 'heading' || f?.data_type === 'file')) return false;
      // A block that owns an identifying field of its OWN (a form id, a reference, or a second global
      // field such as an embedded quote) is a composite section that merely happens to carry a cta —
      // e.g. `marketo_form`. Routing plain buttons into it would fabricate form sections, so require a
      // block that is genuinely cta-shaped: named for it, or little more than the cta itself.
      if (schema.some((f: any) => f?.data_type === 'text' && /form.?id|form/i.test(f?.uid || ''))) return false;
      if (schema.some((f: any) => f?.data_type === 'reference')) return false;
      const gfCount = schema.filter((f: any) => f?.data_type === 'global_field').length;
      if (gfCount > 1) return false;
      return /button|cta/i.test(b?.uid || '') || schema.length <= 2;
    })
    .sort((a: any, b: any) => {
      const an = /button|cta/i.test(a?.uid || '') ? 0 : 1;
      const bn = /button|cta/i.test(b?.uid || '') ? 0 : 1;
      return an !== bn ? an - bn : (a?.schema?.length || 0) - (b?.schema?.length || 0);
    });
  if (candidates.length) return { def: candidates[0], mode: 'global_field' };
  return null;
}

/** Extract label / href / new-tab from a WP core/button anchor. */
function parseButtonAnchor(block: any): { label: string; href: string; newTab: boolean } | null {
  const $ = cheerio.load(serializeBlockToHtml(block));
  const a = $('a').first();
  const label = a.text().replace(/\s+/g, ' ').trim();
  if (!label) return null;
  const href = String(a.attr('href') ?? '').trim();
  const newTab = String(a.attr('target') ?? '').toLowerCase() === '_blank';
  return { label, href, newTab };
}

/**
 * Build a block whose CTA is a `cta` global field (event `button`). Fills the global-field sub-field
 * with the conventional cta shape (label / link / open_in_new_tab — same uids the cta global field
 * declares; CS drops any it doesn't) and sets the align dropdown to its declared default when present.
 */
function buildCtaGlobalFieldBlock(def: any, block: any): Record<string, any> | null {
  const parsed = parseButtonAnchor(block);
  if (!parsed) return null;
  const gfSub = (def?.schema || []).find(
    (f: any) => f?.data_type === 'global_field' && referenceTargets(f).includes('cta'),
  );
  if (!gfSub) return null;

  const cta: Record<string, any> = { label: parsed.label };
  if (parsed.href) cta.link = { title: parsed.label, href: parsed.href };
  if (parsed.newTab) cta.open_in_new_tab = true;

  const out: Record<string, any> = { [gfSub.uid]: cta };

  const alignField = (def?.schema || []).find((f: any) => f?.uid === 'align' || /align/i.test(f?.uid));
  if (alignField) {
    const choices = choiceValues(def, alignField.uid);
    const dflt = alignField?.field_metadata?.default_value;
    const align = typeof dflt === 'string' && choices.includes(dflt) ? dflt : choices[0];
    if (align) out[alignField.uid] = align;
  }
  return out;
}

/** Normalize a heading string for matching: lowercase, single-spaced, trimmed. */
function normalizeHeadingKey(s: string): string {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** A WP core/heading level (1-6), defaulting to 2 when unspecified. */
function wpHeadingLevel(block: any): number {
  const l = Number(block?.attrs?.level);
  return Number.isFinite(l) && l >= 1 && l <= 6 ? l : 2;
}

/**
 * Some page content (e.g. case study "Quick Facts:" / "Key Takeaways:") exists ONLY as a free-text
 * heading followed by a list/paragraph run in the body — never as its own ACF field. Find the first
 * heading matching `labelPattern` and capture everything after it up to the next heading of the same or
 * higher level, returning both the plain list-item text (for a text field) and the raw HTML (for a
 * json/rich-text field). Returns null when no matching heading is found.
 */
function extractHeadingListSection(
  blocks: any[],
  labelPattern: RegExp,
): { items: string[]; html: string; consumed: any[] } | null {
  const lin = Array.from(linearizeContentBlocks(blocks));
  for (let i = 0; i < lin.length; i++) {
    const b = lin[i];
    if (b?.blockName !== 'core/heading') continue;
    const text = stripHtmlTags(serializeBlockToHtml(b)).replace(/\s+/g, ' ').trim();
    if (!labelPattern.test(text)) continue;
    const level = wpHeadingLevel(b);
    const items: string[] = [];
    const htmlParts: string[] = [];
    // The heading itself plus every block folded into the field, so the body builder can skip them and
    // not render the same "Quick Facts:"/"Key Takeaways:" run a second time as ordinary prose.
    const consumed: any[] = [b];
    for (let j = i + 1; j < lin.length; j++) {
      const nb = lin[j];
      if (nb?.blockName === 'core/heading' && wpHeadingLevel(nb) <= level) break;
      if (nb?.blockName === 'core/list') {
        const html = serializeBlockToHtml(nb);
        cheerio.load(html)('li').each((_: number, li: any) => {
          const t = cheerio.load(li).text().replace(/\s+/g, ' ').trim();
          if (t) items.push(t);
        });
        htmlParts.push(html);
        consumed.push(nb);
      } else if (nb?.blockName === 'core/paragraph') {
        const html = serializeBlockToHtml(nb);
        const t = stripHtmlTags(html).replace(/\s+/g, ' ').trim();
        if (t) items.push(t);
        htmlParts.push(html);
        consumed.push(nb);
      }
    }
    if (items.length) return { items, html: htmlParts.join(''), consumed };
  }
  return null;
}

/**
 * Sub-fields whose real per-entry data only ever exists as a free-text heading section in the body (see
 * extractHeadingListSection) — matched by field-uid shape, not tied to one content type.
 */
const HEADING_SOURCED_FIELDS: Array<{ test: RegExp; label: RegExp }> = [
  { test: /^key.?takeaways?$/i, label: /key\s*takeaways?\s*:?/i },
  { test: /^quick.?facts?$/i, label: /quick\s*facts?\s*:?/i },
];

/**
 * A "named section" is a declared block that owns a `heading` text field with a non-empty
 * `default_value` PLUS a rich-text content slot (e.g. course `exam_details_section`: heading default
 * "Exam guidelines" + JSON-RTE `intro`). The default_value IS the trigger: when a WP heading matches it,
 * the following body content is routed into this block instead of folding into rich_text. Fully
 * schema-driven — nothing about the heading text or target field is hardcoded.
 */
function findNamedSections(
  blocksField: any,
): Array<{ blockUid: string; headingUid: string; headingKey: string; slot: { uid: string; json: boolean } }> {
  const out: Array<{ blockUid: string; headingUid: string; headingKey: string; slot: { uid: string; json: boolean } }> = [];
  for (const b of Array.isArray(blocksField?.blocks) ? blocksField.blocks : []) {
    const headingField = (b?.schema || []).find((f: any) => f?.uid === 'heading' && f?.data_type === 'text');
    const dflt = headingField?.field_metadata?.default_value;
    if (!headingField || !dflt || !String(dflt).trim()) continue;
    const slot = richTextSlot(b);
    if (!slot || slot.uid === headingField.uid) continue; // needs a content field distinct from the heading
    out.push({ blockUid: b.uid, headingUid: headingField.uid, headingKey: normalizeHeadingKey(dflt), slot });
  }
  return out;
}

/** The WP pattern/name label a group block carries (`metadata.patternName` or `metadata.name`). */
function groupPatternName(block: any): string {
  const md = block?.attrs?.metadata;
  return String(md?.patternName || md?.name || '').trim();
}

/**
 * FAQ section support. A declared block that references another content type (e.g. course
 * `faq_section` → `faq_item`) is the target; the referenced content type supplies the item shape
 * (question = a text field, answer = a JSON field). Fully schema-driven — detected by the reference,
 * not by uid. Returns null when the target declares no such block.
 */
function findFaqSectionDef(
  blocksField: any,
  contentTypesByUid?: Map<string, any>,
): { blockUid: string; headingUid?: string; refField: string; refCtUid: string; questionUid: string; answerUid: string; categoryUid?: string } | null {
  for (const b of Array.isArray(blocksField?.blocks) ? blocksField.blocks : []) {
    const refField = (b?.schema || []).find((f: any) => f?.data_type === 'reference' && referenceTargets(f).length);
    if (!refField) continue;
    const refCtUid = referenceTargets(refField)[0];
    const headingField = (b?.schema || []).find((f: any) => f?.data_type === 'text');
    const refCt = contentTypesByUid?.get(refCtUid);
    const refSchema: any[] = Array.isArray(refCt?.schema) ? refCt.schema : [];
    // question = a mandatory text field; answer = a JSON/rich-text field. BOTH must genuinely exist on
    // the referenced content type — that shape is what makes it an FAQ target, not merely "the first
    // block in this schema that happens to have a reference field". Without this check, a target with
    // no FAQ-shaped block at all (e.g. course/event_revised/generic_pages, none of which declare a
    // dedicated FAQ block) would silently match whichever reference block is declared first — hero, for
    // course — and real FAQ pattern-group content would get written into hero_section (only its `title`
    // exists there, so every answer was silently discarded too).
    const questionField = refSchema.find((f: any) => f?.data_type === 'text' && f?.mandatory) || refSchema.find((f: any) => f?.data_type === 'text');
    const answerField = refSchema.find((f: any) => f?.data_type === 'json');
    if (!questionField || !answerField) continue;
    const categoryField = refSchema.find((f: any) => f?.data_type === 'text' && /categor/i.test(f?.uid || ''));
    return {
      blockUid: b.uid,
      headingUid: headingField?.uid,
      refField: refField.uid,
      refCtUid,
      questionUid: questionField.uid,
      answerUid: answerField.uid,
      categoryUid: categoryField?.uid,
    };
  }
  return null;
}

/**
 * Card-grid section support. A declared block with a repeating `group` of cards (each card has a text
 * title plus an image and/or description) is the target (e.g. course `card_grid`). Detected by shape,
 * so any similarly-structured block qualifies. Returns null when none is declared.
 */
function findCardGridDef(
  blocksField: any,
): { blockUid: string; headingUid?: string; introUid?: string; columnsUid?: string; cardsUid: string; iconUid?: string; titleUid: string; descUid?: string; linkUid?: string } | null {
  let best: any = null;
  let bestScore = -1;
  for (const b of Array.isArray(blocksField?.blocks) ? blocksField.blocks : []) {
    // Skip a block that references another content type (that's the FAQ target, handled separately).
    if ((b?.schema || []).some((f: any) => f?.data_type === 'reference')) continue;
    const cardsField = (b?.schema || []).find((f: any) => f?.data_type === 'group' && f?.multiple);
    if (!cardsField) continue;
    const cardSchema: any[] = Array.isArray(cardsField?.schema) ? cardsField.schema : [];
    const titleField = cardSchema.find((f: any) => f?.data_type === 'text');
    const iconField = cardSchema.find((f: any) => f?.data_type === 'file');
    const descField = cardSchema.find((f: any) => f?.data_type === 'json');
    const linkField = cardSchema.find((f: any) => f?.data_type === 'link');
    // A card must have a title AND carry visual/content richness beyond a plain text triple — an icon
    // (file), a rich-text description (json), or a link. This distinguishes a card grid (icon+desc+link)
    // from a stats band (text-only value/label/description).
    if (!titleField || !(iconField || descField || linkField)) continue;
    const introField = (b?.schema || []).find((f: any) => f?.data_type === 'json');
    const headingField = (b?.schema || []).find((f: any) => f?.data_type === 'text' && /head/i.test(f?.uid || ''));
    const columnsField = (b?.schema || []).find((f: any) => f?.data_type === 'text' && /column/i.test(f?.uid || ''));
    // Prefer the richest card block: image + rich-text description + a section intro all point at a
    // true card grid over a leaner file-only list (e.g. resource_list).
    const score = (iconField ? 2 : 0) + (descField ? 2 : 0) + (linkField ? 1 : 0) + (introField ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = {
        blockUid: b.uid,
        headingUid: headingField?.uid,
        introUid: introField?.uid,
        columnsUid: columnsField?.uid,
        cardsUid: cardsField.uid,
        iconUid: iconField?.uid,
        titleUid: titleField.uid,
        descUid: descField?.uid,
        linkUid: linkField?.uid,
      };
    }
  }
  return best;
}

/**
 * Resource-list section support. A declared block with a repeating `group` whose items carry a plain
 * `link` field (not a `cta` global field, which is what a real card grid uses instead) — e.g. course's
 * `resource_list.resources` (resource_title/description/file/resource_link). The link field is the
 * distinguishing signal; `findCardGridDef` would otherwise also match this shape (see its own comment
 * about preferring the richer card block over "a leaner file-only list").
 */
function findResourceListDef(
  blocksField: any,
): { blockUid: string; headingUid?: string; resourcesUid: string; titleUid?: string; descUid?: string; linkUid: string; fileUid?: string } | null {
  for (const b of Array.isArray(blocksField?.blocks) ? blocksField.blocks : []) {
    if ((b?.schema || []).some((f: any) => f?.data_type === 'reference')) continue;
    const items = (b?.schema || []).find((f: any) => f?.data_type === 'group' && f?.multiple);
    if (!items) continue;
    const sub: any[] = Array.isArray(items?.schema) ? items.schema : [];
    const linkField = sub.find((f: any) => f?.data_type === 'link');
    if (!linkField) continue;
    const texts = sub.filter((f: any) => f?.data_type === 'text' && !f?.enum).map((f: any) => f.uid);
    const titleUid = texts.find((u: string) => /title/i.test(u)) ?? texts[0];
    const descUid = texts.find((u: string) => u !== titleUid && /desc/i.test(u)) ?? texts.find((u: string) => u !== titleUid);
    const headingField = (b?.schema || []).find((f: any) => f?.data_type === 'text' && !f?.enum);
    return {
      blockUid: b.uid,
      headingUid: headingField?.uid,
      resourcesUid: items.uid,
      titleUid,
      descUid,
      linkUid: linkField.uid,
      fileUid: sub.find((f: any) => f?.data_type === 'file')?.uid,
    };
  }
  return null;
}

/**
 * People-grid section support. A declared block with a repeating `group` of person cards — a photo plus
 * two or more plain-text fields (name, role/designation), no rich-text description or link like a real
 * card grid has — is the target (e.g. generic_pages `people_grid_block.details`). Detected by shape.
 */
function findPeopleGridDef(
  blocksField: any,
): { blockUid: string; titleUid?: string; introUid?: string; closingUid?: string; detailsUid: string; thumbnailUid?: string; nameUid: string; designationUid?: string; socialUid?: string } | null {
  for (const b of Array.isArray(blocksField?.blocks) ? blocksField.blocks : []) {
    if ((b?.schema || []).some((f: any) => f?.data_type === 'reference')) continue;
    const detailsField = (b?.schema || []).find((f: any) => f?.data_type === 'group' && f?.multiple);
    if (!detailsField) continue;
    const cardSchema: any[] = Array.isArray(detailsField?.schema) ? detailsField.schema : [];
    // A rich description or link means this is a plain card grid (see findCardGridDef), not a people
    // grid — a person card is just a photo and short name/role text.
    if (cardSchema.some((f: any) => f?.data_type === 'json' || f?.data_type === 'link')) continue;
    const thumbField = cardSchema.find((f: any) => f?.data_type === 'file');
    const textFields = cardSchema.filter((f: any) => f?.data_type === 'text');
    if (!thumbField || textFields.length < 2) continue;
    const nameField = textFields.find((f: any) => f?.field_metadata?.isTitle) || textFields[0];
    const roleField = textFields.find((f: any) => f.uid !== nameField.uid);
    const socialField = cardSchema.find((f: any) => f?.data_type === 'global_field');
    const topText = (b?.schema || []).filter((f: any) => f?.data_type === 'text');
    const titleField = topText.find((f: any) => /^title$/i.test(f?.uid || '')) || topText[0];
    const introField = topText.find((f: any) => f.uid !== titleField?.uid && /intro/i.test(f?.uid || ''));
    const closingField = topText.find((f: any) => /clos/i.test(f?.uid || ''));
    return {
      blockUid: b.uid,
      titleUid: titleField?.uid,
      introUid: introField?.uid,
      closingUid: closingField?.uid,
      detailsUid: detailsField.uid,
      thumbnailUid: thumbField.uid,
      nameUid: nameField.uid,
      designationUid: roleField?.uid,
      socialUid: socialField?.uid,
    };
  }
  return null;
}

/**
 * Split a paragraph block's text on internal `<br>` breaks into separate lines instead of collapsing
 * them into one run-on string (e.g. a name and affiliation authored as one `<p>Name<br>Company</p>` —
 * without this, stripping tags directly loses the line break and fuses them, "NameCompany").
 */
function paragraphTextLines(block: any): string[] {
  return serializeBlockToHtml(block)
    .split(/<br\s*\/?>/i)
    .map((h) => stripHtmlTags(h).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * Does `text` look like a short role/title/affiliation (e.g. "Chief Executive Officer", "VP, Framework")
 * rather than a full descriptive sentence (e.g. a benefit description or a news headline)? Word count
 * alone doesn't generalize to non-space-delimited scripts (Japanese/Chinese text collapses to a handful
 * of "words" regardless of actual length), so a long single "word" is judged by character length
 * instead. Either way, sentence-ending punctuation (including full-width CJK punctuation) disqualifies.
 */
function looksLikeRoleText(text: string): boolean {
  if (!text) return false;
  if (/[.!?。！？」』]$/.test(text)) return false;
  // Both checks apply together — word count alone isn't reliable for mixed-script text (a long CJK
  // sentence can still contain a few ASCII/Latin tokens with real spaces, e.g. product names or years,
  // so it wouldn't be caught by a word-count check alone).
  const words = text.split(/\s+/).filter(Boolean);
  return words.length <= 8 && text.length <= 40;
}

/**
 * A `core/columns` row is people-grid shaped when it has 2+ columns and every column, once flattened, is
 * just a photo plus EXACTLY TWO short text lines (name, then role) — no heading, list, embed or button.
 * The two lines may come from two separate paragraph blocks, or one paragraph with an internal `<br>`
 * (e.g. "Name<br>Company, Inc." authored as a single block) — both are genuine people-grid authoring
 * patterns. Two lines alone isn't enough, though: a benefits/icon grid (e.g. careers page — icon +
 * "Sabbatical" + "You will be eligible for a paid sabbatical of up to six consecutive weeks...") ALSO has
 * two text lines per column, but the second is a full descriptive SENTENCE, not a job title — so the
 * second line must additionally look role-shaped (see looksLikeRoleText).
 */
function isPeopleGridColumns(block: any): boolean {
  if (block?.blockName !== 'core/columns') return false;
  const columns = (block?.innerBlocks || []).filter((b: any) => b?.blockName === 'core/column');
  if (columns.length < 2) return false;
  return columns.every((col: any) => {
    const leaves = Array.from(linearizeContentBlocks(col?.innerBlocks || []));
    const meaningful = leaves.filter((b: any) => !['core/spacer', 'core/separator'].includes((b as any)?.blockName));
    const hasImage = meaningful.some((b: any) => (b as any)?.blockName === 'core/image');
    const paraBlocks = meaningful.filter((b: any) => (b as any)?.blockName === 'core/paragraph');
    if (!hasImage || !paraBlocks.length || paraBlocks.length + 1 !== meaningful.length) return false;
    const lines = paraBlocks.flatMap(paragraphTextLines);
    return lines.length === 2 && looksLikeRoleText(lines[1]);
  });
}

/** Parse a people-grid columns row into {thumbnailId, name, designation} per column. */
function parsePeopleGridCards(block: any): Array<{ thumbnailId?: number; name: string; designation: string }> {
  const columns = (block?.innerBlocks || []).filter((b: any) => b?.blockName === 'core/column');
  const cards: Array<{ thumbnailId?: number; name: string; designation: string }> = [];
  for (const col of columns) {
    let thumbnailId: number | undefined;
    const textParts: string[] = [];
    for (const lf of Array.from(linearizeContentBlocks(col?.innerBlocks || []))) {
      const nm = (lf as any)?.blockName;
      if (nm === 'core/image') {
        const id = Number((lf as any)?.attrs?.id);
        if (Number.isFinite(id) && id > 0) thumbnailId = id;
      } else if (nm === 'core/paragraph') {
        textParts.push(...paragraphTextLines(lf));
      }
    }
    const name = textParts[0] || '';
    const designation = textParts.slice(1).join(', ');
    if (name || designation || thumbnailId) cards.push({ thumbnailId, name, designation });
  }
  return cards;
}

/**
 * Parse an FAQ pattern group into {question, answerHtml} pairs: the group's children are a run of
 * heading (question) followed by the body blocks (answer) up to the next heading. The first heading is
 * the section title (returned separately) when it sits above the first Q/A pair.
 */
function parseFaqGroup(groupBlock: any): { sectionHeading: string; items: Array<{ question: string; answerHtml: string }> } {
  const children = (groupBlock?.innerBlocks || []).flatMap((b: any) => Array.from(linearizeContentBlocks([b])));
  const items: Array<{ question: string; answerHtml: string }> = [];
  let sectionHeading = '';
  let i = 0;
  // A leading top-level heading (e.g. h2 "Frequently Asked Questions") that is followed by another
  // heading is the section title, not a question.
  if (children[0]?.blockName === 'core/heading' && children[1]?.blockName === 'core/heading') {
    sectionHeading = stripHtmlTags(serializeBlockToHtml(children[0])).replace(/\s+/g, ' ').trim();
    i = 1;
  }
  for (; i < children.length; i++) {
    if (children[i]?.blockName !== 'core/heading') continue;
    const question = stripHtmlTags(serializeBlockToHtml(children[i])).replace(/\s+/g, ' ').trim();
    if (!question) continue;
    const parts: string[] = [];
    let j = i + 1;
    for (; j < children.length && children[j]?.blockName !== 'core/heading'; j++) {
      const h = serializeBlockToHtml(children[j]);
      if (h && h.trim()) parts.push(h);
    }
    i = j - 1;
    items.push({ question, answerHtml: parts.join('') });
  }
  return { sectionHeading, items };
}

/** Parse a card-grid pattern group into card records (icon image id, title, description html, link). */
function parseCardGridGroup(groupBlock: any): Array<{ iconId?: number; title: string; descHtml: string; link?: { title: string; href: string } }> {
  const cards: Array<{ iconId?: number; title: string; descHtml: string; link?: { title: string; href: string } }> = [];
  // Each card is a column. Walk columns; within a column pull the first image (icon), first heading
  // (title), paragraph(s) (description) and first button/link.
  const columns: any[] = [];
  const collectColumns = (blocks: any[]) => {
    for (const raw of Array.isArray(blocks) ? blocks : []) {
      const b = unwrapSingleChildGroup(raw);
      if (b?.blockName === 'core/column') columns.push(b);
      else collectColumns(b?.innerBlocks || []);
    }
  };
  collectColumns(groupBlock?.innerBlocks || []);
  for (const col of columns) {
    const inner = Array.from(linearizeContentBlocks([col]));
    let iconId: number | undefined;
    let title = '';
    const descParts: string[] = [];
    let link: { title: string; href: string } | undefined;
    for (const blk of inner) {
      const nm = blk?.blockName;
      if (nm === 'core/image' && iconId === undefined) {
        const id = Number(blk?.attrs?.id);
        if (Number.isFinite(id) && id > 0) iconId = id;
      } else if (nm === 'core/heading' && !title) {
        title = stripHtmlTags(serializeBlockToHtml(blk)).replace(/\s+/g, ' ').trim();
      } else if (nm === 'core/button' && !link) {
        const a = parseButtonAnchor(blk);
        if (a?.href) link = { title: a.label || a.href, href: a.href };
      } else if (nm === 'core/paragraph' || nm === 'core/list') {
        const h = serializeBlockToHtml(blk);
        if (h && h.trim()) descParts.push(h);
      }
    }
    if (title || descParts.length) cards.push({ iconId, title, descHtml: descParts.join(''), link });
  }
  return cards;
}

// --- Reference-section (generic_pages) support ------------------------------------------------
// Some content types model their body as an ordered list of REFERENCES to standalone "section"
// content types (e.g. generic_pages.page_sections → hero_section / cards_section / flexible_layouts).
// There is no direct rich-text block to fold prose into, so the router must instead create a side
// entry in the referenced section type and reference it. Everything below is shape-driven (data_type
// + field role), never keyed to a content-type or field uid, so it works for any similarly-shaped
// model without a mapping table.

interface RefSectionDef { blockUid: string; refField: string; refCtUid: string; refCt: any; }

/**
 * Detect the reference-wrapping blocks of a `blocks` field: each block whose schema owns a reference
 * field points at a section content type migrated as its own side entry. Returns one def per such
 * block, in declared order.
 */
function findReferenceSectionDefs(blocksField: any, ctByUid?: Map<string, any>): RefSectionDef[] {
  const out: RefSectionDef[] = [];
  for (const b of Array.isArray(blocksField?.blocks) ? blocksField.blocks : []) {
    const refField = (b?.schema || []).find(
      (f: any) => f?.data_type === 'reference' && referenceTargets(f).length,
    );
    if (!refField) continue;
    const refCtUid = referenceTargets(refField)[0];
    out.push({ blockUid: b.uid, refField: refField.uid, refCtUid, refCt: ctByUid?.get(refCtUid) });
  }
  return out;
}

/** The first modular-blocks field a content type declares — its variant list (e.g. `variants`). */
function variantsBlocksField(ct: any): any | null {
  return (Array.isArray(ct?.schema) ? ct.schema : []).find((f: any) => f?.data_type === 'blocks') || null;
}

const firstFieldOfType = (schema: any[], dt: string): any =>
  (Array.isArray(schema) ? schema : []).find((f: any) => f?.data_type === dt);
const jsonSubUid = (schema: any[]): string | undefined => firstFieldOfType(schema, 'json')?.uid;
const fileSubUid = (schema: any[]): string | undefined => firstFieldOfType(schema, 'file')?.uid;
const urlTextSubUid = (schema: any[]): string | undefined =>
  (Array.isArray(schema) ? schema : []).find(
    (f: any) => f?.data_type === 'text' && /embed|url|video|link/i.test(f?.uid || ''),
  )?.uid;

type VariantRole = 'prose' | 'image' | 'video' | 'quote' | 'cta';

/**
 * Choose the variant block best suited to a role, scored purely by field shape:
 *  - prose  → a json (rich-text) field and no file field (e.g. text_cta)
 *  - image  → a file field, richer when it also has a json/text caption (e.g. text_image)
 *  - video  → a url-ish text field, richer when it also has a file thumbnail (e.g. text_video)
 *  - quote  → a global-field (the quotes GF), richer when it also has a json body (e.g. text_quote)
 * Returns null when the variants field declares nothing suitable.
 */
function pickVariantByRole(variantsField: any, role: VariantRole, exclude?: Set<string>): any | null {
  const blocks = Array.isArray(variantsField?.blocks) ? variantsField.blocks : [];
  const has = (schema: any[], dt: string) => (schema || []).some((f: any) => f?.data_type === dt);
  let best: any = null;
  let bestScore = -1;
  for (const b of blocks) {
    if (exclude?.has(b?.uid)) continue;
    const schema: any[] = Array.isArray(b?.schema) ? b.schema : [];
    let score = -1;
    if (role === 'prose') {
      // A purpose-built variant (quote/video/image/table…) must never be the generic prose sink, even
      // though several of them also own a json field.
      if (/quote|video|image|graphic|table|grid|card/i.test(String(b?.uid ?? ''))) continue;
      // Prefer the LEANEST rich-text container: a dedicated `rich_text` variant (content only) is a
      // better home for arbitrary prose than a composite block that merely includes a json field.
      if (has(schema, 'json') && !has(schema, 'file')) score = 100 - schema.length;
      else if (has(schema, 'json')) score = 50 - schema.length;
    } else if (role === 'image') {
      if (has(schema, 'file') && has(schema, 'json')) score = 3;
      else if (has(schema, 'file') && has(schema, 'text')) score = 2;
      else if (has(schema, 'file')) score = 1;
    } else if (role === 'video') {
      if (urlTextSubUid(schema)) score = has(schema, 'file') ? 3 : 2;
    } else if (role === 'quote') {
      // Prefer a variant that is genuinely about quotes — one whose global field POINTS AT a quotes
      // global field, then one merely named for quotes. Otherwise a generic block that happens to own
      // a global field + json (e.g. an eyebrow/cta text block) would win the role.
      const pointsAtQuotes = schema.some(
        (f: any) => f?.data_type === 'global_field' && referenceTargets(f).some((t: string) => /quote/i.test(t)),
      );
      const namedQuote = /quote/i.test(String(b?.uid ?? ''));
      if (pointsAtQuotes) score = 5;
      else if (namedQuote) score = 4;
      else if (has(schema, 'global_field') && has(schema, 'json') && !has(schema, 'file')) score = 2;
      else if (has(schema, 'global_field')) score = 1;
    } else if (role === 'cta') {
      // A standalone button/buttons block with nowhere more specific to go (no cover, no declared
      // top-level CTA block) — prefer a variant whose global field points at the cta global field
      // itself, then one merely named for CTAs.
      const pointsAtCta = schema.some(
        (f: any) => f?.data_type === 'global_field' && referenceTargets(f).some((t: string) => /^cta$/i.test(t)),
      );
      const namedCta = /cta/i.test(String(b?.uid ?? ''));
      if (pointsAtCta) score = 5;
      else if (namedCta) score = 4;
    }
    if (score > bestScore) { bestScore = score; best = b; }
  }
  return best;
}

/** Get (creating if needed) the side-entry bucket for a content type. */
function sideStoreFor(ctx: any, ctUid: string): Record<string, any> | undefined {
  if (!ctx?.sideEntries) return undefined;
  return ctx.sideEntries[ctUid] ?? (ctx.sideEntries[ctUid] = {});
}

/**
 * Disambiguates a title against every other title already assigned within the same content type this
 * run (main entries and generated section side entries share one registry per ctUid). WordPress export
 * titles are not globally unique — distinct posts can legitimately share a title — but every content
 * type here declares `title: unique`, so the first repeat gets ` (2)`, the next ` (3)`, etc.
 */
function dedupeTitle(ctx: any, ctUid: string | undefined, rawTitle: string): string {
  const title = String(rawTitle ?? '').trim();
  if (!ctx?.usedTitles || !ctUid || !title) return title;
  let perCt = ctx.usedTitles.get(ctUid);
  if (!perCt) { perCt = new Map<string, number>(); ctx.usedTitles.set(ctUid, perCt); }
  const seen = perCt.get(title) ?? 0;
  perCt.set(title, seen + 1);
  return seen === 0 ? title : `${title} (${seen + 1})`;
}

/**
 * Resolve an image-alignment select value from a block's attributes. WordPress carries the side the
 * media sits on in `mediaPosition` (media-text) or `align` (core/image), so both are consulted, first
 * match wins. Only a value the field actually declares is returned: `align` is frequently a WIDTH
 * keyword (`wide`, `full`, `center`) rather than a side, and writing one of those into a select would
 * be rejected on import. Falls back to WordPress's own default for media-text, whose media renders on
 * the LEFT when no position is set — so the stored value matches how the page actually looked.
 */
function alignmentChoiceFor(
  block: any,
  alignField: any,
  opts: { defaultLeft?: boolean } = {},
): string | undefined {
  if (!alignField) return undefined;
  const allowed = choiceValues({ schema: [alignField] }, alignField.uid);
  if (!allowed.length) return undefined;
  const candidates = [block?.attrs?.mediaPosition, block?.attrs?.align]
    .map((v) => String(v ?? '').trim().toLowerCase())
    .filter(Boolean);
  for (const c of candidates) {
    const hit = allowed.find((a) => a.toLowerCase() === c);
    if (hit) return hit;
  }
  if (opts.defaultLeft) return allowed.find((a) => a.toLowerCase() === 'left');
  return undefined;
}

/**
 * Parse a `core/media-text` block — an image beside a text column — into the parts a text-and-image
 * section needs: the media asset, the leading heading as the title, and the remaining prose as the
 * body. `mediaPosition` carries which side the image sits on. Returns null when neither media nor text
 * could be recovered, so the caller can fall back rather than emit an empty section.
 */
function parseMediaTextBlock(
  block: any,
  assetData: any,
): { asset?: any; imgSrc?: string; title?: string; bodyHtml: string; position?: string } | null {
  const $ = cheerio.load(serializeBlockToHtml(block));
  const idNum = Number(block?.attrs?.mediaId ?? block?.attrs?.media_id);
  let asset = Number.isFinite(idNum) && idNum > 0 ? assetData?.[`assets_${idNum}`] : undefined;
  const imgSrc = String($('.wp-block-media-text__media img').first().attr('src') || $('img').first().attr('src') || '').trim();
  if (!asset && imgSrc) asset = resolveAssetByUrl(assetData, imgSrc);

  // Only the content column — never the media figure — supplies the text. Fall back to the whole
  // fragment minus the media figure when the theme didn't emit the standard content wrapper.
  const content = $('.wp-block-media-text__content');
  let bodyHtml: string;
  let title: string;
  if (content.length) {
    const heading = content.find('h1,h2,h3,h4,h5,h6').first();
    title = heading.text().replace(/\s+/g, ' ').trim();
    heading.remove();
    bodyHtml = content.html() || '';
  } else {
    $('.wp-block-media-text__media, figure').remove();
    const heading = $('h1,h2,h3,h4,h5,h6').first();
    title = heading.text().replace(/\s+/g, ' ').trim();
    heading.remove();
    bodyHtml = $('body').html() || $.root().html() || '';
  }

  if (!asset && !imgSrc && !title && !hasMeaningfulHtmlContent(bodyHtml)) return null;
  const position = String(block?.attrs?.mediaPosition ?? '').trim().toLowerCase();
  return { asset, imgSrc: imgSrc || undefined, title: title || undefined, bodyHtml, position };
}

const IMAGE_TEXT_GROUP_INNER = new Set([
  'core/heading', 'core/paragraph', 'core/list', 'core/buttons', 'core/button', 'core/spacer', 'core/separator',
]);
/**
 * A `core/group` shaped exactly like a media-text section — one image plus a text column — but authored
 * as a plain group instead of the dedicated `core/media-text` block. Requires EXACTLY one image (more
 * would be a card grid or gallery, not an image-beside-text layout) and at least one paragraph.
 */
function isImageTextGroup(block: any): boolean {
  if (block?.blockName !== 'core/group') return false;
  const leaves = Array.from(linearizeContentBlocks(block?.innerBlocks || []));
  if (!leaves.length) return false;
  const imageCount = leaves.filter((b: any) => b?.blockName === 'core/image').length;
  if (imageCount !== 1) return false;
  if (!leaves.some((b: any) => b?.blockName === 'core/paragraph')) return false;
  return leaves.every((b: any) => b?.blockName === 'core/image' || IMAGE_TEXT_GROUP_INNER.has(b?.blockName));
}

/** Parse an image-text group (see isImageTextGroup) into the same shape parseMediaTextBlock produces. */
function parseImageTextGroup(
  block: any,
  assetData: any,
): { asset?: any; imgSrc?: string; title?: string; bodyHtml: string } | null {
  let asset: any;
  let imgSrc = '';
  let title = '';
  const bodyParts: string[] = [];
  for (const lf of Array.from(linearizeContentBlocks(block?.innerBlocks || []))) {
    const nm = (lf as any)?.blockName;
    if (nm === 'core/image' && !asset) {
      const idAttr = Number((lf as any)?.attrs?.id);
      const src = (lf as any)?.attrs?.url || firstImgSrcFromInnerHtml(serializeBlockToHtml(lf));
      if (!imgSrc && src) imgSrc = String(src);
      asset = (Number.isFinite(idAttr) && idAttr > 0 ? assetData?.[`assets_${idAttr}`] : undefined)
        || resolveAssetByUrl(assetData, src);
    } else if (nm === 'core/heading' && !title) {
      title = stripHtmlTags(serializeBlockToHtml(lf)).replace(/\s+/g, ' ').trim();
    } else if (nm === 'core/paragraph' || nm === 'core/list') {
      const h = serializeBlockToHtml(lf);
      if (h && h.trim()) bodyParts.push(h);
    }
  }
  const bodyHtml = bodyParts.join('');
  if (!asset && !title && !hasMeaningfulHtmlContent(bodyHtml)) return null;
  return { asset, imgSrc: imgSrc || undefined, title: title || undefined, bodyHtml };
}

/**
 * A `core/group` (or `core/columns`, any column count) wrapping a heading/paragraph plus one or more
 * buttons, authored as one visual "CTA banner" unit (e.g. a bordered/backgrounded callout) rather than
 * ordinary adjacent page content — the heading+paragraph and the button(s) belong together and should
 * become ONE text_cta block, not a rich_text chunk split apart from a titleless CTA. Requires ZERO images
 * (an image present means this is isImageTextGroup/isColumnsImageTextBlock's shape instead) and at least
 * one button (a plain heading+paragraph group with no CTA has nothing to gain from this routing and stays
 * ordinary prose).
 */
function isGroupTextCta(block: any): boolean {
  if (block?.blockName !== 'core/group' && block?.blockName !== 'core/columns') return false;
  const leaves = Array.from(linearizeContentBlocks(block?.innerBlocks || []));
  const meaningful = leaves.filter((b: any) => !['core/spacer', 'core/separator'].includes((b as any)?.blockName));
  if (!meaningful.length) return false;
  if (meaningful.some((b: any) => (b as any)?.blockName === 'core/image')) return false;
  if (!meaningful.some((b: any) => (b as any)?.blockName === 'core/button')) return false;
  if (!meaningful.some((b: any) => ['core/heading', 'core/paragraph'].includes((b as any)?.blockName))) return false;
  return meaningful.every((b: any) => IMAGE_TEXT_GROUP_INNER.has((b as any)?.blockName));
}

/** Parse a text+CTA group/columns (see isGroupTextCta) into title/body/CTA parts. */
function parseGroupTextCta(
  block: any,
): { title?: string; bodyHtml: string; ctas: Array<{ label: string; href: string; newTab: boolean }> } {
  let title = '';
  const bodyParts: string[] = [];
  const ctas: Array<{ label: string; href: string; newTab: boolean }> = [];
  for (const lf of Array.from(linearizeContentBlocks(block?.innerBlocks || []))) {
    const nm = (lf as any)?.blockName;
    if (nm === 'core/heading') {
      if (!title) title = stripHtmlTags(serializeBlockToHtml(lf)).replace(/\s+/g, ' ').trim();
      else { const h = serializeBlockToHtml(lf); if (h && h.trim()) bodyParts.push(h); }
    } else if (nm === 'core/paragraph' || nm === 'core/list') {
      const h = serializeBlockToHtml(lf);
      if (h && h.trim()) bodyParts.push(h);
    } else if (nm === 'core/button') {
      const p = parseButtonAnchor(lf);
      if (p) ctas.push(p);
    }
  }
  return { title: title || undefined, bodyHtml: bodyParts.join(''), ctas };
}

/** Resolve a media URL to a downloaded Contentstack asset by base-key match (mirrors derivePostmeta). */
function resolveAssetByUrl(assetData: any, url: string | undefined): any {
  if (!url) return undefined;
  const key = assetBaseKey(String(url), '');
  return Object.values(assetData ?? {}).find((a: any) => a?.url && assetBaseKey(a.url, '') === key);
}

/**
 * A `core/columns` row shaped like a media-text section split across TWO columns instead of authored as
 * one `core/group` (see isImageTextGroup) — one column is pure image, the other is pure text. Requires
 * EXACTLY 2 columns and EXACTLY one of them pure-image, the other pure-text, so a 3+ column feature/icon
 * grid, or a column mixing image and text itself, is never reinterpreted as a single image+text block.
 */
function isColumnsImageTextBlock(block: any): boolean {
  if (block?.blockName !== 'core/columns') return false;
  const columns = (block?.innerBlocks || []).filter((b: any) => b?.blockName === 'core/column');
  if (columns.length !== 2) return false;
  const shapes = columns.map((col: any) => {
    const leaves = Array.from(linearizeContentBlocks(col?.innerBlocks || []));
    // Drop pure layout noise (spacers) and empty/decorative blocks with no real content (e.g. an SEO
    // breadcrumbs block, which renders nothing) — neither should stop an otherwise-plain-text column
    // from being recognized, same reasoning as ignoring spacers.
    const meaningful = leaves.filter((b: any) => {
      const nm = (b as any)?.blockName;
      if (['core/spacer', 'core/separator'].includes(nm)) return false;
      if (nm === 'core/image') return true;
      return hasMeaningfulHtmlContent(serializeBlockToHtml(b));
    });
    const imageCount = meaningful.filter((b: any) => (b as any)?.blockName === 'core/image').length;
    const hasParagraph = meaningful.some((b: any) => (b as any)?.blockName === 'core/paragraph');
    const isPureImage = imageCount === 1 && meaningful.length === 1;
    const isPureText = imageCount === 0 && hasParagraph
      && meaningful.every((b: any) => IMAGE_TEXT_GROUP_INNER.has((b as any)?.blockName));
    return { isPureImage, isPureText };
  });
  return (
    (shapes[0].isPureImage && shapes[1].isPureText) ||
    (shapes[0].isPureText && shapes[1].isPureImage)
  );
}

/**
 * A `core/columns` row where EVERY column is nothing but a single image — no heading, no paragraph, no
 * button anywhere in the row. Real example: a 3-icon strip (course pages: Quality/Community/Contribution
 * icons authored as 3 sibling columns with no accompanying text). isColumnsImageTextBlock doesn't claim
 * this shape — it requires exactly one column to be pure TEXT — so today each image falls through
 * separately to the standalone core/image handler, producing N disconnected single-image text_image
 * entries instead of the one visual unit they actually are. The text_image variant's `image` field is
 * itself `multiple: true`, so this collects every image into ONE entry instead.
 */
function isColumnsAllImages(block: any): boolean {
  if (block?.blockName !== 'core/columns') return false;
  const columns = (block?.innerBlocks || []).filter((b: any) => b?.blockName === 'core/column');
  if (columns.length < 2) return false;
  return columns.every((col: any) => {
    const leaves = Array.from(linearizeContentBlocks(col?.innerBlocks || []));
    const meaningful = leaves.filter((b: any) => !['core/spacer', 'core/separator'].includes((b as any)?.blockName));
    return meaningful.length === 1 && meaningful[0]?.blockName === 'core/image';
  });
}

/** Parse an all-image columns row (see isColumnsAllImages) into an ordered list of resolved assets. */
function parseColumnsAllImages(block: any, assetData: any): any[] {
  const columns = (block?.innerBlocks || []).filter((b: any) => b?.blockName === 'core/column');
  const assets: any[] = [];
  for (const col of columns) {
    const img = (col?.innerBlocks || []).find((b: any) => b?.blockName === 'core/image');
    if (!img) continue;
    const idAttr = Number(img?.attrs?.id);
    const asset = (Number.isFinite(idAttr) && idAttr > 0 ? assetData?.[`assets_${idAttr}`] : undefined)
      || resolveAssetByUrl(assetData, img?.attrs?.url || firstImgSrcFromInnerHtml(serializeBlockToHtml(img)));
    if (asset) assets.push(asset);
  }
  return assets;
}

/** Parse a two-column image+text row (see isColumnsImageTextBlock) into the shape parseImageTextGroup produces. */
function parseColumnsImageText(
  block: any,
  assetData: any,
): { asset?: any; imgSrc?: string; title?: string; bodyHtml: string } | null {
  const columns = (block?.innerBlocks || []).filter((b: any) => b?.blockName === 'core/column');
  let asset: any;
  let imgSrc = '';
  let title = '';
  const bodyParts: string[] = [];
  for (const col of columns) {
    for (const lf of Array.from(linearizeContentBlocks(col?.innerBlocks || []))) {
      const nm = (lf as any)?.blockName;
      if (nm === 'core/image' && !asset) {
        const idAttr = Number((lf as any)?.attrs?.id);
        const src = (lf as any)?.attrs?.url || firstImgSrcFromInnerHtml(serializeBlockToHtml(lf));
        if (!imgSrc && src) imgSrc = String(src);
        asset = (Number.isFinite(idAttr) && idAttr > 0 ? assetData?.[`assets_${idAttr}`] : undefined)
          || resolveAssetByUrl(assetData, src);
      } else if (nm === 'core/heading') {
        if (!title) {
          title = stripHtmlTags(serializeBlockToHtml(lf)).replace(/\s+/g, ' ').trim();
        } else {
          // A second heading (e.g. a short label heading plus a real intro heading) has no field of its
          // own to hold it — fold it into the body instead of silently dropping it.
          const h = serializeBlockToHtml(lf);
          if (h && h.trim()) bodyParts.push(h);
        }
      } else if (nm === 'core/paragraph' || nm === 'core/list') {
        const h = serializeBlockToHtml(lf);
        if (h && h.trim()) bodyParts.push(h);
      } else if (nm === 'core/button') {
        // The variant's `cta` global field is a distinct link+type structure this generic parser has no
        // schema access to fill — fold the button into the body as a plain link instead of dropping it.
        const h = serializeBlockToHtml(lf);
        if (h && h.trim()) bodyParts.push(h);
      }
    }
  }
  const bodyHtml = bodyParts.join('');
  if (!asset && !title && !hasMeaningfulHtmlContent(bodyHtml)) return null;
  return { asset, imgSrc: imgSrc || undefined, title: title || undefined, bodyHtml };
}

/**
 * A `core/group` or `core/columns` wrapping exactly one image plus one quote — a portrait/logo authored
 * beside its attributed quote — is one visual unit and must become ONE text_quote entry (image in the
 * quote GF's `logo` field), not two disconnected entries (an orphan text_image plus a text_quote missing
 * its portrait). Real example: "SAFe Explained eBook" authors this as `core/group > core/image,
 * core/quote`; other pages author the same pairing as `core/columns > core/column > core/image` /
 * `core/column > core/quote`. Requires EXACTLY one image and EXACTLY one quote among the linearized
 * leaves (through columns), with nothing else meaningful — a heading/paragraph alongside would mean this
 * is ordinary page content that merely happens to sit near a quote, not the pairing itself.
 */
function isImageQuotePair(block: any): boolean {
  if (block?.blockName !== 'core/group' && block?.blockName !== 'core/columns') return false;
  const leaves = Array.from(linearizeContentBlocks(block?.innerBlocks || []));
  const meaningful = leaves.filter((b: any) => !['core/spacer', 'core/separator'].includes((b as any)?.blockName));
  const imageCount = meaningful.filter((b: any) => (b as any)?.blockName === 'core/image').length;
  const quoteCount = meaningful.filter((b: any) => /^core\/(quote|pullquote)$/.test((b as any)?.blockName ?? '')).length;
  return imageCount === 1 && quoteCount === 1 && meaningful.length === 2;
}

/** Parse an image+quote pair (see isImageQuotePair) into the quote's parsed fields plus the paired image. */
function parseImageQuotePair(block: any, assetData: any): (Record<string, any> & { asset?: any }) | null {
  const leaves = Array.from(linearizeContentBlocks(block?.innerBlocks || []));
  const imgBlock: any = leaves.find((b: any) => (b as any)?.blockName === 'core/image');
  const quoteBlock: any = leaves.find((b: any) => /^core\/(quote|pullquote)$/.test((b as any)?.blockName ?? ''));
  const pq = quoteBlock ? parseQuoteBlock(quoteBlock) : null;
  if (!pq?.quote_text) return null;
  let asset: any;
  if (imgBlock) {
    const idAttr = Number(imgBlock?.attrs?.id);
    const src = imgBlock?.attrs?.url || firstImgSrcFromInnerHtml(serializeBlockToHtml(imgBlock));
    asset = (Number.isFinite(idAttr) && idAttr > 0 ? assetData?.[`assets_${idAttr}`] : undefined)
      || resolveAssetByUrl(assetData, src);
  }
  return { ...pq, asset };
}

/**
 * A `core/columns` row where each column is a self-contained "card": one heading (the card title)
 * followed by one or more paragraphs (the card's feature-bullet body), no image, no button. Real example:
 * course pages' "Benefits of ... Certification" 2-up cards ("Career Development & Community" / "Continued
 * Learning") — the bullet list is itself authored as a plain `core/group` (a decorative "mock-list"
 * wrapper) around several paragraphs rather than a real `core/list`, but that group flattens away via the
 * normal linearize recursion, leaving just heading+paragraphs per column. Requires 2+ columns and EVERY
 * column to be exactly one heading plus 1+ paragraphs — no image (that's isColumnsImageTextBlock's shape)
 * and no button (that's isGroupTextCta's shape).
 */
function isColumnsCardPair(block: any): boolean {
  if (block?.blockName !== 'core/columns') return false;
  const columns = (block?.innerBlocks || []).filter((b: any) => b?.blockName === 'core/column');
  if (columns.length < 2) return false;
  return columns.every((col: any) => {
    const leaves = Array.from(linearizeContentBlocks(col?.innerBlocks || []));
    const meaningful = leaves.filter((b: any) => !['core/spacer', 'core/separator'].includes((b as any)?.blockName));
    if (!meaningful.length) return false;
    const headingCount = meaningful.filter((b: any) => (b as any)?.blockName === 'core/heading').length;
    const paraCount = meaningful.filter((b: any) => (b as any)?.blockName === 'core/paragraph').length;
    return headingCount === 1 && paraCount >= 1 && headingCount + paraCount === meaningful.length;
  });
}

/** Parse a columns-card-pair row (see isColumnsCardPair) into one card per column. */
function parseColumnsCardPair(block: any): Array<{ title?: string; description?: string }> {
  const columns = (block?.innerBlocks || []).filter((b: any) => b?.blockName === 'core/column');
  return columns
    .map((col: any) => {
      let title = '';
      const bodyParts: string[] = [];
      for (const lf of Array.from(linearizeContentBlocks(col?.innerBlocks || []))) {
        const nm = (lf as any)?.blockName;
        if (nm === 'core/heading' && !title) {
          title = stripHtmlTags(serializeBlockToHtml(lf)).replace(/\s+/g, ' ').trim();
        } else if (nm === 'core/paragraph') {
          const t = stripHtmlTags(serializeBlockToHtml(lf)).replace(/\s+/g, ' ').trim();
          if (t) bodyParts.push(t);
        }
      }
      return { title: title || undefined, description: bodyParts.join(' ') || undefined };
    })
    .filter((c: any) => c.title || c.description);
}

/**
 * A `core/columns` row where each column is a "tier" card: a title PARAGRAPH (not a heading — often bold
 * text with an internal `<br>` line break, e.g. "Pathfinder<br>Partners") plus a description paragraph,
 * plus one or more badge images (frequently authored as their own nested `core/columns` sub-row of plain
 * images). Real example: the Scaled Agile Partner Network page's tier cards (Pathfinder/Business/
 * Government Solution Partners), each carrying 2 badge icons. Requires 2+ columns and EVERY column to be
 * exactly 2 paragraphs plus 1+ images and nothing else — no heading (that's isColumnsCardPair's shape).
 */
function isColumnsTierCardPair(block: any): boolean {
  if (block?.blockName !== 'core/columns') return false;
  const columns = (block?.innerBlocks || []).filter((b: any) => b?.blockName === 'core/column');
  if (columns.length < 2) return false;
  return columns.every((col: any) => {
    const leaves = Array.from(linearizeContentBlocks(col?.innerBlocks || []));
    const meaningful = leaves.filter((b: any) => !['core/spacer', 'core/separator'].includes((b as any)?.blockName));
    if (!meaningful.length) return false;
    const paraCount = meaningful.filter((b: any) => (b as any)?.blockName === 'core/paragraph').length;
    const imageCount = meaningful.filter((b: any) => (b as any)?.blockName === 'core/image').length;
    return paraCount === 2 && imageCount >= 1 && paraCount + imageCount === meaningful.length;
  });
}

/** Parse a tier-card-pair row (see isColumnsTierCardPair) into one card per column. */
function parseColumnsTierCardPair(
  block: any,
  assetData: any,
): Array<{ title?: string; description?: string; icons: any[] }> {
  const columns = (block?.innerBlocks || []).filter((b: any) => b?.blockName === 'core/column');
  return columns
    .map((col: any) => {
      let title = '';
      let description = '';
      const icons: any[] = [];
      for (const lf of Array.from(linearizeContentBlocks(col?.innerBlocks || []))) {
        const nm = (lf as any)?.blockName;
        if (nm === 'core/paragraph') {
          // `<br>` inside a title paragraph (e.g. "Pathfinder<br>Partners") needs a space in its place —
          // stripHtmlTags alone would fuse the two lines into one word.
          const t = stripHtmlTags(serializeBlockToHtml(lf).replace(/<br\s*\/?>/gi, ' ')).replace(/\s+/g, ' ').trim();
          if (!title) title = t;
          else if (!description) description = t;
        } else if (nm === 'core/image') {
          const idAttr = Number((lf as any)?.attrs?.id);
          const asset = (Number.isFinite(idAttr) && idAttr > 0 ? assetData?.[`assets_${idAttr}`] : undefined)
            || resolveAssetByUrl(assetData, (lf as any)?.attrs?.url || firstImgSrcFromInnerHtml(serializeBlockToHtml(lf)));
          if (asset) icons.push(asset);
        }
      }
      return { title: title || undefined, description: description || undefined, icons };
    })
    .filter((c: any) => c.title || c.description || c.icons.length);
}

/**
 * A `core/block` (reusable/synced-pattern reference — see coreBlockOverrideHtml) whose per-instance
 * override content (attrs.content) is shaped like an image+text card: exactly ONE entry that is
 * image-shaped (has a url/id and no text) plus at least one entry that is text-shaped (a non-empty
 * `.content` string). Real example: the certification "badge" pattern (ref 203135) used across course
 * pages — content `{ "Badge Image": {url,id}, "Header": {content}, "Body": {content} }` — always sitting
 * inside a plain `core/cover` with no background image of its own. Requiring EXACTLY one image entry
 * excludes shapes with a second url-bearing entry that is actually a button/link (e.g. a "Download certs
 * button" entry alongside a real badge image), which is not this pattern.
 */
function isCoreBlockImageText(block: any): boolean {
  if (block?.blockName !== 'core/block') return false;
  const content = block?.attrs?.content;
  if (!content || typeof content !== 'object' || Array.isArray(content)) return false;
  const entries = Object.values(content);
  // A url-bearing entry only counts as an image if the url actually looks like one — a PDF/document
  // download button has the identical shape (bare `url`, no `.content`) and must not be miscounted as a
  // second image (which would wrongly reject this as not-image-text at all) or worse, be resolved AS the
  // image (rendering `<img src="....pdf">`, an unrenderable "corrupt file" in the RTE). See isImageUrl.
  const isImageEntry = (v: any) =>
    v && typeof v === 'object' && typeof v.content !== 'string'
    && ((typeof v.url === 'string' && isImageUrl(v.url)) || Number.isFinite(Number(v.id)));
  const isTextEntry = (v: any) => v && typeof v === 'object' && typeof v.content === 'string' && v.content.trim();
  const imageCount = entries.filter(isImageEntry).length;
  const textCount = entries.filter(isTextEntry).length;
  return imageCount === 1 && textCount >= 1;
}

/** Parse a core/block image+text card (see isCoreBlockImageText) into the shape parseImageTextGroup produces. */
function parseCoreBlockImageText(
  block: any,
  assetData: any,
): { asset?: any; imgSrc?: string; title?: string; bodyHtml: string } | null {
  const content = block?.attrs?.content;
  if (!content || typeof content !== 'object') return null;
  let asset: any;
  let imgSrc = '';
  let title = '';
  const bodyParts: string[] = [];
  for (const [label, raw] of Object.entries(content)) {
    const v: any = raw;
    if (!v || typeof v !== 'object') continue;
    if (typeof v.content === 'string' && v.content.trim()) {
      // The label is authored data (not schema-driven) — real instances of this pattern use both
      // "Header"/"header" AND "heading" for the title label (e.g. "csbft: heading 1.1"), so match either;
      // everything else folds into the body.
      if (/head(er|ing)/i.test(label) && !title) title = stripHtmlTags(v.content).replace(/\s+/g, ' ').trim();
      else bodyParts.push(`<p>${v.content}</p>`);
    } else if (!asset && (Number.isFinite(Number(v.id)) || (typeof v.url === 'string' && isImageUrl(v.url)))) {
      const idAttr = Number(v.id);
      if (!imgSrc && typeof v.url === 'string' && v.url.trim()) imgSrc = v.url.trim();
      asset = (Number.isFinite(idAttr) && idAttr > 0 ? assetData?.[`assets_${idAttr}`] : undefined)
        || resolveAssetByUrl(assetData, v.url);
    } else if (typeof v.url === 'string' && v.url.trim()) {
      // A url-bearing entry that isn't an image (e.g. a PDF certification-details download button) — a
      // real link, folded into the body instead of being silently dropped or mistaken for the image.
      const linkLabel = typeof v.text === 'string' && v.text.trim() ? v.text.trim() : v.url.trim();
      bodyParts.push(`<p><a href="${v.url.trim()}">${linkLabel}</a></p>`);
    }
  }
  const bodyHtml = bodyParts.join('');
  if (!asset && !title && !hasMeaningfulHtmlContent(bodyHtml)) return null;
  return { asset, imgSrc: imgSrc || undefined, title: title || undefined, bodyHtml };
}

interface CoreBlockCardSet {
  items: Array<{ title?: string; description?: string }>;
  sectionSubtitle?: string;
  leadHtml?: string;
  image?: { id?: number; url?: string };
}

/**
 * A `core/block` override content shaped like a repeating set of cards rather than one image+text block:
 * TWO OR MORE numbered pairs of a short heading-like entry ("Header 1"/"Description 1", or a shared-index
 * scheme like "bblheading1"/"bbl1paragraph") plus, optionally, one shared (unnumbered) image and one
 * unnumbered heading/intro pair for the section itself. Real examples: ref 203104 (an intro + 4
 * "Header N"/"Description N" audience cards) and ref 202919 (two "bblheadingN"/"bblNparagraph" pairs
 * sharing one "bblimage"). Distinguishing "short" (heading) from "long" (body) text is by length alone —
 * unlike people-grid's `looksLikeRoleText`, a heading here can legitimately end in "?" (e.g. "Who is this
 * certification for?"), so punctuation isn't a useful signal — the authored labels are free-text per
 * pattern and can't be relied on beyond "contains a number".
 */
function parseCoreBlockCardContent(content: Record<string, any>): CoreBlockCardSet | null {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null;
  const numberOf = (label: string): string | null => /(\d+)/.exec(label)?.[1] ?? null;
  const isShort = (text: string) => text.length <= 60;

  type Entry = { num: string | null; kind: 'image' | 'short' | 'long'; text?: string; id?: number; url?: string };
  const entries: Entry[] = [];
  for (const [label, raw] of Object.entries(content)) {
    const v: any = raw;
    if (!v || typeof v !== 'object') continue;
    if (typeof v.content === 'string' && v.content.trim()) {
      const text = stripHtmlTags(v.content).replace(/\s+/g, ' ').trim();
      entries.push({ num: numberOf(label), kind: isShort(text) ? 'short' : 'long', text });
    } else if (Number.isFinite(Number(v.id)) || (typeof v.url === 'string' && isImageUrl(v.url))) {
      // A url-bearing entry only counts as an image if the url actually looks like one — a PDF/document
      // download button has the identical bare-`url` shape and must not be misclassified as the card
      // set's shared image (see isImageUrl).
      entries.push({ num: numberOf(label), kind: 'image', id: Number(v.id), url: v.url });
    }
  }

  const byNum = new Map<string, Entry[]>();
  for (const e of entries.filter((e) => e.num != null)) {
    (byNum.get(e.num!) ?? byNum.set(e.num!, []).get(e.num!)!).push(e);
  }
  const items = Array.from(byNum.values())
    .map((group) => ({
      title: group.find((e) => e.kind === 'short')?.text,
      description: group.find((e) => e.kind === 'long')?.text,
    }))
    .filter((it) => it.title || it.description);
  if (items.length < 2) return null; // fewer than 2 pairs isn't a repeating card set

  const unnumbered = entries.filter((e) => e.num == null);
  const unnumberedShort = unnumbered.filter((e) => e.kind === 'short').map((e) => e.text!);
  const unnumberedLong = unnumbered.filter((e) => e.kind === 'long').map((e) => e.text!);
  // Only the FIRST short entry has a field to hold it (the section's subtitle); anything past that —
  // plus every long entry — folds into the lead paragraph so nothing is silently dropped.
  const sectionSubtitle = unnumberedShort[0];
  const leadParts = [...unnumberedShort.slice(1), ...unnumberedLong];
  const imgEntry = unnumbered.find((e) => e.kind === 'image') ?? entries.find((e) => e.kind === 'image');
  return {
    items,
    sectionSubtitle,
    leadHtml: leadParts.length ? leadParts.map((t) => `<p>${t}</p>`).join('') : undefined,
    image: imgEntry ? { id: imgEntry.id, url: imgEntry.url } : undefined,
  };
}

/**
 * A `core/block` override content shaped like a resource list: two or more entries named "col N text"/
 * "col N btn" (per-resource description + link, N being the resource's position) plus, elsewhere in the
 * content, a heading entry FOR EACH resource whose own inline `<a href>` matches that resource's "col N
 * btn" url — real example: ref 195636 ("Resources for Future Agile Product Managers"), where the
 * resource's title lives in a separately-numbered "heading 2"/"heading 3"/"heading 4" entry (offset by
 * one from the "col 1"/"col 2"/"col 3" numbering, since "heading 1" is the section's own heading) and the
 * only reliable way to pair a heading to its resource is by matching URLs, not by number. A leading
 * heading with no link is the section heading; a further one is the section's lead paragraph (no field of
 * its own on resource_list, so it's returned separately to fold into the surrounding rich_text).
 */
function parseCoreBlockResourceList(
  content: Record<string, any>,
): { heading?: string; leadHtml?: string; resources: Array<{ title?: string; description?: string; url?: string; linkLabel?: string }> } | null {
  if (!content || typeof content !== 'object' || Array.isArray(content)) return null;
  const colTextByNum = new Map<string, string>();
  const colBtnByNum = new Map<string, { url?: string; text?: string }>();
  const linkedHeadings: Array<{ text: string; href: string }> = [];
  let sectionHeading: string | undefined;
  let sectionLead: string | undefined;

  for (const [label, raw] of Object.entries(content)) {
    const v: any = raw;
    if (!v || typeof v !== 'object') continue;
    const colTextMatch = /col\s*(\d+)\s*text/i.exec(label);
    const colBtnMatch = /col\s*(\d+)\s*btn/i.exec(label);
    if (colTextMatch && typeof v.content === 'string') {
      colTextByNum.set(colTextMatch[1], stripHtmlTags(v.content).replace(/\s+/g, ' ').trim());
      continue;
    }
    if (colBtnMatch) {
      colBtnByNum.set(colBtnMatch[1], {
        url: typeof v.url === 'string' ? v.url.trim() : undefined,
        text: typeof v.text === 'string' ? v.text.trim() : undefined,
      });
      continue;
    }
    if (typeof v.content === 'string' && v.content.trim()) {
      const $ = cheerio.load(v.content);
      // A doubly-nested `<a>` (invalid HTML, seen in real authored content — an outer <a> wrapping a
      // <strong><a>...</a></strong> with the SAME href) gets split by the parser into an empty anchor
      // plus a sibling that carries the real text — picking blindly the first anchor grabs the empty one,
      // silently losing the title. Prefer whichever anchor actually has text over a bare "first" pick.
      const anchors = $('a')
        .toArray()
        .map((el) => ({
          href: String($(el).attr('href') || '').trim(),
          text: $(el).text().replace(/\s+/g, ' ').trim(),
        }))
        .filter((x) => x.href);
      const chosen = anchors.find((x) => x.text) || anchors[0];
      const href = chosen?.href || '';
      const text = chosen?.text || stripHtmlTags(v.content).replace(/\s+/g, ' ').trim();
      if (href) {
        linkedHeadings.push({ text, href });
      } else if (!sectionHeading) {
        sectionHeading = text;
      } else if (!sectionLead) {
        sectionLead = text;
      }
    }
  }

  const colNums = Array.from(new Set([...colTextByNum.keys(), ...colBtnByNum.keys()])).sort(
    (a, b) => Number(a) - Number(b),
  );
  if (colNums.length < 2) return null; // fewer than 2 resources isn't confidently this pattern

  const resources = colNums
    .map((num) => {
      const btn = colBtnByNum.get(num);
      const heading = btn?.url ? linkedHeadings.find((h) => h.href === btn.url) : undefined;
      return {
        title: heading?.text,
        description: colTextByNum.get(num),
        url: btn?.url,
        linkLabel: btn?.text || 'Read More',
      };
    })
    .filter((r) => r.title || r.description || r.url);
  if (resources.length < 2) return null;

  return { heading: sectionHeading, leadHtml: sectionLead ? `<p>${sectionLead}</p>` : undefined, resources };
}

/**
 * Resolve a postmeta value to a downloaded asset. WordPress exports store an image reference as a bare
 * attachment id, a URL, or (in the scaledagile theme) a PIPE-SEPARATED list of either — every image of
 * the post, featured first. Try each segment in order, as an id then as a URL, and return the first
 * asset that resolves; undefined when none do (never a bare id/URL, which is invalid for a file field).
 */
function resolveAssetFromMetaValue(raw: any, assetData: any): any {
  if (raw === undefined || raw === null) return undefined;
  const parts = String(raw).split('|').map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const id = Number(part);
    if (Number.isFinite(id) && id > 0) {
      const byId = assetData?.[`assets_${id}`];
      if (byId) return byId;
      continue;
    }
    const byUrl = resolveAssetByUrl(assetData, part);
    if (byUrl) return byUrl;
  }
  return undefined;
}

/**
 * The name of the term an item is tagged with under a given taxonomy domain, read from the inline
 * `<category domain="…" nicename="…">Name</category>` tags. Used to fill a plain TEXT field named after
 * a taxonomy (e.g. `industry`) when no postmeta of that name exists. Returns the first match only —
 * a text field holds one value — and undefined when the item carries no such tag.
 */
function termNameForDomain(item: any, domain: string | undefined): string | undefined {
  if (!domain) return undefined;
  const raw = item?.category;
  const cats = Array.isArray(raw) ? raw : raw ? [raw] : [];
  // An item can carry SEVERAL terms of the same domain (e.g. a case study tagged both
  // <category domain="industry">Government</category> and …>Healthcare</category>). The target is a
  // single text field, so join them rather than taking only the first and silently dropping the rest.
  const names: string[] = [];
  for (const c of cats) {
    if (String(c?.attributes?.domain ?? '') !== domain) continue;
    const name = String(c?.text ?? '').trim() || humanizeSlug(c?.attributes?.nicename);
    if (name && !names.includes(name)) names.push(name);
  }
  return names.length ? names.join(', ') : undefined;
}

/** Plain (non-enum) text sub-field uids in declared order — the title/subtitle roles of a variant. */
function plainTextSubUids(schema: any[]): string[] {
  return (Array.isArray(schema) ? schema : [])
    .filter((f: any) => f?.data_type === 'text' && !f?.enum)
    .map((f: any) => f.uid);
}

/**
 * A hero-shaped variant: a background/file image + a plain text title + a cta global field, and no
 * rich-text (json) field — which is what distinguishes a hero layout from a flexible text_image block.
 */
function pickHeroVariant(variantsField: any): any | null {
  const blocks = Array.isArray(variantsField?.blocks) ? variantsField.blocks : [];
  let best: any = null;
  let bestScore = -1;
  for (const b of blocks) {
    const s: any[] = Array.isArray(b?.schema) ? b.schema : [];
    const hasFile = s.some((f: any) => f?.data_type === 'file');
    const hasTitle = s.some((f: any) => f?.data_type === 'text' && !f?.enum);
    const hasJson = s.some((f: any) => f?.data_type === 'json');
    if (!hasFile || !hasTitle || hasJson) continue;
    const hasCta = s.some((f: any) => f?.data_type === 'global_field');
    const score = (hasCta ? 2 : 0) + plainTextSubUids(s).length;
    if (score > bestScore) { bestScore = score; best = b; }
  }
  return best;
}

interface SlideCardsDef {
  def: RefSectionDef;
  vfUid: string;
  variantUid: string;
  cardsUid: string;
  titleUid?: string;
  subtitleUid?: string;
  descUid?: string;
  ctaUid?: string;
  ctaMultiple?: boolean;
  imageUid?: string;
}

/**
 * Locate a "sliding cards" target: a reference section whose content type declares a variant holding a
 * repeating card group that carries title + subtitle + DESCRIPTION. The description field is what makes
 * this shape unique among card variants (a step/standard grid, an image grid and a video grid all lack
 * it), so the match stays schema-driven rather than keyed to a variant uid.
 */
function findSlideCardsSection(refSections: RefSectionDef[]): SlideCardsDef | null {
  for (const r of refSections) {
    const vf = variantsBlocksField(r.refCt);
    for (const b of Array.isArray(vf?.blocks) ? vf.blocks : []) {
      const cards = (b?.schema || []).find((f: any) => f?.data_type === 'group' && f?.multiple);
      const sub: any[] = Array.isArray(cards?.schema) ? cards.schema : [];
      if (!sub.length) continue;
      const texts = sub.filter((f: any) => f?.data_type === 'text' && !f?.enum).map((f: any) => f.uid);
      const descUid = texts.find((u: string) => /desc/i.test(u));
      const titleUid = texts.find((u: string) => /title|head/i.test(u));
      const subtitleUid = texts.find((u: string) => /sub|body|text/i.test(u) && u !== descUid);
      if (!descUid || !titleUid) continue; // not the sliding-cards shape
      const ctaField = sub.find(
        (f: any) => f?.data_type === 'global_field' && referenceTargets(f).includes('cta'),
      );
      return {
        def: r,
        vfUid: vf.uid,
        variantUid: b.uid,
        cardsUid: cards.uid,
        titleUid,
        subtitleUid,
        descUid,
        ctaUid: ctaField?.uid,
        ctaMultiple: Boolean(ctaField?.multiple),
        imageUid: sub.find((f: any) => f?.data_type === 'file' && /image|photo|thumb/i.test(f?.uid || ''))?.uid
          ?? sub.find((f: any) => f?.data_type === 'file')?.uid,
      };
    }
  }
  return null;
}

/**
 * Parse a slider block into its slides. Each slide contributes a heading, the quote/testimonial body,
 * and its attribution — which WordPress stores either as a `<cite>` inside the quote or as a trailing
 * paragraph opening with a dash ("—Carmen Farenthold, Director …").
 */
function parseSliderBlock(
  block: any,
): Array<{ title?: string; body?: string; attribution?: string; links: Array<{ label: string; href: string }>; images: Array<{ id?: number; src?: string }> }> {
  const slides = (Array.isArray(block?.innerBlocks) ? block.innerBlocks : []).filter((b: any) =>
    /slider-item|slide$/i.test(String(b?.blockName ?? '')),
  );
  const out: Array<{ title?: string; body?: string; attribution?: string; links: Array<{ label: string; href: string }>; images: Array<{ id?: number; src?: string }> }> = [];
  for (const s of slides) {
    const $ = cheerio.load(serializeBlockToHtml(s));
    // Images a slide carries. A card holds them in a FILE field, so they only survive if the asset was
    // downloaded — the caller checks this and declines the card routing otherwise, rather than dropping
    // the image.
    const images: Array<{ id?: number; src?: string }> = [];
    $('img[src]').each((_: any, el: any) => {
      const src = String($(el).attr('src') || '').trim();
      const cls = String($(el).attr('class') || '');
      const idm = /wp-image-(\d+)/.exec(cls);
      images.push({ id: idm ? Number(idm[1]) : undefined, src: src || undefined });
    });
    // Capture any calls-to-action BEFORE the text is harvested — a slide can carry buttons ("Read more"
    // → a case study) whose href has nowhere else to go once the slide becomes a card.
    const links: Array<{ label: string; href: string }> = [];
    $('a[href]').each((_: any, el: any) => {
      const href = String($(el).attr('href') || '').trim();
      const label = $(el).text().replace(/\s+/g, ' ').trim();
      if (href && !href.startsWith('#')) links.push({ label: label || href, href });
    });
    // Take the first heading that actually has text — slides sometimes open with an empty heading used
    // purely for spacing, which would otherwise mask the real one.
    const h = $('h1,h2,h3,h4,h5,h6')
      .toArray()
      .map((el: any) => $(el))
      .find((el: any) => el.text().replace(/\s+/g, ' ').trim());
    const title = h ? h.text().replace(/\s+/g, ' ').trim() : '';
    if (h) h.remove();
    let attribution = $('cite').first().text().replace(/\s+/g, ' ').trim();
    $('cite').remove();
    const paras = $('p')
      .toArray()
      .map((el: any) => $(el).text().replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    // No <cite>: a trailing paragraph that opens with a dash is the attribution, not part of the quote.
    if (!attribution && paras.length > 1 && /^\s*[—–-]/.test(paras[paras.length - 1])) {
      attribution = paras.pop() as string;
    }
    const body = (paras.join(' ') || $.root().text().replace(/\s+/g, ' ')).trim();
    if (title || body || links.length || images.length) {
      out.push({ title: title || undefined, body: body || undefined, attribution: attribution || undefined, links, images });
    }
  }
  return out;
}

/**
 * Locate a table variant: one whose sole repeating group itself contains a repeating group of text
 * cells (columns → rows). Detected by that nesting, not by name.
 */
function findTableVariant(
  variantsField: any,
): { variantUid: string; columnsUid: string; colTitleUid?: string; rowsUid: string; rowTitleUid?: string; rowValueUid?: string } | null {
  for (const b of Array.isArray(variantsField?.blocks) ? variantsField.blocks : []) {
    const cols = (b?.schema || []).find((f: any) => f?.data_type === 'group' && f?.multiple);
    if (!cols) continue;
    const rows = (cols?.schema || []).find((f: any) => f?.data_type === 'group' && f?.multiple);
    if (!rows) continue;
    const rowTexts = (rows?.schema || []).filter((f: any) => f?.data_type === 'text' && !f?.enum).map((f: any) => f.uid);
    if (rowTexts.length < 1) continue;
    const colTitle = (cols?.schema || []).find((f: any) => f?.data_type === 'text' && !f?.enum);
    return {
      variantUid: b.uid,
      columnsUid: cols.uid,
      colTitleUid: colTitle?.uid,
      rowsUid: rows.uid,
      rowTitleUid: rowTexts[0],
      rowValueUid: rowTexts[1],
    };
  }
  return null;
}

/**
 * Parse a `core/table` into the column-oriented shape Contentstack models: each data column becomes a
 * group whose `rows` pair the row's LABEL (first cell) with that column's value. A two-column table is
 * therefore a plain key/value list, and a wider table keeps every cell by repeating the label per
 * column — nothing is truncated. Returns null when the table carries markup a text cell can't hold
 * (links or images), so the caller can leave it as rich text instead of losing it.
 */
function parseTableBlock(block: any): { header?: string; columns: Array<{ title?: string; rows: Array<{ label: string; value?: string }> }> } | null {
  const html = serializeBlockToHtml(block);
  const $ = cheerio.load(html);
  if ($('table a[href], table img').length) return null; // richer than text cells can carry
  const readRow = (tr: any) =>
    $(tr)
      .find('th,td')
      .toArray()
      .map((c: any) => $(c).text().replace(/\s+/g, ' ').trim());

  const headRows = $('table thead tr').toArray();
  const bodyRows = $('table tbody tr').toArray();
  const headers = headRows.length ? readRow(headRows[0]) : [];
  const rows = (bodyRows.length ? bodyRows : $('table tr').toArray().slice(headRows.length ? 1 : 0)).map(readRow);
  if (!rows.length) return null;

  const width = Math.max(...rows.map((r) => r.length), headers.length);
  const columns: Array<{ title?: string; rows: Array<{ label: string; value?: string }> }> = [];
  if (width <= 1) {
    columns.push({ title: headers[0], rows: rows.map((r) => ({ label: r[0] ?? '' })).filter((r) => r.label) });
  } else {
    for (let c = 1; c < width; c++) {
      const cells = rows
        .map((r) => ({ label: r[0] ?? '', value: r[c] ?? '' }))
        .filter((r) => r.label || r.value);
      if (cells.length) columns.push({ title: headers[c], rows: cells });
    }
  }
  return columns.length ? { header: headers[0], columns } : null;
}

/**
 * Locate a plain card-grid target: a reference section whose content type declares a variant holding a
 * repeating card group with a title AND a subtitle but NO description field — the description is what
 * marks the richer "sliding cards" shape, so excluding it keeps the two routes distinct. Prefers the
 * leanest such variant (fewest file/link/enum extras).
 */
function findSimpleCardsSection(refSections: RefSectionDef[]): SlideCardsDef | null {
  let best: SlideCardsDef | null = null;
  let bestScore = -Infinity;
  for (const r of refSections) {
    const vf = variantsBlocksField(r.refCt);
    for (const b of Array.isArray(vf?.blocks) ? vf.blocks : []) {
      const cards = (b?.schema || []).find((f: any) => f?.data_type === 'group' && f?.multiple);
      const sub: any[] = Array.isArray(cards?.schema) ? cards.schema : [];
      if (!sub.length) continue;
      const texts = sub.filter((f: any) => f?.data_type === 'text' && !f?.enum).map((f: any) => f.uid);
      if (texts.some((u: string) => /desc/i.test(u))) continue; // that's the sliding-cards shape
      const titleUid = texts.find((u: string) => /title|head/i.test(u));
      const subtitleUid = texts.find((u: string) => /sub|body|text/i.test(u) && u !== titleUid);
      if (!titleUid || !subtitleUid) continue;
      const extras = sub.filter(
        (f: any) => f?.data_type === 'file' || f?.data_type === 'link' || f?.enum,
      ).length;
      const score = -extras;
      if (score > bestScore) {
        bestScore = score;
        const ctaField = sub.find(
          (f: any) => f?.data_type === 'global_field' && referenceTargets(f).includes('cta'),
        );
        best = {
          def: r,
          vfUid: vf.uid,
          variantUid: b.uid,
          cardsUid: cards.uid,
          titleUid,
          subtitleUid,
          ctaUid: ctaField?.uid,
          ctaMultiple: Boolean(ctaField?.multiple),
          imageUid: sub.find((f: any) => f?.data_type === 'file')?.uid,
        };
      }
    }
  }
  return best;
}

interface IconCardsDef {
  def: RefSectionDef;
  vfUid: string;
  variantUid: string;
  cardsUid: string;
  titleUid?: string;
  subtitleUid?: string;
  iconUid: string;
}

/**
 * Locate a "multi-icon cards" target: a reference section whose content type declares a variant holding a
 * repeating card group with a MULTIPLE file field (e.g. `cards_section.variants.standard.cards.icon`) —
 * distinct from `findSimpleCardsSection`'s single-file assumption. Real example: a partner-tier card that
 * carries 2+ badge icons (e.g. Bronze + Silver) per card, which a single-file `image`/`icon` slot can't
 * hold without dropping one.
 */
function findIconCardsSection(refSections: RefSectionDef[]): IconCardsDef | null {
  for (const r of refSections) {
    const vf = variantsBlocksField(r.refCt);
    for (const b of Array.isArray(vf?.blocks) ? vf.blocks : []) {
      const cards = (b?.schema || []).find((f: any) => f?.data_type === 'group' && f?.multiple);
      const sub: any[] = Array.isArray(cards?.schema) ? cards.schema : [];
      if (!sub.length) continue;
      const iconField = sub.find((f: any) => f?.data_type === 'file' && f?.multiple);
      if (!iconField) continue;
      const texts = sub.filter((f: any) => f?.data_type === 'text' && !f?.enum).map((f: any) => f.uid);
      if (texts.some((u: string) => /desc/i.test(u))) continue; // that's the sliding-cards shape instead
      const titleUid = texts.find((u: string) => /title|head/i.test(u));
      if (!titleUid) continue;
      const subtitleUid = texts.find((u: string) => u !== titleUid && /sub|body|text/i.test(u));
      return { def: r, vfUid: vf.uid, variantUid: b.uid, cardsUid: cards.uid, titleUid, subtitleUid, iconUid: iconField.uid };
    }
  }
  return null;
}

interface CarouselCardDef {
  def: RefSectionDef;
  vfUid: string;
  variantUid: string;
  cardsUid: string;
  titleUid?: string;
  subtitleUid?: string;
  iconUid?: string;
  ctaUid?: string;
  ctaMultiple?: boolean;
}

/**
 * Locate the target for a WordPress slider block (e.g. `eedee/block-gutenslider`): the reference section
 * whose OWN content type is the carousel, matched by uid rather than shape — routing slider content into
 * "the carousel content type" is inherently about content-type identity, not merely a field shape, and a
 * shape-only match risks colliding with an equally card-shaped target elsewhere (e.g. cards_section's own
 * simple variant, already claimed by `findSimpleCardsSection` for the accordion/slider-widget routes).
 * Prefers the first declared variant with a repeating group + title field (carousel.json's "card":
 * icon+title+subtitle+cta).
 */
function findCarouselCardSection(refSections: RefSectionDef[]): CarouselCardDef | null {
  const r = refSections.find((x) => /carousel/i.test(String(x.refCtUid || '')));
  if (!r) return null;
  const vf = variantsBlocksField(r.refCt);
  for (const b of Array.isArray(vf?.blocks) ? vf.blocks : []) {
    const cards = (b?.schema || []).find((f: any) => f?.data_type === 'group' && f?.multiple);
    const sub: any[] = Array.isArray(cards?.schema) ? cards.schema : [];
    if (!sub.length) continue;
    const texts = sub.filter((f: any) => f?.data_type === 'text' && !f?.enum).map((f: any) => f.uid);
    const titleUid = texts.find((u: string) => /title|head/i.test(u));
    if (!titleUid) continue;
    const subtitleUid = texts.find((u: string) => u !== titleUid && /sub|body|text/i.test(u));
    const iconField = sub.find((f: any) => f?.data_type === 'file');
    const ctaField = sub.find((f: any) => f?.data_type === 'global_field' && referenceTargets(f).includes('cta'));
    return {
      def: r,
      vfUid: vf.uid,
      variantUid: b.uid,
      cardsUid: cards.uid,
      titleUid,
      subtitleUid,
      iconUid: iconField?.uid,
      ctaUid: ctaField?.uid,
      ctaMultiple: Boolean(ctaField?.multiple),
    };
  }
  return null;
}

/**
 * Parse the "Gutenslider" plugin's slider block (`eedee/block-gutenslider`, whose slides are `eedee/
 * block-gutenslide`) into carousel cards. Each slide's background lives on its own `core/cover` (attrs.
 * url/id); its real content — a title heading, a body paragraph, a CTA button — sits nested several
 * groups deep (group > jetpack/layout-grid > jetpack/layout-grid-column > group), which
 * linearizeContentBlocks now flattens through since jetpack/layout-grid(-column) were added to its
 * transparent-wrapper set. `eedee/block-gutenslider` isn't itself a recognized wrapper, so it already
 * reaches the dispatch loop as one opaque block (previously falling through entirely to rich_text).
 */
function parseGutensliderCarousel(
  block: any,
  assetData: any,
): Array<{ title?: string; subtitle?: string; icon?: any; cta?: { title: string; href: string } }> {
  const slides = Array.isArray(block?.innerBlocks) ? block.innerBlocks : [];
  return slides
    .map((slide: any) => {
      const cover = (slide?.innerBlocks || []).find((b: any) => b?.blockName === 'core/cover');
      let icon: any;
      if (cover) {
        const idAttr = Number(cover?.attrs?.id);
        icon = (Number.isFinite(idAttr) && idAttr > 0 ? assetData?.[`assets_${idAttr}`] : undefined)
          || resolveAssetByUrl(assetData, cover?.attrs?.url);
      }
      let title = '';
      const subParts: string[] = [];
      let cta: { title: string; href: string } | undefined;
      for (const lf of Array.from(linearizeContentBlocks(slide?.innerBlocks || []))) {
        const nm = (lf as any)?.blockName;
        if (nm === 'core/heading' && !title) {
          title = stripHtmlTags(serializeBlockToHtml(lf)).replace(/\s+/g, ' ').trim();
        } else if (nm === 'core/paragraph') {
          const t = stripHtmlTags(serializeBlockToHtml(lf)).replace(/\s+/g, ' ').trim();
          if (t) subParts.push(t);
        } else if (nm === 'core/button' && !cta) {
          const p = parseButtonAnchor(lf);
          if (p) cta = { title: p.label, href: p.href };
        }
      }
      return { title: title || undefined, subtitle: subParts.join(' ') || undefined, icon, cta };
    })
    .filter((s: any) => s.title || s.subtitle || s.icon);
}

/**
 * Parse an accordion into its items. Each child contributes the heading shown on the closed row plus
 * the body revealed when it expands. The heading lives in the plugin's head container; the body is
 * simply whatever remains once that head (and its expand/collapse icons) is removed, so the parse does
 * not depend on the plugin's body class name.
 */
function parseAccordionBlock(
  block: any,
): Array<{ title?: string; bodyHtml: string; links: Array<{ label: string; href: string }>; hasImage: boolean }> {
  const kids = (Array.isArray(block?.innerBlocks) ? block.innerBlocks : []).filter((b: any) =>
    /accordion-child|accordion-item/i.test(String(b?.blockName ?? '')),
  );
  const out: Array<{ title?: string; bodyHtml: string; links: Array<{ label: string; href: string }>; hasImage: boolean }> = [];
  for (const k of kids) {
    const $ = cheerio.load(serializeBlockToHtml(k));
    const head = $('[class*="__head"]').first();
    let title = head.length ? head.text().replace(/\s+/g, ' ').trim() : '';
    if (head.length) head.remove();
    if (!title) {
      const h = $('h1,h2,h3,h4,h5,h6').first();
      title = h.text().replace(/\s+/g, ' ').trim();
      if (h.length) h.remove();
    }
    $('svg').remove(); // expand/collapse chrome
    const links: Array<{ label: string; href: string }> = [];
    $('a[href]').each((_: any, el: any) => {
      const href = String($(el).attr('href') || '').trim();
      if (href && !href.startsWith('#')) links.push({ label: $(el).text().replace(/\s+/g, ' ').trim() || href, href });
    });
    const hasImage = $('img').length > 0;
    const bodyHtml = ($('body').html() || $.root().html() || '').trim();
    if (title || hasMeaningfulHtmlContent(bodyHtml)) out.push({ title: title || undefined, bodyHtml, links, hasImage });
  }
  return out;
}

/** The reference section (other than the prose sink) whose target CT declares a hero-shaped variant. */
function findHeroSection(
  refSections: RefSectionDef[],
  flexSection: RefSectionDef,
): { def: RefSectionDef; variant: any; vfUid: string } | null {
  for (const r of refSections) {
    if (r.refCtUid === flexSection.refCtUid) continue;
    const vf = variantsBlocksField(r.refCt);
    const variant = vf ? pickHeroVariant(vf) : null;
    if (variant) return { def: r, variant, vfUid: vf.uid };
  }
  return null;
}

/**
 * A stats-band variant: a global field pointing at the `stats` global field (stat_title/number_headline/
 * subtitle), declared `multiple` so it holds a row of stats. Prefers the leanest variant (fewest OTHER
 * fields to fill) since only the number+label pairs are ever recoverable from a plain heading+paragraph
 * columns row.
 */
function pickStatsVariant(variantsField: any): any | null {
  const blocks = Array.isArray(variantsField?.blocks) ? variantsField.blocks : [];
  let best: any = null;
  let bestScore = -1;
  for (const b of blocks) {
    const s: any[] = Array.isArray(b?.schema) ? b.schema : [];
    const statsField = s.find(
      (f: any) => f?.data_type === 'global_field' && f?.multiple && referenceTargets(f).some((t: string) => /^stats$/i.test(t)),
    );
    if (!statsField) continue;
    const score = 10 - s.length; // fewer other fields = leaner, less to leave unfilled
    if (score > bestScore) { bestScore = score; best = b; }
  }
  return best;
}

/** The reference section whose target CT declares a stats-band variant (see pickStatsVariant). */
function findStatsSection(
  refSections: RefSectionDef[],
  flexSection: RefSectionDef,
): { def: RefSectionDef; variant: any; vfUid: string; statsUid: string } | null {
  for (const r of refSections) {
    if (r.refCtUid === flexSection.refCtUid) continue;
    const vf = variantsBlocksField(r.refCt);
    const variant = vf ? pickStatsVariant(vf) : null;
    if (!variant) continue;
    const statsField = (variant.schema || []).find(
      (f: any) => f?.data_type === 'global_field' && f?.multiple && referenceTargets(f).some((t: string) => /^stats$/i.test(t)),
    );
    if (statsField) return { def: r, variant, vfUid: vf.uid, statsUid: statsField.uid };
  }
  return null;
}

/** A number-shaped heading text ("20%", "8", "1,200+", "$500K", "10x") — distinguishes a stat from prose. */
function looksLikeStatNumber(text: string): boolean {
  return /^[$]?[\d][\d,.]*\s*[%+]?\s*[a-zA-Z]{0,3}[%+]?$/.test(text.trim());
}

interface TabSectionDef {
  def: RefSectionDef;
  tabsUid: string;
  tabBlockUid: string;
  tabTitleUid: string;
  variantsUid: string;
  variant: any;
}

/**
 * The reference section whose target CT is tab-shaped: a top-level `blocks` field (e.g.
 * horizontal_tabs.tabs) whose one declared block (a "tab") owns a plain-text title plus its OWN nested
 * `blocks` field with a prose-capable variant (title + json description — e.g. standard_layout).
 */
function findTabSectionDef(refSections: RefSectionDef[], flexSection: RefSectionDef): TabSectionDef | null {
  for (const r of refSections) {
    if (r.refCtUid === flexSection.refCtUid) continue;
    const tabsField = (Array.isArray(r.refCt?.schema) ? r.refCt.schema : []).find((f: any) => f?.data_type === 'blocks');
    if (!tabsField) continue;
    const tabBlock = (Array.isArray(tabsField.blocks) ? tabsField.blocks : [])[0];
    if (!tabBlock) continue;
    const tabTitleField = (tabBlock.schema || []).find((f: any) => f?.data_type === 'text');
    const tabVariantsField = (tabBlock.schema || []).find((f: any) => f?.data_type === 'blocks');
    if (!tabTitleField || !tabVariantsField) continue;
    const variant = pickVariantByRole(tabVariantsField, 'prose');
    if (!variant) continue;
    return { def: r, tabsUid: tabsField.uid, tabBlockUid: tabBlock.uid, tabTitleUid: tabTitleField.uid, variantsUid: tabVariantsField.uid, variant };
  }
  return null;
}

/**
 * gutena/tabs (the Gutena Blocks plugin's tabs block) is a REAL tabbed-content block, not the jump-nav
 * heuristic above — each gutena/tab child is one tab's content, and the parent's `titleTabs` attr carries
 * every tab's label in order. Not a transparent wrapper, so without dedicated handling the whole block
 * (every tab's content run together) falls to the default rich_text fallback with no tab boundaries.
 */
function parseGutenaTabs(block: any): Array<{ title: string; html: string }> {
  const titleTabs = Array.isArray(block?.attrs?.titleTabs) ? block.attrs.titleTabs : [];
  const tabs = (block?.innerBlocks || []).filter((b: any) => b?.blockName === 'gutena/tab');
  return tabs
    .map((t: any, i: number) => ({
      title: String(titleTabs[i]?.text ?? '').trim() || `Tab ${i + 1}`,
      html: serializeBlockToHtml(t),
    }))
    .filter((t: any) => t.title || hasMeaningfulHtmlContent(t.html));
}

const normalizeForMatch = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * A "jump-nav" section: a paragraph/list early in the body linking to 2+ in-page anchors. WordPress
 * authors often hand-type these hrefs, so they frequently DON'T match the actual (auto-slugified)
 * heading id — matching is done by comparing the link's visible TEXT against each heading's text
 * instead, which is far more reliable in practice. When every nav link resolves to a distinct heading
 * later in the body, the content between each matched heading (up to the next heading of the same or
 * higher level) is a self-contained section — these are really tabs authored as plain jump-linked
 * sections, not flat prose. Returns null (leaving the content as ordinary flexible_layouts prose) unless
 * EVERY nav link resolves, so a partial/coincidental match never mis-fires.
 */
function extractJumpNavTabs(
  blocks: any[],
): { tabs: Array<{ title: string; html: string }>; consumed: Set<any> } | null {
  const lin = Array.from(linearizeContentBlocks(blocks));
  let navIdx = -1;
  let navLinks: string[] = [];
  for (let i = 0; i < lin.length; i++) {
    const b = lin[i];
    if (b?.blockName !== 'core/paragraph' && b?.blockName !== 'core/list') continue;
    const $ = cheerio.load(serializeBlockToHtml(b));
    const links: string[] = [];
    $('a[href^="#"]').each((_: number, el: any) => {
      const label = $(el).text().replace(/\s+/g, ' ').trim();
      if (label) links.push(label);
    });
    if (links.length >= 2) { navIdx = i; navLinks = links; break; }
  }
  if (navIdx < 0) return null;

  const usedHeadingIdxs = new Set<number>();
  const matchedIdxs: number[] = [];
  for (const link of navLinks) {
    const linkNorm = normalizeForMatch(link);
    let found = -1;
    for (let j = navIdx + 1; j < lin.length; j++) {
      if (usedHeadingIdxs.has(j) || lin[j]?.blockName !== 'core/heading') continue;
      const hNorm = normalizeForMatch(stripHtmlTags(serializeBlockToHtml(lin[j])).replace(/\s+/g, ' ').trim());
      if (hNorm && (linkNorm.includes(hNorm) || hNorm.includes(linkNorm))) { found = j; break; }
    }
    if (found < 0) return null; // not every nav item resolved — don't guess
    usedHeadingIdxs.add(found);
    matchedIdxs.push(found);
  }

  const sorted = [...matchedIdxs].sort((a, b) => a - b);
  const tabs: Array<{ title: string; html: string }> = [];
  const consumed = new Set<any>([lin[navIdx]]);
  for (let k = 0; k < sorted.length; k++) {
    const start = sorted[k];
    const startLevel = wpHeadingLevel(lin[start]);
    const title = stripHtmlTags(serializeBlockToHtml(lin[start])).replace(/\s+/g, ' ').trim();
    const htmlParts: string[] = [];
    consumed.add(lin[start]);
    let end = lin.length;
    for (let m = start + 1; m < lin.length; m++) {
      if (lin[m]?.blockName === 'core/heading' && wpHeadingLevel(lin[m]) <= startLevel) { end = m; break; }
      const h = serializeBlockToHtml(lin[m]);
      if (h && h.trim()) htmlParts.push(h);
    }
    for (let m = start + 1; m < end; m++) consumed.add(lin[m]);
    tabs.push({ title, html: htmlParts.join('') });
  }
  return tabs.length ? { tabs, consumed } : null;
}

/**
 * A `core/columns` row is stats-band shaped when it has 2+ columns and every column, once flattened, is
 * exactly one heading (a number, e.g. "20%") followed by one paragraph (the label) — the group wrapper
 * WordPress puts around the heading is transparent (unwrapped by linearize), so this reduces to a flat
 * 2-block sequence per column.
 */
function isStatsColumns(block: any): boolean {
  if (block?.blockName !== 'core/columns') return false;
  const columns = (block?.innerBlocks || []).filter((b: any) => b?.blockName === 'core/column');
  if (columns.length < 2) return false;
  return columns.every((col: any) => {
    const leaves = Array.from(linearizeContentBlocks(col?.innerBlocks || [])).filter(
      (b: any) => !['core/spacer', 'core/separator'].includes(b?.blockName),
    );
    if (leaves.length !== 2) return false;
    const [first, second] = leaves as any[];
    if (first?.blockName !== 'core/heading' || second?.blockName !== 'core/paragraph') return false;
    return looksLikeStatNumber(stripHtmlTags(serializeBlockToHtml(first)).replace(/\s+/g, ' ').trim());
  });
}

/** Parse a stats-band columns row into {number, subtitle} per column (see isStatsColumns). */
function parseStatsColumns(block: any): Array<{ number: string; subtitle: string }> {
  const columns = (block?.innerBlocks || []).filter((b: any) => b?.blockName === 'core/column');
  const stats: Array<{ number: string; subtitle: string }> = [];
  for (const col of columns) {
    const leaves = Array.from(linearizeContentBlocks(col?.innerBlocks || []));
    const heading = leaves.find((b: any) => b?.blockName === 'core/heading');
    const para = leaves.find((b: any) => b?.blockName === 'core/paragraph');
    const number = heading ? stripHtmlTags(serializeBlockToHtml(heading)).replace(/\s+/g, ' ').trim() : '';
    const subtitle = para ? stripHtmlTags(serializeBlockToHtml(para)).replace(/\s+/g, ' ').trim() : '';
    if (number || subtitle) stats.push({ number, subtitle });
  }
  return stats;
}

/**
 * A stats-band row authored with an eyebrow "badge" label above each number (e.g. "Enterprise" / "20K+" /
 * "Over two million trained professionals…") instead of isStatsColumns' plain heading+paragraph shape —
 * the number itself is also a paragraph (metadata.name "Stat"), not a heading. WordPress nests the badge
 * in its own group and the number/subtitle pair in a further core/columns inside each outer column, but
 * both wrappers are transparent (unwrapped by linearize), so each outer column reduces to a flat 2- or
 * 3-paragraph sequence, one of which is recognizably the number.
 */
function isStatsCardColumns(block: any): boolean {
  if (block?.blockName !== 'core/columns') return false;
  const columns = (block?.innerBlocks || []).filter((b: any) => b?.blockName === 'core/column');
  if (columns.length < 2) return false;
  return columns.every((col: any) => {
    const leaves = Array.from(linearizeContentBlocks(col?.innerBlocks || [])).filter(
      (b: any) => !['core/spacer', 'core/separator'].includes((b as any)?.blockName),
    ) as any[];
    if (leaves.length < 2 || leaves.length > 3) return false;
    if (!leaves.every((b: any) => b?.blockName === 'core/paragraph')) return false;
    return leaves.some((b: any) => looksLikeStatNumber(stripHtmlTags(serializeBlockToHtml(b)).replace(/\s+/g, ' ').trim()));
  });
}

/** Parse a badge/number/subtitle stats-band row (see isStatsCardColumns) into {title?, number, subtitle} per column. */
function parseStatsCardColumns(block: any): Array<{ title?: string; number: string; subtitle: string }> {
  const columns = (block?.innerBlocks || []).filter((b: any) => b?.blockName === 'core/column');
  const stats: Array<{ title?: string; number: string; subtitle: string }> = [];
  for (const col of columns) {
    const leaves = Array.from(linearizeContentBlocks(col?.innerBlocks || [])).filter(
      (b: any) => !['core/spacer', 'core/separator'].includes((b as any)?.blockName),
    ) as any[];
    const texts = leaves.map((b) => stripHtmlTags(serializeBlockToHtml(b)).replace(/\s+/g, ' ').trim());
    const numberIdx = texts.findIndex((t) => looksLikeStatNumber(t));
    if (numberIdx === -1) continue;
    const number = texts[numberIdx];
    const rest = texts.filter((_, i) => i !== numberIdx);
    const title = texts.length === 3 ? rest[0] : undefined;
    const subtitle = texts.length === 3 ? rest[1] : rest[0];
    if (number || subtitle) stats.push({ title, number, subtitle });
  }
  return stats;
}


/** Build a `cta` global-field value from a WP button block, honoring the gf's declared `type` enum. */
function buildCtaGfValue(typeChoices: string[], block: any): Record<string, any> | null {
  const p = parseButtonAnchor(block);
  if (!p) return null;
  const val: Record<string, any> = { title_url: { title: p.label, href: p.href || '' }, open_in_new_tab: p.newTab };
  const primary = typeChoices.find((c) => /primary/i.test(c)) || typeChoices[0];
  if (primary) val.type = primary;
  return val;
}

/**
 * An inline (non-reference) page-section block that models a marketo/embed form — detected by a text
 * sub-field whose uid looks like a form id. Returns the block uid and that field's uid.
 */
function findFormBlockDef(blocksField: any): { blockUid: string; formIdUid: string } | null {
  for (const b of Array.isArray(blocksField?.blocks) ? blocksField.blocks : []) {
    if ((b?.schema || []).some((f: any) => f?.data_type === 'reference')) continue;
    const formField = (b?.schema || []).find(
      (f: any) => f?.data_type === 'text' && /form.?id|form/i.test(f?.uid || ''),
    );
    if (formField) return { blockUid: b.uid, formIdUid: formField.uid };
  }
  return null;
}

/**
 * Build the body of a reference-section model (e.g. generic_pages.page_sections). Every Gutenberg block
 * lands in a `flexible_layouts`-style side entry so NO authored content is dropped: prose/heading/list/
 * html fold into the prose variant (json RTE, heading-aware 30KB split); images, videos and quotes are
 * routed to their typed variants when the section type declares one, else they too fold into prose.
 * The single side entry is referenced once from the flexible-layout page block, preserving order.
 */
/**
 * A top-level `reference` field whose target content type is a section model (it declares a variants
 * blocks field with a prose variant, e.g. flexible_layouts). Such a field holds the entry's body as
 * references to section entries instead of inline modular blocks.
 */
function isSectionReferenceField(field: any, ctByUid?: Map<string, any>): boolean {
  const refUid = referenceTargets(field)[0];
  if (!refUid || !ctByUid) return false;
  const vf = variantsBlocksField(ctByUid.get(refUid));
  return !!(vf && pickVariantByRole(vf, 'prose'));
}

/**
 * Build the value of a section-reference body field: run the normal modular router against a synthetic
 * blocks field that wraps this reference, then unwrap the produced sections back to a flat reference
 * array. Reusing the router means the side entries, variant routing and 30KB packing behave identically
 * to a modular-blocks body.
 */
function buildSectionReferenceValue(field: any, blocks: any[], assetData: any, ctx: any): any[] {
  const syntheticBlocksField = {
    uid: field?.uid,
    data_type: 'blocks',
    blocks: [{ uid: field?.uid, schema: [field] }],
  };
  const sections = buildModularBody(syntheticBlocksField, blocks, assetData, ctx);
  const refs: any[] = [];
  for (const section of sections) {
    const inner = section?.[field?.uid];
    const value = inner?.[field?.uid];
    if (Array.isArray(value)) refs.push(...value);
  }
  return refs;
}

/**
 * Build a modular-blocks array for `blocksField`, routing each Gutenberg block to a block the target
 * declares. Blocks the target does not declare fold into rich_text (or drop, for spacer/separator).
 *
 * Some targets (generic_pages, course.page_sections, event_revised.content_blocks, …) declare NO direct
 * rich_text block — instead some of their blocks wrap a REFERENCE to a standalone section content type
 * (hero_section, flexible_layouts, cards_section, …), and may mix those with ordinary inline blocks
 * (speaker, agenda_item). All of the section-reference routing (hero-shaped cover → hero_section, a
 * marketo-form block → inline marketo_form, and the flexible_layouts prose/image/video/quote sink used
 * as the fallback floor in place of a flat rich_text block) is woven into the SAME per-block dispatch
 * loop below, gated so it only activates for blocks/roles the target doesn't already declare a flat
 * block for — this keeps every existing inline rule (speaker, named sections, FAQ, card-grid, flat
 * quote/video_embed/cta_section) running unchanged, so a mixed model doesn't lose its inline sections to
 * a full bypass.
 */
function buildModularBody(
  blocksField: any,
  blocks: any[],
  assetData?: any,
  ctx?: { uid?: string; locale?: string; entryTitle?: string; contentTypesByUid?: Map<string, any>; globalFieldsByUid?: Map<string, any>; sideEntries?: Record<string, Record<string, any>>; usedTitles?: Map<string, Map<string, number>>; consumedBlocks?: Set<any> },
): any[] {
  const defByUid = new Map<string, any>((blocksField?.blocks || []).map((b: any) => [b?.uid, b]));
  const rtDef = findRichTextBlockDef(blocksField);
  const rtBlockUid = rtDef?.uid;
  const rtSlot = rtDef ? richTextSlot(rtDef) : null;
  const ctaResolved = findCtaBlockDef(blocksField);

  // Reference-section support (active only when the target has no flat rich_text block — matches the
  // targets this applies to today; a future model declaring both would need this gate revisited).
  const refSections = rtDef ? [] : findReferenceSectionDefs(blocksField, ctx?.contentTypesByUid);
  const flexSection = refSections.find((r) => {
    const vf = variantsBlocksField(r.refCt);
    return vf && pickVariantByRole(vf, 'prose');
  });
  const flexVf = flexSection ? variantsBlocksField(flexSection.refCt) : null;
  const flexProseVar = flexVf ? pickVariantByRole(flexVf, 'prose') : null;
  const flexImageVar = flexVf ? pickVariantByRole(flexVf, 'image') : null;
  const flexVideoVar = flexVf ? pickVariantByRole(flexVf, 'video') : null;
  const flexQuoteVar = flexVf ? pickVariantByRole(flexVf, 'quote', flexProseVar ? new Set([flexProseVar.uid]) : undefined) : null;
  // Shared by the plain core/quote handler and the image+quote pairing (isImageQuotePair) below — builds
  // the quote variant's sub-object from a parsed quote, filling the GF's logo/image field when one is
  // resolved. Sub-fields are resolved from the GF definition, never assumed: in the shipped model the
  // quotes GF spells attribution as `author`, a REFERENCE to the author content type, so the raw
  // `<cite>` text (a name + role) must never be written there — a bare string in a reference field makes
  // the CLI audit's fixMissingReferences JSON.parse throw, which fails the audit and aborts the import.
  // Attribution is stored only when the model gives it a TEXT home; otherwise it's folded into the quote
  // text so the authored content still survives.
  const buildQuoteFlexSub = (pq: Record<string, any>, asset?: any): Record<string, any> | null => {
    if (!flexQuoteVar || !pq?.quote_text) return null;
    const gf = firstFieldOfType(flexQuoteVar.schema, 'global_field');
    const sub: Record<string, any> = {};
    if (gf) {
      const gfDef = ctx?.globalFieldsByUid?.get(referenceTargets(gf)[0]);
      const gfSchema: any[] = Array.isArray(gfDef?.schema) ? gfDef.schema : [];
      const isPlainText = (f: any) => f?.data_type === 'text' && !f?.enum;
      const quoteTextField =
        gfSchema.find((f: any) => isPlainText(f) && /quote|text/i.test(f?.uid || '')) ||
        gfSchema.find(isPlainText);
      const attributionField = gfSchema.find(
        (f: any) =>
          isPlainText(f) &&
          f?.uid !== quoteTextField?.uid &&
          /author|attribution|cite|name/i.test(f?.uid || ''),
      );
      const logoField = gfSchema.find((f: any) => f?.data_type === 'file');
      const gfVal: Record<string, any> = {};
      gfVal[quoteTextField?.uid || 'quote'] =
        pq.attribution && !attributionField ? `${pq.quote_text} — ${pq.attribution}` : pq.quote_text;
      if (attributionField && pq.attribution) gfVal[attributionField.uid] = pq.attribution;
      if (logoField && asset) gfVal[logoField.uid] = asset;
      sub[gf.uid] = gfVal;
    }
    return Object.keys(sub).length ? sub : null;
  };
  const flexCtaVar = flexVf ? pickVariantByRole(flexVf, 'cta', flexProseVar ? new Set([flexProseVar.uid]) : undefined) : null;
  const flexTableVar = flexVf ? findTableVariant(flexVf) : null;
  const flexProseSubUid = jsonSubUid(flexProseVar?.schema);
  const heroSection = flexSection ? findHeroSection(refSections, flexSection) : null;
  const statsSection = flexSection ? findStatsSection(refSections, flexSection) : null;
  // Shared by both stats-band shapes (isStatsColumns' heading+paragraph and isStatsCardColumns' badge
  // label+paragraph-number). Builds and pushes the stats_section side entry; returns whether it emitted.
  const emitStatsSection = (parsed: Array<{ title?: string; number: string; subtitle: string }>): boolean => {
    if (!statsSection || !parsed.length) return false;
    const gfField = (statsSection.variant.schema || []).find((f: any) => f?.uid === statsSection.statsUid);
    const gfDef = ctx?.globalFieldsByUid?.get(referenceTargets(gfField)[0]);
    const gfSchema: any[] = Array.isArray(gfDef?.schema) ? gfDef.schema : [];
    const numberField = gfSchema.find((f: any) => /number|headline|value/i.test(f?.uid || '')) || gfSchema[0];
    const subtitleField = gfSchema.find(
      (f: any) => f?.uid !== numberField?.uid && /subtitle|description|label/i.test(f?.uid || ''),
    );
    const titleField = gfSchema.find(
      (f: any) => f?.uid !== numberField?.uid && f?.uid !== subtitleField?.uid && /title|name|eyebrow/i.test(f?.uid || ''),
    );
    const statsArr = parsed
      .map((s) => {
        const it: Record<string, any> = {};
        if (titleField && s.title) it[titleField.uid] = s.title;
        if (numberField && s.number) it[numberField.uid] = s.number;
        if (subtitleField && s.subtitle) it[subtitleField.uid] = s.subtitle;
        return it;
      })
      .filter((s) => Object.keys(s).length);
    if (!statsArr.length) return false;
    flush();
    const entryUid = idCorrector(`${ctx?.uid || 'entry'}_stats_${statsSeq++}`);
    const store = sideStoreFor(ctx, statsSection.def.refCtUid);
    if (store) {
      store[entryUid] = {
        uid: entryUid,
        title: sectionEntryTitle(statsSection.def.refCtUid, 'Stats'),
        [statsSection.vfUid]: [{ [statsSection.variant.uid]: { [statsSection.statsUid]: statsArr } }],
        locale: ctx?.locale || 'en-us',
        publish_details: [],
      };
    }
    sections.push({
      [statsSection.def.blockUid]: { [statsSection.def.refField]: [{ uid: entryUid, _content_type_uid: statsSection.def.refCtUid }] },
    });
    return true;
  };
  const tabSectionDef = flexSection ? findTabSectionDef(refSections, flexSection) : null;
  const jumpNavTabs = tabSectionDef ? extractJumpNavTabs(blocks) : null;
  const slideCards = refSections.length ? findSlideCardsSection(refSections) : null;
  const simpleCards = refSections.length ? findSimpleCardsSection(refSections) : null;
  const iconCardsDef = refSections.length ? findIconCardsSection(refSections) : null;
  const carouselCardDef = refSections.length ? findCarouselCardSection(refSections) : null;
  let accordionSeq = 0;
  const formDef = rtDef ? null : findFormBlockDef(blocksField);
  let slideCardsSeq = 0;
  let carouselSeq = 0;
  const ctaTypeChoices: string[] = (() => {
    const s = heroSection?.variant?.schema || [];
    const ctaField = s.find((f: any) => f?.data_type === 'global_field' && f?.multiple)
      || s.find((f: any) => f?.data_type === 'global_field');
    const gfUid = ctaField ? referenceTargets(ctaField)[0] : undefined;
    const gfDef = gfUid ? ctx?.globalFieldsByUid?.get(gfUid) : undefined;
    const typeField = (gfDef?.schema || []).find((f: any) => f?.data_type === 'text' && f?.enum);
    return typeField ? choiceValues({ schema: [typeField] }, typeField.uid) : [];
  })();

  const sections: any[] = [];
  let buffer: string[] = [];
  let flexVariants: any[] = [];
  let flexSeq = 0;
  let heroSeq = 0;
  let statsSeq = 0;
  // A page has exactly one hero banner. Only the FIRST hero-shaped cover becomes a hero_section entry;
  // any later cover that happens to match the same simple shape (heading/paragraph/button) is ordinary
  // page content, not a second banner, and falls through to flexible_layouts like any other section.
  let heroEmitted = false;

  /**
   * Title for a generated section side entry (hero_section/flexible_layouts/cards_section all declare
   * `title` as unique+mandatory). Deliberately NOT derived from the section's own heading/label — a
   * heading is frequently a generic string repeated across many unrelated pages ("Share:", "Challenge:",
   * "Industry:"), and importing it verbatim collides with every other entry using that same label, so
   * only the FIRST one imports and every later one (plus whatever references it) fails. Uses the parent
   * item's own title instead, run through the same `dedupeTitle` registry as main entries — this also
   * covers the case where one parent produces more than one entry of the same section type (e.g. a page
   * with two hero blocks) AND the case where two different parents literally share a title.
   */
  const sectionEntryTitle = (ctUid: string, fallback: string): string => {
    const parent = String(ctx?.entryTitle ?? '').trim();
    return dedupeTitle(ctx, ctUid, parent || fallback);
  };

  // ONE flexible_layouts entry per content entry. Every variant this body produces accumulates into a
  // single side entry rather than being split each time a hero/form/FAQ section interrupts the run —
  // an article or course must reference exactly one flexible-layout document, not several. The slot is
  // reserved at the position of the FIRST flex content so the reference still sits in document order
  // relative to the other sections, and is filled in (or removed) once the body has been walked.
  let flexSlotIndex = -1;
  const reserveFlexSlot = () => {
    if (flexSlotIndex < 0 && flexSection) {
      flexSlotIndex = sections.length;
      sections.push(null); // placeholder, replaced by finalizeFlexEntry
    }
  };
  const finalizeFlexEntry = () => {
    if (flexSlotIndex < 0) return;
    if (!flexVariants.length) {
      sections.splice(flexSlotIndex, 1); // nothing accrued — drop the placeholder
      flexSlotIndex = -1;
      return;
    }
    const flexIndex = flexSeq++;
    const entryUid = idCorrector(`${ctx?.uid || 'entry'}_flex_${flexIndex}`);
    const store = sideStoreFor(ctx, flexSection!.refCtUid);
    if (store) {
      store[entryUid] = {
        uid: entryUid,
        title: sectionEntryTitle(flexSection!.refCtUid, 'Content'),
        [flexVf!.uid]: flexVariants,
        locale: ctx?.locale || 'en-us',
        publish_details: [],
      };
    }
    sections[flexSlotIndex] = {
      [flexSection!.blockUid]: { [flexSection!.refField]: [{ uid: entryUid, _content_type_uid: flexSection!.refCtUid }] },
    };
    flexVariants = [];
  };

  const flush = () => {
    if (!buffer.length) return;
    if (rtDef && rtSlot && rtBlockUid) {
      const blockHtmls = buffer;
      buffer = [];
      const toValue = rtSlot.json ? RteJsonConverter : normalizeHtmlFragment;
      sections.push(
        ...packRichTextSections(blockHtmls, toValue, (value) => ({ [rtBlockUid]: { [rtSlot.uid]: value } })),
      );
      return;
    }
    if (flexSection && flexProseVar && flexProseSubUid) {
      const blockHtmls = buffer;
      buffer = [];
      const packed = packRichTextSections(blockHtmls, RteJsonConverter, (v) => ({ [flexProseVar.uid]: { [flexProseSubUid]: v } }));
      if (packed.length) { reserveFlexSlot(); flexVariants.push(...packed); }
      return;
    }
    buffer = []; // no sink declared at all: drop, matching the prior no-op behavior
  };

  const emit = (uid: string, sub: Record<string, any> | null) => {
    if (!sub) return;
    sections.push({ [uid]: sub });
  };

  // Build a hero_section side entry from the page's first cover — whatever it contains. The hero model
  // only has homes for title/subtitle(text)/cta/one image, so anything beyond that (embeds, icons,
  // reusable blocks) has no structural place to go; everything else the cover carries (extra headings,
  // list text, an inner image when the cover itself has no background) is folded in rather than dropped.
  const emitHero = (cover: any): boolean => {
    if (!heroSection) return false;
    const s: any[] = heroSection.variant.schema || [];
    const fileUid = fileSubUid(s);
    const textUids = plainTextSubUids(s);
    const ctaField = s.find((f: any) => f?.data_type === 'global_field' && f?.multiple)
      || s.find((f: any) => f?.data_type === 'global_field');
    // Video embed (e.g. Vidyard) authored inline inside the hero cover — same field-discovery approach
    // used for flexible_layouts' text_video variant, so this works whatever the field is actually named
    // (embed_url, video_url, …) as long as it's a plain text field with one of those words in its uid.
    const embedUrlUid = urlTextSubUid(s);
    const idAttr = Number(cover?.attrs?.id);
    let bg = Number.isFinite(idAttr) && idAttr > 0 ? assetData?.[`assets_${idAttr}`] : undefined;
    if (!bg) bg = resolveAssetByUrl(assetData, cover?.attrs?.url);
    let title = '';
    const subParts: string[] = [];
    const ctas: any[] = [];
    let embedUrl = '';
    for (const lf of Array.from(linearizeContentBlocks(cover?.innerBlocks || []))) {
      const nm = (lf as any)?.blockName;
      if (nm === 'core/heading' && !title) {
        title = stripHtmlTags(serializeBlockToHtml(lf)).replace(/\s+/g, ' ').trim();
      } else if (nm === 'core/heading') {
        // A second+ heading has no dedicated field of its own — fold its text into the subtitle so it
        // still survives, rather than silently dropping it as the old first-heading-only logic did.
        const tx = stripHtmlTags(serializeBlockToHtml(lf)).replace(/\s+/g, ' ').trim();
        if (tx) subParts.push(tx);
      } else if (nm === 'core/paragraph') {
        const tx = stripHtmlTags(serializeBlockToHtml(lf)).replace(/\s+/g, ' ').trim();
        if (tx) subParts.push(tx);
      } else if (nm === 'core/list') {
        const tx = stripHtmlTags(serializeBlockToHtml(lf)).replace(/\s+/g, ' ').trim();
        if (tx) subParts.push(tx);
      } else if (nm === 'core/button') {
        const c = buildCtaGfValue(ctaTypeChoices, lf);
        if (c) ctas.push(c);
      } else if (nm === 'core/image' && !bg) {
        // No background on the cover itself — use the first inline image as the hero image instead of
        // discarding it.
        const imgId = Number((lf as any)?.attrs?.id);
        bg = (Number.isFinite(imgId) && imgId > 0 ? assetData?.[`assets_${imgId}`] : undefined)
          || resolveAssetByUrl(assetData, (lf as any)?.attrs?.url);
      } else if (!embedUrl && WP_BLOCK_TO_SEMANTIC[nm] === 'video_embed') {
        // A video (e.g. Vidyard) authored inside the same cover block used for the hero — previously
        // dropped entirely since the hero builder had no branch for it (only heading/paragraph/list/
        // button/image were recognized). Only used when the target variant declares a field for it.
        const parsed = embedUrlUid ? parseVideoBlock(lf) : null;
        if (parsed?.video_url) embedUrl = parsed.video_url;
      }
    }
    const sub: Record<string, any> = {};
    if (fileUid && bg) sub[fileUid] = bg;
    if (textUids[0] && title) sub[textUids[0]] = title;
    if (textUids[1] && subParts.length) sub[textUids[1]] = subParts.join(' ');
    if (ctaField && ctas.length) sub[ctaField.uid] = ctaField.multiple ? ctas : ctas[0];
    if (embedUrlUid && embedUrl) sub[embedUrlUid] = embedUrl;
    if (!Object.keys(sub).length) return false;
    const heroIndex = heroSeq++;
    const entryUid = idCorrector(`${ctx?.uid || 'entry'}_hero_${heroIndex}`);
    const store = sideStoreFor(ctx, heroSection.def.refCtUid);
    if (store) {
      store[entryUid] = {
        uid: entryUid,
        title: sectionEntryTitle(heroSection.def.refCtUid, 'Hero'),
        [heroSection.vfUid]: [{ [heroSection.variant.uid]: sub }],
        locale: ctx?.locale || 'en-us',
        publish_details: [],
      };
    }
    sections.push({
      [heroSection.def.blockUid]: { [heroSection.def.refField]: [{ uid: entryUid, _content_type_uid: heroSection.def.refCtUid }] },
    });
    heroEmitted = true;
    return true;
  };

  // Speaker-section support: a heading directly before a speaker card labels that speaker group. Only
  // active when the target's speaker block declares a `section_heading` field (event model).
  const speakerDef = defByUid.get('speaker');
  const speakerHasSection = isSpeakerBlock(speakerDef) && blockSubUids(speakerDef).has('section_heading');
  let speakerSection: string | null = null;

  // Blocks whose default heading marks a named section (e.g. exam_details_section ← "Exam guidelines").
  const namedSections = findNamedSections(blocksField);

  // Pattern-group sections: FAQ (a block referencing another content type) and card-grid (a block with a
  // repeating card group). Detected by shape; only active when the target declares such a block AND the
  // WordPress body carries a matching pattern group.
  const faqDef = findFaqSectionDef(blocksField, ctx?.contentTypesByUid);
  const cardGridDef = findCardGridDef(blocksField);
  const peopleGridDef = findPeopleGridDef(blocksField);
  const resourceListDef = findResourceListDef(blocksField);
  // The hero banner is a POSITIONAL role, not a shape: whichever core/cover is literally first in the
  // page is the hero, whatever it contains — later covers are ordinary page content, never a second
  // banner, regardless of how simple they look.
  let firstCoverSeen = false;
  const keepWhole = (block: any): boolean => {
    if (block?.blockName === 'core/cover') {
      const isFirstCover = !firstCoverSeen;
      firstCoverSeen = true;
      return !!heroSection && isFirstCover;
    }
    // A stats-band row (a number heading + label paragraph, repeated across columns) is detected by
    // shape alone, same reasoning as the people-grid row below.
    if (statsSection && isStatsColumns(block)) return true;
    // Same stats-band section, authored with a badge label + paragraph-based number instead of a plain
    // heading — detected by shape alone, same reasoning as isStatsColumns above.
    if (statsSection && isStatsCardColumns(block)) return true;
    // A people-grid row (photo + name + role, repeated across columns) is detected by shape alone, not
    // by the section being named "leadership"/"team" — keep it whole so its column boundaries survive
    // instead of being flattened away like an ordinary layout column.
    if (peopleGridDef && isPeopleGridColumns(block)) return true;
    // A media-text section authored as two columns (image column + text column) instead of one
    // core/group (see isImageTextGroup below) — same target section, detected by shape alone.
    if (flexImageVar && isColumnsImageTextBlock(block)) return true;
    // An all-image row (a decorative icon strip with no accompanying text anywhere) — one combined
    // text_image entry with several images, not N disconnected single-image ones.
    if (flexImageVar && isColumnsAllImages(block)) return true;
    // A row of self-contained heading+bullets "cards", one per column — detected by shape alone, same
    // reasoning as the people-grid row above.
    if (slideCards && isColumnsCardPair(block)) return true;
    // A row of "tier" cards (title + description + 1+ badge icons per column) — detected by shape alone,
    // same reasoning as the plain columns-card-pair row above.
    if (iconCardsDef && isColumnsTierCardPair(block)) return true;
    // A heading/paragraph + button "CTA banner" authored as columns (any column count) — same reasoning
    // as above, checked before the core/group-only gate below since core/columns has no pattern name.
    // An image paired with a quote (portrait/logo beside its attribution) — same visual unit whether
    // authored as one core/group or split across two core/columns — belongs in ONE text_quote entry.
    if (flexQuoteVar && isImageQuotePair(block)) return true;
    if (block?.blockName === 'core/columns') {
      if (flexCtaVar && isGroupTextCta(block)) return true;
      return false;
    }
    if (block?.blockName !== 'core/group') return false;
    const pat = groupPatternName(block).toLowerCase();
    if (faqDef && /faq/.test(pat)) return true;
    // Real authored pattern names for a card-grid vary beyond the literal "card grid" — e.g.
    // "salsa-blocks/action-cards-2-columns" ("Action Cards (2 columns)"). parseCardGridGroup already
    // parses any column set generically (one card per core/column, image+heading+paragraphs each,
    // columns without an image included too) — this only broadens which pattern NAMES route there.
    // Prefer `slideCards` (cards_section) over `cardGridDef`: every content type that actually declares a
    // card-grid block today (course/generic_pages) models it as a REFERENCE to cards_section, which
    // findCardGridDef always skips (it only matches an INLINE card block) — falling through to whatever
    // inline block happens to also look card-shaped (e.g. generic_pages' people_grid_block), silently
    // misrouting every named card-grid pattern into the wrong content type. `cardGridDef` stays as the
    // fallback for a target that genuinely models cards as an inline block instead.
    if ((slideCards || cardGridDef) && /card.?grid|action.?cards?/.test(pat)) return true;
    // An unnamed group (no authored pattern) shaped like image+text is the same section as
    // core/media-text, just authored as a plain group — only checked when nothing more specific claimed
    // this group, so a genuinely named pattern group is never reinterpreted as image+text.
    if (!pat && flexImageVar && isImageTextGroup(block)) return true;
    // Same reasoning for a heading/paragraph + button "CTA banner" authored as a plain group.
    if (!pat && flexCtaVar && isGroupTextCta(block)) return true;
    return false;
  };

  // faq_item entries are separate documents in another content type; collect them in ctx.sideEntries so
  // saveEntry can write entries/<faq_item>/… and reference them here.
  let faqSeq = 0;
  const buildFaqRefs = (group: any): { heading: string; refs: Array<{ uid: string; _content_type_uid: string }> } | null => {
    if (!faqDef) return null;
    const { sectionHeading, items } = parseFaqGroup(group);
    if (!items.length) return null;
    const refs: Array<{ uid: string; _content_type_uid: string }> = [];
    const store = ctx?.sideEntries?.[faqDef.refCtUid] ?? (ctx?.sideEntries ? (ctx.sideEntries[faqDef.refCtUid] = {}) : undefined);
    for (const it of items) {
      const faqUid = idCorrector(`${ctx?.uid || 'faq'}_faq_${faqSeq++}`);
      const answerJson = it.answerHtml && hasMeaningfulHtmlContent(it.answerHtml) ? RteJsonConverter(it.answerHtml) : RteJsonConverter('<p></p>');
      if (store) {
        store[faqUid] = {
          uid: faqUid,
          [faqDef.questionUid]: it.question,
          [faqDef.answerUid]: answerJson,
          locale: ctx?.locale || 'en-us',
          publish_details: [],
        };
      }
      refs.push({ uid: faqUid, _content_type_uid: faqDef.refCtUid });
    }
    return { heading: sectionHeading, refs };
  };

  // People-grid rows are collected across possibly-consecutive `core/columns` blocks (e.g. a leadership
  // section split into two rows of 4) into ONE people_grid_block entry, flushed once a non-matching
  // block breaks the run — mirrors the single-hero / single-flex-entry consolidation used elsewhere.
  let peopleGridCards: Array<Record<string, any>> = [];
  let peopleGridTitle = '';
  const flushPeopleGrid = () => {
    if (!peopleGridDef || !peopleGridCards.length) return;
    const sub: Record<string, any> = { [peopleGridDef.detailsUid]: peopleGridCards };
    if (peopleGridDef.titleUid && peopleGridTitle) sub[peopleGridDef.titleUid] = peopleGridTitle;
    emit(peopleGridDef.blockUid, sub);
    peopleGridCards = [];
    peopleGridTitle = '';
  };

  // Columns-card-pair rows (see isColumnsCardPair) accumulate across consecutive matching `core/columns`
  // blocks into ONE cards_section side entry, mirroring the people-grid consolidation above.
  let columnsCardPairCards: Array<{ title?: string; description?: string }> = [];
  const flushColumnsCardPair = () => {
    if (!slideCards || !columnsCardPairCards.length) return;
    const cards = columnsCardPairCards
      .map((it) => {
        const card: Record<string, any> = {};
        if (slideCards!.titleUid && it.title) card[slideCards!.titleUid] = it.title;
        if (slideCards!.descUid && it.description) card[slideCards!.descUid] = it.description;
        return card;
      })
      .filter((c) => Object.keys(c).length);
    columnsCardPairCards = [];
    if (!cards.length) return;
    const cardsIndex = slideCardsSeq++;
    const entryUid = idCorrector(`${ctx?.uid || 'entry'}_cards_${cardsIndex}`);
    const store = sideStoreFor(ctx, slideCards.def.refCtUid);
    if (store) {
      store[entryUid] = {
        uid: entryUid,
        title: sectionEntryTitle(slideCards.def.refCtUid, 'Cards'),
        [slideCards.vfUid]: [{ [slideCards.variantUid]: { [slideCards.cardsUid]: cards } }],
        locale: ctx?.locale || 'en-us',
        publish_details: [],
      };
    }
    sections.push({
      [slideCards.def.blockUid]: {
        [slideCards.def.refField]: [{ uid: entryUid, _content_type_uid: slideCards.def.refCtUid }],
      },
    });
  };

  // Tier-card-pair rows (see isColumnsTierCardPair) accumulate across consecutive matching `core/columns`
  // blocks into ONE cards_section side entry, same consolidation as columns-card-pair above.
  let tierCardPairCards: Array<{ title?: string; description?: string; icons: any[] }> = [];
  const flushTierCardPair = () => {
    if (!iconCardsDef || !tierCardPairCards.length) return;
    const cards = tierCardPairCards
      .map((it) => {
        const card: Record<string, any> = {};
        if (iconCardsDef!.titleUid && it.title) card[iconCardsDef!.titleUid] = it.title;
        if (iconCardsDef!.subtitleUid && it.description) card[iconCardsDef!.subtitleUid] = it.description;
        if (it.icons.length) card[iconCardsDef!.iconUid] = it.icons;
        return card;
      })
      .filter((c) => Object.keys(c).length);
    tierCardPairCards = [];
    if (!cards.length) return;
    const cardsIndex = slideCardsSeq++;
    const entryUid = idCorrector(`${ctx?.uid || 'entry'}_cards_${cardsIndex}`);
    const store = sideStoreFor(ctx, iconCardsDef.def.refCtUid);
    if (store) {
      store[entryUid] = {
        uid: entryUid,
        title: sectionEntryTitle(iconCardsDef.def.refCtUid, 'Cards'),
        [iconCardsDef.vfUid]: [{ [iconCardsDef.variantUid]: { [iconCardsDef.cardsUid]: cards } }],
        locale: ctx?.locale || 'en-us',
        publish_details: [],
      };
    }
    sections.push({
      [iconCardsDef.def.blockUid]: {
        [iconCardsDef.def.refField]: [{ uid: entryUid, _content_type_uid: iconCardsDef.def.refCtUid }],
      },
    });
  };

  // A jump-nav section (see extractJumpNavTabs) is built once, up front — its content spans multiple
  // blocks the main loop below would otherwise process individually, so those blocks are pre-marked to
  // be skipped and the whole tabs entry is emitted the first time one of them is reached (preserving its
  // position in document order).
  let tabsEmitted = false;
  let gutenaTabsSeq = 0;
  const emitJumpNavTabs = () => {
    if (!jumpNavTabs || !tabSectionDef) return;
    const tabsSide = jumpNavTabs.tabs
      .map((tab) => {
        const jUid = jsonSubUid(tabSectionDef.variant.schema);
        const variantSub: Record<string, any> = {};
        if (jUid && hasMeaningfulHtmlContent(tab.html)) variantSub[jUid] = RteJsonConverter(tab.html);
        const tabSub: Record<string, any> = { [tabSectionDef.tabTitleUid]: tab.title };
        if (Object.keys(variantSub).length) tabSub[tabSectionDef.variantsUid] = [{ [tabSectionDef.variant.uid]: variantSub }];
        return { [tabSectionDef.tabBlockUid]: tabSub };
      })
      .filter((t) => {
        const sub = t[tabSectionDef.tabBlockUid];
        return sub[tabSectionDef.tabTitleUid] || (sub[tabSectionDef.variantsUid] || []).length;
      });
    if (!tabsSide.length) return;
    const entryUid = idCorrector(`${ctx?.uid || 'entry'}_tabs_0`);
    const store = sideStoreFor(ctx, tabSectionDef.def.refCtUid);
    if (store) {
      store[entryUid] = {
        uid: entryUid,
        title: sectionEntryTitle(tabSectionDef.def.refCtUid, 'Tabs'),
        [tabSectionDef.tabsUid]: tabsSide,
        locale: ctx?.locale || 'en-us',
        publish_details: [],
      };
    }
    sections.push({
      [tabSectionDef.def.blockUid]: { [tabSectionDef.def.refField]: [{ uid: entryUid, _content_type_uid: tabSectionDef.def.refCtUid }] },
    });
  };

  const lin = Array.from(linearizeContentBlocks(blocks, keepWhole));
  for (let i = 0; i < lin.length; i++) {
    const raw = lin[i];
    const name = raw?.blockName;
    const semantic = WP_BLOCK_TO_SEMANTIC[name];

    // Already folded into a declared field by HEADING_SOURCED_FIELDS (e.g. quick_facts / key_takeaways):
    // drop it here so the same run isn't duplicated as ordinary prose in the body.
    if (ctx?.consumedBlocks?.has(raw)) continue;

    // Jump-nav section content (see extractJumpNavTabs) — consumed wholesale into ONE tabs entry the
    // first time any of its blocks is reached; every other block in the run is silently skipped.
    if (jumpNavTabs?.consumed.has(raw)) {
      if (!tabsEmitted) {
        flush();
        emitJumpNavTabs();
        tabsEmitted = true;
      }
      continue;
    }

    // A real gutena/tabs block (see parseGutenaTabs) → its own tabs entry, same mechanism jump-nav tabs
    // use above. Each tab's content becomes that tab's prose body instead of every tab running together
    // in one undifferentiated rich_text chunk with no tab boundaries.
    if (name === 'gutena/tabs' && tabSectionDef) {
      const tabs = parseGutenaTabs(raw);
      const tabsSide = tabs
        .map((tab) => {
          const jUid = jsonSubUid(tabSectionDef.variant.schema);
          const variantSub: Record<string, any> = {};
          if (jUid && hasMeaningfulHtmlContent(tab.html)) variantSub[jUid] = RteJsonConverter(tab.html);
          const tabSub: Record<string, any> = { [tabSectionDef.tabTitleUid]: tab.title };
          if (Object.keys(variantSub).length) tabSub[tabSectionDef.variantsUid] = [{ [tabSectionDef.variant.uid]: variantSub }];
          return { [tabSectionDef.tabBlockUid]: tabSub };
        })
        .filter((t) => {
          const sub = t[tabSectionDef.tabBlockUid];
          return sub[tabSectionDef.tabTitleUid] || (sub[tabSectionDef.variantsUid] || []).length;
        });
      if (tabsSide.length) {
        flush();
        const entryUid = idCorrector(`${ctx?.uid || 'entry'}_gtabs_${gutenaTabsSeq++}`);
        const store = sideStoreFor(ctx, tabSectionDef.def.refCtUid);
        if (store) {
          store[entryUid] = {
            uid: entryUid,
            title: sectionEntryTitle(tabSectionDef.def.refCtUid, 'Tabs'),
            [tabSectionDef.tabsUid]: tabsSide,
            locale: ctx?.locale || 'en-us',
            publish_details: [],
          };
        }
        sections.push({
          [tabSectionDef.def.blockUid]: { [tabSectionDef.def.refField]: [{ uid: entryUid, _content_type_uid: tabSectionDef.def.refCtUid }] },
        });
        speakerSection = null;
        continue;
      }
    }

    // Hero-shaped cover (kept whole by linearize above) → its own hero_section reference. Falls back to
    // buffering the overlay content so nothing is lost when no usable hero fields parse.
    if (name === 'core/cover' && heroSection) {
      flush();
      if (heroEmitted || !emitHero(raw)) {
        // Hero couldn't be built — keep the cover's background as well as its overlay content, so
        // nothing the block carried is dropped on the fallback path.
        const bgUrl = String(raw?.attrs?.url ?? '').trim();
        if (bgUrl) buffer.push(`<img src="${bgUrl}" alt="" />`);
        for (const ib of Array.from(linearizeContentBlocks(raw?.innerBlocks || []))) {
          const h = serializeBlockToHtml(ib);
          if (h && h.trim()) buffer.push(h);
        }
      }
      speakerSection = null;
      continue;
    }

    // Stats-band row (kept whole by linearize above because it matched the shape) → its own stats_section
    // reference entry, the same mechanism hero_section uses.
    if (name === 'core/columns' && statsSection && isStatsColumns(raw)) {
      if (emitStatsSection(parseStatsColumns(raw))) { speakerSection = null; continue; }
    }
    // Same section authored with a badge label above a paragraph-based number (isStatsCardColumns) —
    // checked after the plain heading-based shape above so a genuinely simpler stats row is never
    // reparsed through the badge-aware path.
    if (name === 'core/columns' && statsSection && !isStatsColumns(raw) && isStatsCardColumns(raw)) {
      if (emitStatsSection(parseStatsCardColumns(raw))) { speakerSection = null; continue; }
    }

    // People-grid row (kept whole by linearize above because it matched the shape) → accumulate its
    // cards; consecutive rows (e.g. a leadership section split across two `core/columns` blocks) merge
    // into ONE people_grid_block entry, flushed by the fallback below once a non-matching block breaks
    // the run.
    if (name === 'core/columns' && peopleGridDef && isPeopleGridColumns(raw)) {
      const cards = parsePeopleGridCards(raw);
      if (cards.length) {
        if (!peopleGridCards.length) {
          // Reclaim a trailing heading from the buffer as this grid's title, same as card-grid does.
          for (let k = buffer.length - 1; k >= 0; k--) {
            if (/^\s*<h[1-6]/i.test(buffer[k])) {
              peopleGridTitle = stripHtmlTags(buffer[k]).replace(/\s+/g, ' ').trim();
              buffer = buffer.slice(0, k);
              break;
            }
          }
          flush();
        }
        for (const c of cards) {
          const cardVal: Record<string, any> = {};
          const asset = c.thumbnailId != null ? assetData?.[`assets_${c.thumbnailId}`] : undefined;
          if (peopleGridDef.thumbnailUid && asset) cardVal[peopleGridDef.thumbnailUid] = asset;
          if (peopleGridDef.nameUid && c.name) cardVal[peopleGridDef.nameUid] = c.name;
          if (peopleGridDef.designationUid && c.designation) cardVal[peopleGridDef.designationUid] = c.designation;
          if (Object.keys(cardVal).length) peopleGridCards.push(cardVal);
        }
        speakerSection = null;
        continue;
      }
    }
    if (peopleGridCards.length) flushPeopleGrid();

    // Columns-card-pair row (kept whole by linearize above because it matched the shape) → each column
    // becomes one card; consecutive rows (e.g. a 2x2 "Benefits of..." grid split across two `core/columns`
    // blocks) merge into ONE cards_section entry, flushed by the fallback below once a non-matching block
    // breaks the run — same consolidation people-grid uses above.
    if (name === 'core/columns' && slideCards && isColumnsCardPair(raw)) {
      const cards = parseColumnsCardPair(raw);
      if (cards.length) {
        columnsCardPairCards.push(...cards);
        speakerSection = null;
        continue;
      }
    }
    if (columnsCardPairCards.length) flushColumnsCardPair();

    // Tier-card-pair row (kept whole by linearize above because it matched the shape) → each column
    // becomes one card with its badge icons; consecutive rows merge into ONE cards_section entry, same
    // consolidation as columns-card-pair above.
    if (name === 'core/columns' && iconCardsDef && isColumnsTierCardPair(raw)) {
      const cards = parseColumnsTierCardPair(raw, assetData);
      if (cards.length) {
        tierCardPairCards.push(...cards);
        speakerSection = null;
        continue;
      }
    }
    if (tierCardPairCards.length) flushTierCardPair();

    // Marketo / embed form → the inline marketo_form block (form id read from the block's inner markup).
    // An accordion is a list of heading + body items — the same shape as a card grid. Route it to the
    // plain cards section so each row becomes a card, instead of flattening the whole widget (and its
    // expand/collapse chrome) into rich text.
    if (simpleCards && /accordion$/i.test(String(name ?? ''))) {
      const items = parseAccordionBlock(raw);
      // Images would need a file field we can't fill from a URL; decline rather than lose them.
      if (items.length && !items.some((i) => i.hasImage)) {
        const cards = items
          .map((i) => {
            const card: Record<string, any> = {};
            if (simpleCards.titleUid && i.title) card[simpleCards.titleUid] = i.title;
            if (simpleCards.subtitleUid) {
              const text = stripHtmlTags(i.bodyHtml).replace(/\s+/g, ' ').trim();
              if (text) card[simpleCards.subtitleUid] = text;
            }
            if (simpleCards.ctaUid && i.links.length) {
              const value = i.links.map((l) => ({ title_url: { title: l.label, href: l.href }, open_in_new_tab: false }));
              card[simpleCards.ctaUid] = simpleCards.ctaMultiple ? value : value[0];
            }
            return card;
          })
          .filter((c) => Object.keys(c).length);
        if (cards.length) {
          flush();
          const entryUid = idCorrector(`${ctx?.uid || 'entry'}_accordion_${accordionSeq++}`);
          const store = sideStoreFor(ctx, simpleCards.def.refCtUid);
          if (store) {
            store[entryUid] = {
              uid: entryUid,
              title: sectionEntryTitle(simpleCards.def.refCtUid, 'Cards'),
              [simpleCards.vfUid]: [{ [simpleCards.variantUid]: { [simpleCards.cardsUid]: cards } }],
              locale: ctx?.locale || 'en-us',
              publish_details: [],
            };
          }
          sections.push({
            [simpleCards.def.blockUid]: {
              [simpleCards.def.refField]: [{ uid: entryUid, _content_type_uid: simpleCards.def.refCtUid }],
            },
          });
          speakerSection = null;
          continue;
        }
      }
    }

    // The Gutenslider plugin block (eedee/block-gutenslider) is a real carousel — each slide is a
    // core/cover background image plus a heading/paragraph/button, not a testimonial-shaped card. Route
    // it to the dedicated carousel content type identified by refCtUid rather than letting it fall
    // through to the generic slider→cards_section path (which most CTs carrying this block, like
    // generic_pages, don't even expose) or collapsing whole into rich_text.
    if (carouselCardDef && /gutenslider$/i.test(String(name ?? ''))) {
      const slides = parseGutensliderCarousel(raw, assetData);
      if (slides.length) {
        flush();
        const cards = slides
          .map((s) => {
            const card: Record<string, any> = {};
            if (carouselCardDef.titleUid && s.title) card[carouselCardDef.titleUid] = s.title;
            if (carouselCardDef.subtitleUid && s.subtitle) card[carouselCardDef.subtitleUid] = s.subtitle;
            if (carouselCardDef.iconUid && s.icon) card[carouselCardDef.iconUid] = s.icon;
            if (carouselCardDef.ctaUid && s.cta) {
              const value = { title_url: { title: s.cta.title, href: s.cta.href }, open_in_new_tab: false };
              card[carouselCardDef.ctaUid] = carouselCardDef.ctaMultiple ? [value] : value;
            }
            return card;
          })
          .filter((c) => Object.keys(c).length);
        if (cards.length) {
          const entryUid = idCorrector(`${ctx?.uid || 'entry'}_carousel_${carouselSeq++}`);
          const store = sideStoreFor(ctx, carouselCardDef.def.refCtUid);
          if (store) {
            store[entryUid] = {
              uid: entryUid,
              title: sectionEntryTitle(carouselCardDef.def.refCtUid, 'Carousel'),
              [carouselCardDef.vfUid]: [{ [carouselCardDef.variantUid]: { [carouselCardDef.cardsUid]: cards } }],
              locale: ctx?.locale || 'en-us',
              publish_details: [],
            };
          }
          sections.push({
            [carouselCardDef.def.blockUid]: {
              [carouselCardDef.def.refField]: [{ uid: entryUid, _content_type_uid: carouselCardDef.def.refCtUid }],
            },
          });
          speakerSection = null;
          continue;
        }
      }
    }

    // A slider is a carousel of testimonial slides — route it to the sliding-cards section rather than
    // letting the whole carousel flatten into rich text (which also buries the quotes inside it).
    if (slideCards && /slider$|carousel$/i.test(String(name ?? ''))) {
      const slides = parseSliderBlock(raw);
      // A card's image is a FILE field and can't hold a URL. If any slide carries an image whose asset
      // wasn't downloaded, decline the card routing entirely so the slider degrades to rich text with
      // its <img> intact — the same rule used for media-text and core/image.
      const imagesResolvable = slides.every((s) =>
        s.images.every((im) => {
          const byId = im.id != null ? assetData?.[`assets_${im.id}`] : undefined;
          return Boolean(byId || resolveAssetByUrl(assetData, im.src));
        }),
      );
      if (slides.length && imagesResolvable) {
        // When every slide repeats the same heading it is the SECTION's title, not a per-card one
        // (e.g. "How companies are harnessing business agility" on all four slides).
        const headings = slides.map((s) => s.title).filter(Boolean) as string[];
        const sharedHeading =
          headings.length === slides.length && new Set(headings).size === 1 ? headings[0] : undefined;
        const cards = slides
          .map((s) => {
            const card: Record<string, any> = {};
            if (slideCards.titleUid && s.title && !sharedHeading) card[slideCards.titleUid] = s.title;
            if (slideCards.subtitleUid && s.body) card[slideCards.subtitleUid] = s.body;
            if (slideCards.descUid && s.attribution) card[slideCards.descUid] = s.attribution;
            // A slide's button becomes the card's cta, so its href isn't lost when the slide is no
            // longer rendered as rich text.
            if (slideCards.ctaUid && s.links.length) {
              const value = s.links.map((l) => ({
                title_url: { title: l.label, href: l.href },
                open_in_new_tab: false,
              }));
              card[slideCards.ctaUid] = slideCards.ctaMultiple ? value : value[0];
            }
            if (slideCards.imageUid && s.images.length) {
              const im = s.images[0];
              const asset =
                (im.id != null ? assetData?.[`assets_${im.id}`] : undefined) ||
                resolveAssetByUrl(assetData, im.src);
              if (asset) card[slideCards.imageUid] = asset;
            }
            return card;
          })
          .filter((c) => Object.keys(c).length);
        if (cards.length) {
          flush();
          const cardsIndex = slideCardsSeq++;
          const entryUid = idCorrector(`${ctx?.uid || 'entry'}_cards_${cardsIndex}`);
          const store = sideStoreFor(ctx, slideCards.def.refCtUid);
          if (store) {
            store[entryUid] = {
              uid: entryUid,
              title: sectionEntryTitle(slideCards.def.refCtUid, 'Cards'),
              [slideCards.vfUid]: [{ [slideCards.variantUid]: { [slideCards.cardsUid]: cards } }],
              locale: ctx?.locale || 'en-us',
              publish_details: [],
            };
          }
          sections.push({
            [slideCards.def.blockUid]: {
              [slideCards.def.refField]: [{ uid: entryUid, _content_type_uid: slideCards.def.refCtUid }],
            },
          });
          speakerSection = null;
          continue;
        }
      }
    }

    if (name === 'salsa-blocks/marketo-form' && formDef) {
      const id = serializeBlockToHtml(raw).match(/form-?id=["']?(\d+)/i)?.[1];
      if (id) {
        flush();
        sections.push({ [formDef.blockUid]: { [formDef.formIdUid]: id } });
        speakerSection = null;
        continue;
      }
    }

    // core/html embeds raw Marketo forms2 snippets (mktoForm div/id + MktoForms2.loadForm(...) script)
    // rather than the salsa-blocks/marketo-form block. Route those to the same marketo_form block instead
    // of letting them fall through to rich_text as inert <script>/<form> markup.
    if (name === 'core/html' && formDef) {
      const html = serializeBlockToHtml(raw);
      const id =
        html.match(/MktoForms2\.loadForm\(\s*["'][^"']*["']\s*,\s*["'][^"']*["']\s*,\s*["']?(\d+)["']?\s*\)/i)?.[1] ||
        html.match(/mktoForm[_-](\d+)/i)?.[1];
      if (id) {
        flush();
        sections.push({ [formDef.blockUid]: { [formDef.formIdUid]: id } });
        speakerSection = null;
        continue;
      }
    }

    // Pattern group kept intact by linearize (FAQ / card-grid). Route it to its declared block.
    if (name === 'core/group' && keepWhole(raw)) {
      const pat = groupPatternName(raw).toLowerCase();
      if (faqDef && /faq/.test(pat)) {
        flush();
        const built = buildFaqRefs(raw);
        if (built && built.refs.length) {
          const sub: Record<string, any> = { [faqDef.refField]: built.refs };
          if (faqDef.headingUid && built.heading) sub[faqDef.headingUid] = built.heading;
          emit(faqDef.blockUid, sub);
        }
        speakerSection = null;
        continue;
      }
      if (slideCards && /card.?grid|action.?cards?/.test(pat)) {
        flush();
        const cardsRaw = parseCardGridGroup(raw);
        if (cardsRaw.length) {
          // The card-grid section's heading/intro live in the blocks just before the group. Reclaim a
          // trailing heading (and an intro paragraph under it) from the rich-text buffer — the heading
          // becomes the section's own subtitle (title stays collision-safe, see sectionEntryTitle) and
          // the intro folds back into the surrounding prose, since cards_section has no field for it.
          let heading = '';
          let introHtml = '';
          for (let k = buffer.length - 1; k >= 0; k--) {
            if (/^\s*<h[1-6]/i.test(buffer[k])) {
              heading = stripHtmlTags(buffer[k]).replace(/\s+/g, ' ').trim();
              introHtml = buffer.slice(k + 1).join('');
              buffer = buffer.slice(0, k);
              break;
            }
          }
          flush();
          if (introHtml && hasMeaningfulHtmlContent(introHtml)) buffer.push(introHtml);
          const cards = cardsRaw.map((c) => {
            const card: Record<string, any> = {};
            if (slideCards.titleUid && c.title) card[slideCards.titleUid] = c.title;
            const descText = c.descHtml ? stripHtmlTags(c.descHtml).replace(/\s+/g, ' ').trim() : '';
            if (slideCards.descUid && descText) card[slideCards.descUid] = descText;
            if (slideCards.imageUid && c.iconId != null) {
              const asset = assetData?.[`assets_${c.iconId}`];
              if (asset) card[slideCards.imageUid] = asset;
            }
            if (slideCards.ctaUid && c.link) {
              const value = { title_url: { title: c.link.title, href: c.link.href }, open_in_new_tab: false };
              card[slideCards.ctaUid] = slideCards.ctaMultiple ? [value] : value;
            }
            return card;
          }).filter((c) => Object.keys(c).length);
          if (cards.length) {
            const cardsIndex = slideCardsSeq++;
            const entryUid = idCorrector(`${ctx?.uid || 'entry'}_cards_${cardsIndex}`);
            const store = sideStoreFor(ctx, slideCards.def.refCtUid);
            if (store) {
              const topSchema: any[] = Array.isArray(slideCards.def.refCt?.schema) ? slideCards.def.refCt.schema : [];
              const topSubtitleUid = topSchema.find((f: any) => f?.data_type === 'text' && !f?.enum && f?.uid !== 'title')?.uid;
              store[entryUid] = {
                uid: entryUid,
                title: sectionEntryTitle(slideCards.def.refCtUid, 'Cards'),
                ...(topSubtitleUid && heading ? { [topSubtitleUid]: heading } : {}),
                [slideCards.vfUid]: [{ [slideCards.variantUid]: { [slideCards.cardsUid]: cards } }],
                locale: ctx?.locale || 'en-us',
                publish_details: [],
              };
            }
            sections.push({
              [slideCards.def.blockUid]: {
                [slideCards.def.refField]: [{ uid: entryUid, _content_type_uid: slideCards.def.refCtUid }],
              },
            });
          }
        }
        speakerSection = null;
        continue;
      }
      // Fallback for a target that genuinely declares cards as an INLINE block (no cards_section
      // reference at all, so `slideCards` never resolved) — findCardGridDef's own shape match applies.
      if (!slideCards && cardGridDef && /card.?grid|action.?cards?/.test(pat)) {
        flush();
        const cards = parseCardGridGroup(raw);
        if (cards.length) {
          // The card-grid section's heading/intro live in the blocks just before the group. Reclaim a
          // trailing heading (and an intro paragraph under it) from the rich-text buffer.
          let heading = '';
          let introHtml = '';
          // Look back: last buffered heading = card-grid heading; content right after it = intro.
          for (let k = buffer.length - 1; k >= 0; k--) {
            if (/^\s*<h[1-6]/i.test(buffer[k])) {
              heading = stripHtmlTags(buffer[k]).replace(/\s+/g, ' ').trim();
              introHtml = buffer.slice(k + 1).join('');
              buffer = buffer.slice(0, k);
              break;
            }
          }
          flush();
          const sub: Record<string, any> = {};
          if (cardGridDef.headingUid && heading) sub[cardGridDef.headingUid] = heading;
          if (cardGridDef.introUid && introHtml && hasMeaningfulHtmlContent(introHtml)) sub[cardGridDef.introUid] = RteJsonConverter(introHtml);
          sub[cardGridDef.cardsUid] = cards.map((c) => {
            const card: Record<string, any> = {};
            if (cardGridDef.titleUid && c.title) card[cardGridDef.titleUid] = c.title;
            if (cardGridDef.descUid && c.descHtml && hasMeaningfulHtmlContent(c.descHtml)) card[cardGridDef.descUid] = RteJsonConverter(c.descHtml);
            if (cardGridDef.iconUid && c.iconId != null) {
              const asset = assetData?.[`assets_${c.iconId}`];
              if (asset) card[cardGridDef.iconUid] = asset;
            }
            if (cardGridDef.linkUid && c.link) card[cardGridDef.linkUid] = c.link;
            return card;
          }).filter((c) => Object.keys(c).length);
          if (sub[cardGridDef.cardsUid].length) emit(cardGridDef.blockUid, sub);
        }
        speakerSection = null;
        continue;
      }
    }

    // Named section: a heading whose text matches a declared block's default heading routes the content
    // that follows (up to the next same-or-higher heading) into THAT block's rich-text slot, with the
    // heading carried over. Schema-driven — the trigger and target come from the block definition.
    if (name === 'core/heading' && namedSections.length) {
      const headingText = stripHtmlTags(serializeBlockToHtml(raw)).replace(/\s+/g, ' ').trim();
      const section = namedSections.find((ns) => ns.headingKey === normalizeHeadingKey(headingText));
      if (section) {
        flush();
        const markerLevel = wpHeadingLevel(raw);
        const parts: string[] = [];
        let j = i + 1;
        for (; j < lin.length; j++) {
          const nb = lin[j];
          if (nb?.blockName === 'core/heading' && wpHeadingLevel(nb) <= markerLevel) break;
          const h = serializeBlockToHtml(nb);
          if (h && h.trim()) parts.push(h);
        }
        i = j - 1; // consume the collected blocks
        const html = parts.join('');
        const sub: Record<string, any> = {};
        if (headingText) sub[section.headingUid] = headingText;
        if (hasMeaningfulHtmlContent(html)) {
          const value = section.slot.json ? RteJsonConverter(html) : normalizeHtmlFragment(html);
          if (value) sub[section.slot.uid] = value;
        }
        emit(section.blockUid, Object.keys(sub).length ? sub : null);
        speakerSection = null;
        continue;
      }
    }

    // A heading immediately followed by a speaker card is that group's label: capture it and drop the
    // heading (it must not become a stray rich_text). Other headings fall through to normal handling.
    if (name === 'core/heading' && speakerHasSection && lin[i + 1]?.blockName === 'core/media-text') {
      flush();
      speakerSection = stripHtmlTags(serializeBlockToHtml(raw)).replace(/\s+/g, ' ').trim() || null;
      continue;
    }

    if (semantic === 'heading' && defByUid.has('heading')) { flush(); emit('heading', buildHeadingSubBlock(defByUid.get('heading'), raw)); speakerSection = null; continue; }
    if (semantic === 'quote' && defByUid.has('quote')) { flush(); emit('quote', buildQuoteSubBlock(defByUid.get('quote'), raw)); speakerSection = null; continue; }
    if (semantic === 'video_embed' && defByUid.has('video_embed')) { flush(); emit('video_embed', buildVideoEmbedSubBlock(defByUid.get('video_embed'), raw)); speakerSection = null; continue; }
    if (semantic === 'cta_section' && ctaResolved) {
      flush();
      const cta = ctaResolved.mode === 'global_field'
        ? buildCtaGlobalFieldBlock(ctaResolved.def, raw)
        : buildCtaSubBlock(ctaResolved.def, raw);
      emit(ctaResolved.def.uid, cta);
      speakerSection = null;
      continue;
    }
    // A standalone button with no declared top-level CTA block on the target (e.g. event_revised's
    // "Register now") — route it into the flex section's text_cta-shaped variant instead of letting it
    // flatten into an inert <a> inside rich text.
    if (semantic === 'cta_section' && !ctaResolved && flexSection && flexCtaVar) {
      const c = buildCtaGfValue(ctaTypeChoices, raw);
      if (c) {
        const s: any[] = flexCtaVar.schema || [];
        const gf = s.find((f: any) => f?.data_type === 'global_field' && f?.multiple) || s.find((f: any) => f?.data_type === 'global_field');
        if (gf) {
          flush();
          reserveFlexSlot();
          flexVariants.push({ [flexCtaVar.uid]: { [gf.uid]: gf.multiple ? [c] : c } });
          speakerSection = null;
          continue;
        }
      }
    }
    // media-text is NOT in the global semantic map (it means different things per model); route it to
    // speaker ONLY when the target declares a speaker-shaped block — today just the event model. Every
    // other target falls through to the default and folds media-text into rich_text as before.
    if (name === 'core/media-text' && isSpeakerBlock(speakerDef)) {
      flush();
      const spk = buildSpeakerSubBlock(speakerDef, raw, assetData);
      if (spk && speakerSection && speakerHasSection) spk.section_heading = speakerSection;
      emit('speaker', spk);
      continue; // keep speakerSection so consecutive cards in the same group inherit it
    }
    if (semantic === 'spacer' && defByUid.has('spacer')) { flush(); emit('spacer', buildSpacerSubBlock(defByUid.get('spacer'), raw)); continue; } // spacer doesn't break a speaker group
    if (name === 'core/spacer' || name === 'core/separator') continue; // pure spacing, not declared → drop

    // A reusable/synced pattern block (core/block) whose override content is a "col N text"/"col N btn"
    // resource list (e.g. course pages' "Resources for Future Agile Product Managers") — an inline named
    // block on THIS content type (resource_list), not a reference-section, so it's checked independently
    // of flexSection/flexImageVar and emitted the same way heading/quote/speaker are above. Checked before
    // the flexSection-gated core/block checks below so this shape (which also has numbered labels) is
    // never misread as a generic card-set or image+text block.
    if (name === 'core/block' && resourceListDef) {
      const parsed = parseCoreBlockResourceList(raw?.attrs?.content);
      if (parsed) {
        const resources = parsed.resources
          .map((r) => {
            const item: Record<string, any> = {};
            if (resourceListDef.titleUid && r.title) item[resourceListDef.titleUid] = r.title;
            if (resourceListDef.descUid && r.description) item[resourceListDef.descUid] = r.description;
            if (resourceListDef.linkUid && r.url) {
              item[resourceListDef.linkUid] = { title: r.linkLabel || 'Read More', href: r.url };
            }
            return item;
          })
          .filter((it) => Object.keys(it).length);
        if (resources.length) {
          flush();
          if (parsed.leadHtml && hasMeaningfulHtmlContent(parsed.leadHtml)) buffer.push(parsed.leadHtml);
          const sub: Record<string, any> = { [resourceListDef.resourcesUid]: resources };
          if (resourceListDef.headingUid && parsed.heading) sub[resourceListDef.headingUid] = parsed.heading;
          emit(resourceListDef.blockUid, sub);
          speakerSection = null;
          continue;
        }
      }
    }

    const html = serializeBlockToHtml(raw);

    // Typed flexible_layouts variants — only for targets whose body is reference-sections (no flat
    // rich_text block). Each falls back to the prose buffer when it can't be built, so nothing is lost.
    if (flexSection) {
      // core/media-text is an image beside a text column — that IS the text_image section. Route it to
      // the image variant (asset + title + rich-text body + alignment) instead of letting it fall into
      // the prose sink, where the layout markup would be flattened into undifferentiated rich text.
      // Shared by core/media-text AND a plain core/group shaped the same way (image + text column):
      // build the text_image sub-object, emitting it ONLY when the media resolved to a real asset — a
      // file field can't hold a bare URL, so emitting without one would silently drop the image; falling
      // through to prose instead keeps the original <img src> (and the text) intact.
      const emitImageTextVariant = (parsed: { asset?: any; imgSrc?: string; title?: string; bodyHtml: string }, sourceBlock: any): boolean => {
        const s: any[] = flexImageVar.schema || [];
        const fUid = fileSubUid(s);
        const jUid = jsonSubUid(s);
        const textUids = plainTextSubUids(s);
        // NB `alig` not `align`: the authored model spells this field `image_aligment` (sic), so a
        // stricter pattern would silently never match.
        const alignField = s.find((f: any) => f?.data_type === 'text' && f?.enum && /alig/i.test(f?.uid || ''));
        const sub: Record<string, any> = {};
        if (fUid && parsed.asset) sub[fUid] = parsed.asset;
        // A file field can't hold a bare URL, so an image whose asset was never downloaded (the source
        // media export doesn't cover every referenced upload) leaves `image` unset. Keep the structured
        // text_image block anyway and carry the original <img src> into the rich-text body, so the layout
        // survives and the image URL is still recoverable — rather than degrading the whole section to
        // undifferentiated prose. Only decline when there is genuinely nothing to place.
        let bodyHtml = parsed.bodyHtml;
        if (!sub[fUid] && parsed.imgSrc) {
          bodyHtml = `<img src="${parsed.imgSrc}" alt="" />${bodyHtml}`;
        }
        let title = parsed.title;
        // A heading sitting directly above this block (e.g. an author-bio "About Jane Doe" heading over
        // a media-text card) is its title, not unrelated prose — reclaim it from the buffer the same way
        // people-grid/card-grid already do, rather than letting it flush into the prior rich_text chunk.
        if (!title) {
          for (let k = buffer.length - 1; k >= 0; k--) {
            if (/^\s*<h[1-6]/i.test(buffer[k])) {
              title = stripHtmlTags(buffer[k]).replace(/\s+/g, ' ').trim();
              buffer = buffer.slice(0, k);
              break;
            }
            if (hasMeaningfulHtmlContent(buffer[k])) break; // real prose in between — not this block's heading
          }
        }
        if (textUids[0] && title) sub[textUids[0]] = title;
        if (jUid && hasMeaningfulHtmlContent(bodyHtml)) sub[jUid] = RteJsonConverter(bodyHtml);
        if (!Object.keys(sub).length) return false; // nothing resolved at all — let it fall through to prose
        const align = alignmentChoiceFor(sourceBlock, alignField, { defaultLeft: true });
        if (align) sub[alignField.uid] = align;
        flush();
        reserveFlexSlot(); flexVariants.push({ [flexImageVar.uid]: sub });
        speakerSection = null;
        return true;
      };
      // Builds the text_cta variant (see isGroupTextCta/parseGroupTextCta) — a heading/paragraph plus one
      // or more buttons authored as one visual unit, kept together instead of split into a rich_text
      // chunk plus a separate titleless CTA.
      const emitTextCtaVariant = (parsed: { title?: string; bodyHtml: string; ctas: Array<{ label: string; href: string; newTab: boolean }> }): boolean => {
        if (!flexCtaVar) return false;
        const s: any[] = flexCtaVar.schema || [];
        const textUids = plainTextSubUids(s);
        const jUid = jsonSubUid(s);
        const gf = s.find((f: any) => f?.data_type === 'global_field' && referenceTargets(f).includes('cta'));
        const sub: Record<string, any> = {};
        if (textUids[0] && parsed.title) sub[textUids[0]] = parsed.title;
        if (jUid && hasMeaningfulHtmlContent(parsed.bodyHtml)) sub[jUid] = RteJsonConverter(parsed.bodyHtml);
        if (gf && parsed.ctas.length) {
          const primary = ctaTypeChoices.find((c) => /primary/i.test(c)) || ctaTypeChoices[0];
          const values = parsed.ctas.map((c) => ({
            title_url: { title: c.label, href: c.href },
            open_in_new_tab: c.newTab,
            ...(primary ? { type: primary } : {}),
          }));
          sub[gf.uid] = gf.multiple ? values : values[0];
        }
        if (!Object.keys(sub).length) return false;
        flush();
        reserveFlexSlot(); flexVariants.push({ [flexCtaVar.uid]: sub });
        speakerSection = null;
        return true;
      };
      // A reusable/synced pattern block (core/block) whose override content is a repeating set of
      // heading+description pairs (e.g. course pages' "Who is this certification for?" audience cards)
      // is a card set, not a single image+text block — route it to cards_section instead. Checked before
      // the plain image+text core/block case below so a multi-pair block is never misread as one card.
      if (name === 'core/block' && slideCards) {
        const cardSet = parseCoreBlockCardContent(raw?.attrs?.content);
        if (cardSet) {
          const cards = cardSet.items
            .map((it) => {
              const card: Record<string, any> = {};
              if (slideCards.titleUid && it.title) card[slideCards.titleUid] = it.title;
              if (slideCards.descUid && it.description) card[slideCards.descUid] = it.description;
              return card;
            })
            .filter((c) => Object.keys(c).length);
          if (cards.length) {
            flush();
            if (cardSet.leadHtml && hasMeaningfulHtmlContent(cardSet.leadHtml)) buffer.push(cardSet.leadHtml);
            const cardsIndex = slideCardsSeq++;
            const entryUid = idCorrector(`${ctx?.uid || 'entry'}_cards_${cardsIndex}`);
            const store = sideStoreFor(ctx, slideCards.def.refCtUid);
            if (store) {
              // The section's own top-level fields (distinct from the per-card schema above) hold the
              // shared image and the section's real on-page heading — `title` stays collision-safe (see
              // sectionEntryTitle), so the heading goes in the next available free-text field instead.
              const topSchema: any[] = Array.isArray(slideCards.def.refCt?.schema) ? slideCards.def.refCt.schema : [];
              const topSubtitleUid = topSchema.find((f: any) => f?.data_type === 'text' && !f?.enum && f?.uid !== 'title')?.uid;
              const topImageUid = topSchema.find((f: any) => f?.data_type === 'file')?.uid;
              const asset = cardSet.image
                ? (Number.isFinite(cardSet.image.id) && cardSet.image.id! > 0 ? assetData?.[`assets_${cardSet.image.id}`] : undefined)
                  || resolveAssetByUrl(assetData, cardSet.image.url)
                : undefined;
              store[entryUid] = {
                uid: entryUid,
                title: sectionEntryTitle(slideCards.def.refCtUid, 'Cards'),
                ...(topSubtitleUid && cardSet.sectionSubtitle ? { [topSubtitleUid]: cardSet.sectionSubtitle } : {}),
                ...(topImageUid && asset ? { [topImageUid]: asset } : {}),
                [slideCards.vfUid]: [{ [slideCards.variantUid]: { [slideCards.cardsUid]: cards } }],
                locale: ctx?.locale || 'en-us',
                publish_details: [],
              };
            }
            sections.push({
              [slideCards.def.blockUid]: {
                [slideCards.def.refField]: [{ uid: entryUid, _content_type_uid: slideCards.def.refCtUid }],
              },
            });
            speakerSection = null;
            continue;
          }
        }
      }
      if (name === 'core/media-text' && flexImageVar) {
        const parsed = parseMediaTextBlock(raw, assetData);
        if (parsed && emitImageTextVariant(parsed, raw)) continue;
      }
      // A plain core/group authored as image + text (no dedicated core/media-text block) — same target
      // section, detected by shape via isImageTextGroup/kept whole by linearize above.
      if (name === 'core/group' && flexImageVar && isImageTextGroup(raw)) {
        const parsed = parseImageTextGroup(raw, assetData);
        if (parsed && emitImageTextVariant(parsed, raw)) continue;
      }
      // Same target section authored as two columns (image column + text column) instead of one group —
      // detected by shape via isColumnsImageTextBlock/kept whole by linearize above.
      if (name === 'core/columns' && flexImageVar && isColumnsImageTextBlock(raw)) {
        const parsed = parseColumnsImageText(raw, assetData);
        if (parsed && emitImageTextVariant(parsed, raw)) continue;
      }
      // An all-image row (e.g. a 3-icon strip with no accompanying text) — one text_image entry holding
      // every resolved image together, not N disconnected single-image entries. Doesn't go through
      // emitImageTextVariant since that assumes exactly one asset; the file field is multiple here.
      if (name === 'core/columns' && flexImageVar && isColumnsAllImages(raw)) {
        const assets = parseColumnsAllImages(raw, assetData);
        const fileField = firstFieldOfType(flexImageVar.schema || [], 'file');
        if (assets.length && fileField) {
          flush();
          reserveFlexSlot();
          flexVariants.push({ [flexImageVar.uid]: { [fileField.uid]: fileField.multiple ? assets : assets[0] } });
          speakerSection = null;
          continue;
        }
      }
      // A heading/paragraph + button "CTA banner" authored as a plain group or as columns (any column
      // count) — kept together as one text_cta block instead of a rich_text chunk split from a titleless
      // CTA. Checked after the image+text cases above so a group/columns that also has an image is never
      // reinterpreted (isGroupTextCta itself requires zero images, so this is a belt-and-suspenders order).
      if ((name === 'core/group' || name === 'core/columns') && flexCtaVar && isGroupTextCta(raw)) {
        const parsed = parseGroupTextCta(raw);
        if (emitTextCtaVariant(parsed)) continue;
      }
      // A reusable/synced pattern block (e.g. the certification "badge" card on course pages) whose
      // per-instance override content is shaped like an image+text card — same target section, detected
      // by shape via isCoreBlockImageText. core/block is not a transparent wrapper, so it always reaches
      // here as its own flat node regardless of any core/cover it's nested inside.
      if (name === 'core/block' && flexImageVar && isCoreBlockImageText(raw)) {
        const parsed = parseCoreBlockImageText(raw, assetData);
        if (parsed && emitImageTextVariant(parsed, raw)) continue;
      }
      if (name === 'core/image' && flexImageVar) {
        const fUid = fileSubUid(flexImageVar.schema);
        const jUid = jsonSubUid(flexImageVar.schema);
        const idAttr = Number(raw?.attrs?.id);
        let asset = Number.isFinite(idAttr) && idAttr > 0 ? assetData?.[`assets_${idAttr}`] : undefined;
        if (!asset) asset = resolveAssetByUrl(assetData, html.match(/src=["']([^"']+)["']/i)?.[1]);
        const caption = cheerio.load(html)('figcaption').first().text().replace(/\s+/g, ' ').trim();
        // Same rule as media-text: a resolved asset is required, since the file field can't hold a
        // URL. Without one the block falls through to prose, preserving <img src> AND the caption.
        if (fUid && asset) {
          const sub: Record<string, any> = { [fUid]: asset };
          if (jUid && caption) sub[jUid] = RteJsonConverter(`<p>${caption}</p>`);
          // core/image carries its side in `align` (left/right); center/full/wide are widths and are
          // correctly ignored. No default here — a standalone image has no implied side.
          const imgAlignField = (flexImageVar.schema || []).find(
            (f: any) => f?.data_type === 'text' && f?.enum && /alig/i.test(f?.uid || ''),
          );
          const imgAlign = alignmentChoiceFor(raw, imgAlignField);
          if (imgAlign) sub[imgAlignField.uid] = imgAlign;
          flush();
          reserveFlexSlot(); flexVariants.push({ [flexImageVar.uid]: sub });
          speakerSection = null;
          continue;
        }
      }
      if (semantic === 'video_embed' && flexVideoVar) {
        const parsed = parseVideoBlock(raw);
        const urlUid = urlTextSubUid(flexVideoVar.schema);
        if (parsed?.video_url && urlUid) {
          const sub: Record<string, any> = { [urlUid]: parsed.video_url };
          const thumbUid = fileSubUid(flexVideoVar.schema);
          const thumbAsset = thumbUid ? resolveAssetByUrl(assetData, parsed.thumbnail) : undefined;
          if (thumbUid && thumbAsset) sub[thumbUid] = thumbAsset;
          flush();
          reserveFlexSlot(); flexVariants.push({ [flexVideoVar.uid]: sub });
          speakerSection = null;
          continue;
        }
      }
      // core/table → the table variant, but only when every cell is plain text. A table holding links
      // or images stays in rich text, where that markup survives.
      if (name === 'core/table' && flexTableVar) {
        const parsed = parseTableBlock(raw);
        if (parsed) {
          const cols = parsed.columns.map((c) => {
            const col: Record<string, any> = {};
            if (flexTableVar.colTitleUid && c.title) col[flexTableVar.colTitleUid] = c.title;
            col[flexTableVar.rowsUid] = c.rows.map((r) => {
              const row: Record<string, any> = {};
              if (flexTableVar.rowTitleUid && r.label) row[flexTableVar.rowTitleUid] = r.label;
              if (flexTableVar.rowValueUid && r.value) row[flexTableVar.rowValueUid] = r.value;
              return row;
            }).filter((r) => Object.keys(r).length);
            return col;
          }).filter((c) => (c[flexTableVar.columnsUid] ?? c[flexTableVar.rowsUid] ?? []).length);
          if (cols.length) {
            flush();
            reserveFlexSlot();
            flexVariants.push({ [flexTableVar.variantUid]: { [flexTableVar.columnsUid]: cols } });
            speakerSection = null;
            continue;
          }
        }
      }

      if (semantic === 'quote' && flexQuoteVar) {
        const pq = parseQuoteBlock(raw);
        // The variant's own top-level `description` (json) field is left unset here: WP's core/quote
        // only ever yields ONE piece of text (the quotation, via parseQuoteBlock). Writing quote_text
        // into both `description` and the quote GF's `quote` field duplicated the same string in two
        // places; the GF's `quote` field is the semantically correct, single home for it.
        const sub = pq ? buildQuoteFlexSub(pq) : null;
        if (sub) { flush(); reserveFlexSlot(); flexVariants.push({ [flexQuoteVar.uid]: sub }); speakerSection = null; continue; }
      }
      // An image paired with its quote (kept whole by isImageQuotePair/linearize above) — one text_quote
      // entry with the image filling the quote GF's logo field, instead of an orphan text_image entry
      // plus a text_quote entry with no portrait.
      if ((name === 'core/group' || name === 'core/columns') && flexQuoteVar && isImageQuotePair(raw)) {
        const pq = parseImageQuotePair(raw, assetData);
        const sub = pq ? buildQuoteFlexSub(pq, pq.asset) : null;
        if (sub) { flush(); reserveFlexSlot(); flexVariants.push({ [flexQuoteVar.uid]: sub }); speakerSection = null; continue; }
      }
    }

    // Default: rich content, or an unsupported semantic block folded into rich_text / the prose variant.
    if (html && html.trim()) {
      buffer.push(html);
      speakerSection = null;
    }
  }
  flushPeopleGrid();
  flushColumnsCardPair();
  flushTierCardPair();
  flush();
  finalizeFlexEntry();
  return sections.filter((s) => s != null);
}

/**
 * Build a complete Contentstack entry for one WordPress item, shaped by the target content type's
 * authored schema. Fills each field by role: blocks (via buildModularBody), author reference, source/
 * metadata group, seo global field, taxonomy, published date, featured image, title/url/excerpt, and a
 * content_kind-style discriminator dropdown. Fields with no generic WP source (e.g. duration) are left
 * for the ACF merge or empty.
 */
export function buildEntryFromSchema(
  ct: any,
  blocks: any[],
  item: any,
  ctx: { uid: string; link?: string; contentKind?: string; assetData: any; authorData: any[]; taxonomies: any[]; locale: string; entryTitle?: string; allowedSeoUids?: Set<string>; globalFieldsByUid?: Map<string, any>; contentTypesByUid?: Map<string, any>; sideEntries?: Record<string, Record<string, any>>; usedTitles?: Map<string, Map<string, number>>; consumedBlocks?: Set<any> },
): Record<string, any> {
  const schema: any[] = Array.isArray(ct?.schema) ? ct.schema : [];
  const entry: Record<string, any> = { uid: ctx.uid, locale: ctx.locale, publish_details: [] };
  const permalink = String(ctx.link ?? item?.link ?? '').trim();
  const publishedIso = toIsoDate(item?.['wp:post_date_gmt'] ?? item?.['wp:post_date']);
  const excerptText = stripHtmlTags(String(item?.['excerpt:encoded'] ?? '').trim());
  const { seo, featuredAsset } = derivePostmeta(item, ctx.assetData, ctx.allowedSeoUids);
  const postIdNum = Number(item?.['wp:post_id']);
  // Synonyms so a metadata group maps whether it uses migration_metadata or source_* uids.
  const groupSources: Record<string, any> = {
    wp_post_id: Number.isNaN(postIdNum) ? undefined : postIdNum,
    source_post_id: Number.isNaN(postIdNum) ? undefined : postIdNum,
    wp_post_name: item?.['wp:post_name'] ?? '',
    source_slug: item?.['wp:post_name'] ?? '',
    wp_guid: guidToString(item?.guid),
    wp_published_at: publishedIso,
    original_permalink: permalink,
    source_post_type: String(item?.['wp:post_type'] ?? ''),
  };

  // ACF/custom-field values live in wp:postmeta keyed by the ACF field name.
  const postmeta = new Map<string, any>();
  for (const m of Array.isArray(item?.['wp:postmeta']) ? item['wp:postmeta'] : []) {
    const k = m?.['wp:meta_key'];
    if (typeof k === 'string' && !postmeta.has(k)) postmeta.set(k, m?.['wp:meta_value']);
  }
  /** Postmeta value for a Contentstack field uid, matching by name or ACF_FIELD_ALIASES. */
  const metaFor = (fieldUid: string): any => {
    if (postmeta.has(fieldUid)) return postmeta.get(fieldUid);
    const alias = ACF_FIELD_ALIASES[fieldUid];
    return alias ? postmeta.get(alias) : undefined;
  };
  /** Coerce a raw postmeta string to the field's data_type; undefined when empty/unsupported. */
  const coerceMeta = (dataType: string, raw: any): any => {
    if (raw === undefined || raw === null || String(raw).trim() === '') return undefined;
    if (dataType === 'boolean') return raw === '1' || raw === 1 || raw === true || String(raw).toLowerCase() === 'true';
    if (dataType === 'number') { const n = Number(raw); return Number.isNaN(n) ? undefined : n; }
    if (dataType === 'text') return typeof raw === 'string' ? raw.trim() : String(raw);
    return undefined; // file/json/etc need dedicated handling (asset refs, term resolution)
  };
  /** Fill a group / global-field's declared sub-fields from metadata synonyms, then postmeta by name. */
  const fillDeclaredFields = (subSchema: any[]): Record<string, any> => {
    const g: Record<string, any> = {};
    for (const sub of Array.isArray(subSchema) ? subSchema : []) {
      if (Object.prototype.hasOwnProperty.call(groupSources, sub?.uid)) {
        const val = groupSources[sub.uid];
        if (val !== undefined && val !== '') g[sub.uid] = sub?.data_type === 'number' ? Number(val) : val;
        continue;
      }
      // Some fields (case_study_details.key_takeaways/quick_facts) have no reliable ACF source at all —
      // the real per-entry content only exists as a free-text heading section in the body. Try that
      // FIRST for these, since there's nothing meaningful to fall back to from postmeta.
      const headingSource = HEADING_SOURCED_FIELDS.find((h) => h.test.test(sub?.uid || ''));
      if (headingSource) {
        const section = extractHeadingListSection(blocks, headingSource.label);
        if (section) {
          if (sub?.data_type === 'json') g[sub.uid] = RteJsonConverter(section.html);
          // A multiple text field (e.g. quick_facts) expects an array of strings — one per list item —
          // not all items joined into a single string instance.
          else if (sub?.data_type === 'text') g[sub.uid] = sub?.multiple ? section.items : section.items.join('; ');
        }
        continue;
      }
      const raw = metaFor(sub?.uid);
      // File sub-field (e.g. case_study_details.customer_logo ← `customer_logo`/`ImageID` postmeta):
      // resolve to a downloaded Contentstack asset. The value may be a single attachment id, a
      // pipe-separated LIST of ids (the scaledagile export stores every image of the post that way,
      // featured first), or image URL(s) — try each form in turn and take the first that resolves.
      if (sub?.data_type === 'file') {
        const asset = resolveAssetFromMetaValue(raw, ctx.assetData);
        if (asset) g[sub.uid] = asset;
        continue;
      }
      // JSON/rich-text sub-field with a genuine postmeta source: convert its HTML into a JSON RTE value.
      if (sub?.data_type === 'json') {
        const html = typeof raw === 'string' ? raw.trim() : '';
        if (html && hasMeaningfulHtmlContent(html)) g[sub.uid] = RteJsonConverter(html);
        continue;
      }
      const mv = coerceMeta(sub?.data_type, raw);
      if (mv !== undefined) { g[sub.uid] = mv; continue; }
      // No postmeta source: a plain text sub-field named after a taxonomy the item is tagged with
      // (e.g. case_study_details.industry ← <category domain="industry">) takes that term's name.
      if (sub?.data_type === 'text' && !isDropdownField(sub)) {
        const term = termNameForDomain(item, sub?.uid);
        if (term) g[sub.uid] = term;
      }
    }
    return g;
  };

  // Blocks already folded into a declared field by HEADING_SOURCED_FIELDS (e.g. a case study's
  // "Quick Facts:" / "Key Takeaways:" run → case_study_details.quick_facts/key_takeaways). Computed here,
  // BEFORE the field loop, so it doesn't depend on whether the group field happens to be declared before
  // or after the body field — the body builder skips these so the same content isn't ALSO rendered as
  // ordinary prose, which duplicated it in every case study that has them.
  const headingSourcedConsumed = new Set<any>();
  const collectHeadingSourced = (subSchema: any[]): void => {
    for (const sub of Array.isArray(subSchema) ? subSchema : []) {
      if (!sub || typeof sub !== 'object') continue;
      const src = HEADING_SOURCED_FIELDS.find((h) => h.test.test(sub?.uid || ''));
      if (src) {
        const section = extractHeadingListSection(blocks, src.label);
        if (section) for (const b of section.consumed) headingSourcedConsumed.add(b);
      }
      if (Array.isArray(sub?.schema)) collectHeadingSourced(sub.schema);
    }
  };
  collectHeadingSourced(schema);

  // Body builders also title the section side entries they generate; give them this item's title so a
  // section whose content doesn't start with a heading is named after its parent instead of 'Content'.
  // Some WordPress items (e.g. the JP landing pages) have an empty title — fall back to the slug, which
  // is always present and unique, humanized ("jp-training" → "Jp Training").
  const itemTitle = typeof item?.title === 'string' ? item.title.trim() : '';
  const itemSlug = typeof item?.['wp:post_name'] === 'string' ? item['wp:post_name'].trim() : '';
  const bodyCtx = {
    ...ctx,
    entryTitle: ctx.entryTitle ?? (itemTitle || (itemSlug ? humanizeSlug(itemSlug) : undefined)),
    consumedBlocks: headingSourcedConsumed.size ? headingSourcedConsumed : undefined,
  };

  for (const field of schema) {
    const uid = field?.uid;
    const dt = field?.data_type;
    if (!uid) continue;
    if (dt === 'blocks') {
      const body = buildModularBody(field, blocks, ctx.assetData, bodyCtx);
      if (body.length) entry[uid] = body;
    } else if (dt === 'reference' && referenceTargets(field).includes('author')) {
      if (ctx.authorData?.length) entry[uid] = ctx.authorData;
    } else if (dt === 'reference' && /parent/i.test(uid)) {
      // WordPress's `wp:post_parent` (0 when top-level) — every migrated item's uid is `posts_<post_id>`
      // (see saveEntry), so the parent's entry uid is derivable the same way. The parent is assumed to
      // have landed in THIS same content type; page-remap.json can send an individual page elsewhere, in
      // which case the reference simply won't resolve to a real entry (same class of loose end the
      // import tool already reports for any dangling reference).
      const parentId = String(item?.['wp:post_parent'] ?? '').trim();
      if (parentId && parentId !== '0') {
        entry[uid] = [{ uid: idCorrector(`posts_${parentId}`), _content_type_uid: ct?.uid }];
      }
    } else if (dt === 'reference' && isSectionReferenceField(field, ctx.contentTypesByUid)) {
      // The body is a top-level REFERENCE to a section content type (e.g. article.body_section →
      // flexible_layouts) rather than a modular-blocks field. Build the same side entries the modular
      // path builds, then store the resulting references here.
      const refs = buildSectionReferenceValue(field, blocks, ctx.assetData, bodyCtx);
      if (refs.length) entry[uid] = refs;
    } else if (dt === 'global_field') {
      if (referenceTargets(field).some(isSeoUid)) {
        // SEO global field regardless of its uid (`seo`, `review_seo`, …): fill from Yoast postmeta.
        if (seo && Object.keys(seo).length) entry[uid] = seo;
      } else if (referenceTargets(field).includes('site_scope')) {
        // Every entry in this migration comes from the same WordPress site — there is no per-item WP
        // source data for this field, so stamp it with the fixed canonical-site value rather than
        // leaving it blank forever.
        const gfDef = ctx.globalFieldsByUid?.get('site_scope');
        const siteField = (gfDef?.schema || []).find((f: any) => f?.uid === 'canonical_site') || (gfDef?.schema || [])[0];
        if (siteField) entry[uid] = { [siteField.uid]: 'scaled-agile' };
      } else {
        // Non-SEO global field (e.g. course/review `metadata` → review_metadata): fill its declared
        // sub-fields from postmeta by name (text/boolean/number), same as a group. Needs the referenced
        // global field's schema, supplied via ctx.globalFieldsByUid.
        const gfDef = ctx.globalFieldsByUid?.get(referenceTargets(field)[0]);
        if (gfDef && Array.isArray(gfDef.schema)) {
          const g = fillDeclaredFields(gfDef.schema);
          if (Object.keys(g).length) entry[uid] = g;
        }
      }
    } else if (dt === 'taxonomy') {
      // Contentstack rejects an entry that references a taxonomy the content type's taxonomy field is
      // not configured to accept. Keep only the taxonomy_uids this field whitelists (when it declares
      // any), so a WP item tagged with domains beyond the field's allow-list never fails the import.
      if (ctx.taxonomies?.length) {
        const allowed = new Set(
          (Array.isArray(field?.taxonomies) ? field.taxonomies : [])
            .map((t: any) => t?.taxonomy_uid)
            .filter(Boolean),
        );
        const filtered = allowed.size
          ? ctx.taxonomies.filter((t: any) => allowed.has(t?.taxonomy_uid))
          : ctx.taxonomies;
        if (filtered.length) entry[uid] = filtered;
      }
    } else if (dt === 'group') {
      const g = fillDeclaredFields(field?.schema);
      if (Object.keys(g).length) entry[uid] = g;
    } else if (dt === 'isodate') {
      // Prefer a real date from postmeta (e.g. event start/end via ACF_FIELD_ALIASES); only fall back to
      // the post's publish date for genuine publish-date fields — never for arbitrary *date* uids.
      const metaIso = toIsoDate(metaFor(uid));
      if (metaIso) entry[uid] = metaIso;
      else if (publishedIso && /publish/i.test(uid)) entry[uid] = publishedIso;
    } else if (dt === 'link') {
      // Contentstack link value is { title, href }. Source is a URL postmeta (via name/alias); empty
      // until an alias points at one, so no output when there is no matching meta.
      const href = coerceMeta('text', metaFor(uid));
      if (href) entry[uid] = { title: href, href };
    } else if (dt === 'file') {
      if (/(featured|image|thumbnail)/i.test(uid) && featuredAsset) entry[uid] = featuredAsset;
    } else if (dt === 'boolean') {
      const mv = coerceMeta('boolean', metaFor(uid));
      if (mv !== undefined) entry[uid] = mv;
    } else if (dt === 'number') {
      const mv = coerceMeta('number', metaFor(uid));
      if (mv !== undefined) entry[uid] = mv;
    } else if (dt === 'text') {
      if (isDropdownField(field) && ctx.contentKind && choiceValues({ schema: [field] }, uid).includes(ctx.contentKind)) {
        entry[uid] = ctx.contentKind;
      } else if (uid === 'title') {
        // Some WordPress items (e.g. the JP landing pages) have a genuinely empty <title> — fall back to
        // the slug, which is always present and unique, humanized ("jp-certified-course-teams" → "Jp
        // Certified Course Teams") rather than leaving the entry's title blank.
        const rawTitle = String(item?.title ?? '').trim();
        const slugTitle = item?.['wp:post_name'] ? humanizeSlug(item['wp:post_name']) : '';
        entry[uid] = dedupeTitle(ctx, ct?.uid, rawTitle || slugTitle);
      } else if (uid === 'url' && ct?.uid === 'external_link') {
        // On external_link the `url` field IS the external destination the post points to, not this
        // entry's own page path — unlike every other content type, where `url` is the live page slug.
        const dest = coerceMeta('text', metaFor(uid));
        entry[uid] = dest ?? toEntryUrlPath(permalink);
      } else if (uid === 'url') {
        entry[uid] = toEntryUrlPath(permalink);
      } else if (uid === 'excerpt' && excerptText) {
        entry[uid] = excerptText;
      } else if (ct?.uid === 'course' && uid === 'template_variant') {
        // No WP field carries this — it's a fixed per-post-id assignment from the content-inventory doc's
        // 4 layout groupings (see COURSE_TEMPLATE_VARIANT_BY_POST_ID). A course post id not in that list
        // (e.g. a newly authored course outside the original 30) is left unset rather than guessed.
        const variant = COURSE_TEMPLATE_VARIANT_BY_POST_ID[String(item?.['wp:post_id'] ?? '')];
        if (variant) entry[uid] = variant;
      } else if (isDropdownField(field)) {
        // Dropdown fed by postmeta (e.g. course_level ← `level`): normalize to a valid choice value,
        // skipping out-of-range values so we never write an invalid enum.
        const choice = matchDropdownChoice(field, metaFor(uid));
        if (choice !== undefined) entry[uid] = choice;
      } else if (uid === 'source_name' && ct?.uid === 'external_link') {
        // No WP source ever carries a distinct "source name" (site name) value for these links — only
        // the destination URL. Derive it from the URL's hostname so a mandatory field isn't left blank.
        const dest = coerceMeta('text', metaFor('url')) ?? '';
        try {
          entry[uid] = new URL(dest).hostname.replace(/^www\./, '');
        } catch {
          /* not a parseable URL; leave unset */
        }
      } else {
        // Any other text field: fill from a matching ACF postmeta value.
        const mv = coerceMeta('text', metaFor(uid));
        if (mv !== undefined) entry[uid] = mv;
        // A model may name its standfirst something other than `excerpt` (event_revised calls it
        // `summary`). With no postmeta of that name the WordPress excerpt would otherwise be dropped,
        // so fall back to it for a field that plays the same role.
        else if (excerptText && /^(summary|excerpt|teaser|standfirst)$/i.test(uid)) entry[uid] = excerptText;
      }
    }
  }

  // Mandatory title fallback when the title field uses a non-standard uid. Same empty-title → humanized
  // slug fallback as the uid==='title' branch above, for content types whose title field isn't literally
  // named `title`.
  const titleField = schema.find((f: any) => f?.field_metadata?._default && f?.data_type === 'text');
  if (titleField && entry[titleField.uid] == null) {
    const rawTitle = String(item?.title ?? '').trim();
    entry[titleField.uid] = rawTitle || (item?.['wp:post_name'] ? humanizeSlug(item['wp:post_name']) : item?.title);
  }

  return entry;
}

async function createSchema(fields: any, blockJson : any, title: string, uid: string, assetData: any, duplicateBlockMappings?: Record<string, string>, postmeta?: any, link?: string) {
  const schema : any = {
    title: title,
    uid: uid,
    url: link,
    //fields: fields?.fields,
  };

  const cmsFieldMatchesWpBlockName = (
    otherCmsType: string | undefined,
    otherCmsField: string | undefined,
    wpRawName: string | undefined,
  ): boolean => {
    const primary = normalizedWpSlug(wpRawName);
    if (!primary) return false;
    const mappedRaw =
      duplicateBlockMappings && typeof duplicateBlockMappings[primary] === "string"
        ? duplicateBlockMappings[primary]
        : "";
    const mappedNorm = normalizedWpSlug(mappedRaw);
    const candidates =
      mappedNorm && mappedNorm !== primary ? [primary, mappedNorm] : [primary];
    const t = normalizedWpSlug(otherCmsType);
    const f = normalizedWpSlug(otherCmsField);
    return candidates.some((n) => n === t || n === f);
  };
  
  try {
    // Ensure blockJson is an array and fields is defined
    if (!Array.isArray(blockJson)) {
      console.warn('blockJson is not an array:', typeof blockJson);
      return schema;
    }
    
    if (!Array.isArray(fields)) {
      console.warn('fields is not an array:', typeof fields);
      return schema;
    }
    // Process modular blocks fields
    for (const field of fields) {
      if (field?.contentstackFieldType === 'modular_blocks') {
        const modularBlocksArray: any[] = [];
        
        // CS-path children under modular_blocks_2.* plus legacy backup-path modular_blocks.*
        const modularBlockChildren = getModularBlockChildrenForField(field, fields);
                
        // Process each block in blockJson to see if it matches any modular block child.
        // Flatten top-level layout wrappers first so mixed-content columns surface as the same
        // type-based blocks the schema produced (see flattenTopLevelLayout).
        for (const block of flattenTopLevelLayout(blockJson)) {
          try {
            const blockForProcessing = unwrapSingleChildGroup(block);
            const blockName = getFieldName(resolvedBlockName(blockForProcessing));
            const blockNameLc = normalizedWpSlug(blockName);

            // A bare core/column reaching this point is the multi-child remainder of a nested-column
            // layout — flattenTopLevelLayout peels single-child columns/column away, so a standalone
            // core/column only survives when it holds an entire block of content (WP commonly buries a
            // whole article body under columns → column → columns → column). It matches no modular
            // child ("column" has no field; the schema only exposes "columns"), so today all of that
            // content is silently dropped. Convert the whole column's inner HTML into a single JSON RTE
            // value on the `columns` block's paragraph field: zero content loss and correct document
            // order. Real multi-column `core/columns` layouts still flow through the structured descent.
            if (blockForProcessing?.blockName === 'core/column') {
              const columnsChild = modularBlockChildren.find(
                (c: any) => normalizedWpSlug(c?.otherCmsField) === 'columns',
              );
              const rteField = columnsChild
                ? fields.find(
                    (f: any) =>
                      fieldMappedUnderModularChild(columnsChild, f) &&
                      f?.contentstackFieldType === 'json' &&
                      normalizedWpSlug(f?.otherCmsField) === 'paragraph',
                  )
                : undefined;
              if (columnsChild && rteField) {
                const columnHtml = collectHtmlFromInnerBlocks(blockForProcessing);
                if (hasMeaningfulHtmlContent(columnHtml)) {
                  const columnRte = RteJsonConverter(columnHtml);
                  if (columnRte) {
                    const mk = getLastUid(columnsChild.contentstackFieldUid);
                    const fk = getLastUid(rteField.contentstackFieldUid);
                    modularBlocksArray.push({
                      [mk]: {
                        [fk]: fieldIsMultipleInContentstack(rteField) ? [columnRte] : columnRte,
                      },
                    });
                  }
                }
                continue;
              }
            }

            // Find which modular block child this block matches
            let matchingChildField = fields.find((childField: any) => {
              const fieldName = childField?.otherCmsField?.toLowerCase();
              const fieldType = childField?.otherCmsType?.toLowerCase();
              return (childField?.contentstackFieldType !== 'modular_blocks_child') && (blockNameLc === fieldName || blockNameLc === fieldType) 
            });
   
            let matchingModularBlockChild = modularBlockChildren.find((childField: any) => {
              const fieldName = childField?.otherCmsField?.toLowerCase() ;
              return  blockNameLc === fieldName 
            });

            let modularMatchFromDuplicateMap = false;

            // Fallback: if no direct match, check duplicate block mappings
            if (!matchingModularBlockChild && duplicateBlockMappings) {
              const blockKeyLc = blockName?.toLowerCase?.() ?? "";
              const mappedName =
                duplicateBlockMappings[blockKeyLc] ?? duplicateBlockMappings[blockName];

              if (mappedName) {
                matchingModularBlockChild = modularBlockChildren.find((childField: any) => {
                  const fieldName = childField?.otherCmsField?.toLowerCase();
                  return mappedName === fieldName;
                });

                matchingChildField = fields.find((childField: any) => {
                  const fieldName = childField?.otherCmsField?.toLowerCase();
                  const fieldType = childField?.otherCmsType?.toLowerCase();
                  return (
                    childField?.contentstackFieldType !== "modular_blocks_child" &&
                    (mappedName === fieldName || mappedName === fieldType)
                  );
                });
                modularMatchFromDuplicateMap = !!(
                  matchingModularBlockChild && matchingChildField
                );
              }
            }

            // Duplicate-map + single inner: new modular row; list item lives in mapped field only (does not merge into prior heading).
            if (
              modularMatchFromDuplicateMap &&
              blockForProcessing?.innerBlocks?.length === 1
            ) {
              const piece = formatChildByType(
                unwrapSingleChildGroup(blockForProcessing.innerBlocks[0]),
                matchingChildField,
                assetData,
                fields,
              );
              if (piece != null && piece !== "") {
                const mk = getLastUid(matchingModularBlockChild!.contentstackFieldUid);
                const fk = getLastUid(matchingChildField!.contentstackFieldUid);
                modularBlocksArray.push({ [mk]: { [fk]: piece } });
                continue;
              }
            }

            //if (matchingChildField) {
              if (matchingModularBlockChild?.uid) {
                const childrenObject: Record<string, any> = {};
                attachCoverBackgroundMediaToChildren(
                  blockForProcessing,
                  matchingModularBlockChild,
                  fields,
                  assetData,
                  childrenObject,
                );
                attachMediaTextFieldsToChildren(
                  blockForProcessing,
                  matchingModularBlockChild,
                  fields,
                  assetData,
                  childrenObject,
                );
                attachCoreBlockContentToChildren(
                  blockForProcessing,
                  matchingModularBlockChild,
                  fields,
                  assetData,
                  childrenObject,
                );

                const inners = flattenLayoutWrappers(blockForProcessing?.innerBlocks);
                if (Array.isArray(inners) && inners?.length > 0) {
                  inners.forEach((child: any, childIndex: number) => {
                    try {
                      const effectiveChild = unwrapSingleChildGroup(child);

                      const childBlockName =
                        getFieldName(resolvedBlockName(effectiveChild))?.toLowerCase() ||
                        getFieldName(resolvedBlockName(effectiveChild)?.toLowerCase());
                      const childBlockSlug = normalizedWpSlug(childBlockName);
                      const childField = fields.find((f: any) => {
                        const fOtherCmsType = f?.otherCmsType?.toLowerCase();
                        const fOtherCmsField = f?.otherCmsField?.toLowerCase();
                        const ck = getLastUid(f?.contentstackFieldUid);
                        const taken = childrenObject[ck] !== undefined && childrenObject[ck] !== null;
                        return (
                          fieldMappedUnderModularChild(matchingModularBlockChild, f) &&
                          cmsFieldMatchesWpBlockName(
                            fOtherCmsType,
                            fOtherCmsField,
                            childBlockSlug,
                          ) &&
                          (!taken || fieldIsMultipleInContentstack(f))
                        );
                      });

                      if (childField) {
                        const childKey = getLastUid(childField?.contentstackFieldUid);

                        if (childField?.contentstackFieldType === 'group') {
                          const processedGroup = processNestedGroup(
                            effectiveChild,
                            childField,
                            fields,
                            matchingModularBlockChild,
                          );
                          const { remainder, hoisted } = partitionModularDirectSiblings(
                            processedGroup || {},
                            matchingModularBlockChild,
                            fields,
                            childKey,
                          );
                          if (Object.keys(hoisted)?.length) {
                            Object.assign(childrenObject, hoisted);
                          }
                          if (
                            fieldIsMultipleInContentstack(childField) &&
                            remainder &&
                            Object.keys(remainder)?.length > 0
                          ) {
                            if (Array.isArray(childrenObject[childKey])) {
                              childrenObject?.[childKey]?.push(remainder);
                            } else {
                              childrenObject[childKey] = [remainder];
                            }
                          } else if (
                            remainder &&
                            Object.keys(remainder)?.length > 0
                          ) {
                            childrenObject[childKey] = remainder;
                          }

                          const formattedChild = formatChildByType(
                            effectiveChild,
                            childField,
                            assetData,
                            fields,
                          );

                          if (fieldIsMultipleInContentstack(childField) && formattedChild) {
                            if (Array.isArray(childrenObject[childKey])) {
                              childrenObject[childKey]?.push(formattedChild);
                            } else {
                              childrenObject[childKey] = [formattedChild];
                            }
                          } else {
                            formattedChild && (childrenObject[childKey] = formattedChild);
                          }
                        } else {
                          const formattedChild = formatChildByType(
                            effectiveChild,
                            childField,
                            assetData,
                            fields,
                          );
                          if (fieldIsMultipleInContentstack(childField) && formattedChild) {
                            if (Array.isArray(childrenObject[childKey])) {
                              childrenObject[childKey]?.push(formattedChild);
                            } else {
                              childrenObject[childKey] = [formattedChild];
                            }
                          } else {
                            formattedChild && (childrenObject[childKey] = formattedChild);
                          }
                        }
                      }
                    } catch (childError) {
                      console.warn(`Error processing child block at index ${childIndex}:`, childError);
                    }
                  });
                }

                const modularKey = getLastUid(matchingModularBlockChild?.contentstackFieldUid);
                if (Object.keys(childrenObject).length > 0) {
                  modularBlocksArray.push({ [modularKey]: childrenObject });
                } else if (modularKey && matchingChildField) {
                  const formattedBlock = formatChildByType(
                    blockForProcessing,
                    matchingChildField,
                    assetData,
                    fields,
                  );
                  formattedBlock &&
                    modularBlocksArray?.push({
                      [modularKey]: {
                        [getLastUid(matchingChildField?.contentstackFieldUid)]: formattedBlock,
                      },
                    });
                }
              }
            //}
          } catch (blockError) {
            console.warn('Error processing block:', blockError);
          }
        }
        
        // Set the modular blocks array in the schema
        if (modularBlocksArray.length > 0) {
          schema[field?.contentstackFieldUid] = modularBlocksArray;
        }
      }
      else if(field?.uid === postmeta?.find((key: any)=> key?.["wp:meta_key"] === field?.uid)?.["wp:meta_key"]){
        const metaKey = field?.uid;
        const metaValue = postmeta?.find((key: any)=> key?.["wp:meta_key"] === field?.uid)?.["wp:meta_value"];
        schema[field?.contentstackFieldUid] = await formatChildByType(
          metaValue,
          field,
          assetData,
          fields,
          metaValue,
        );
        console.info(`Mapping postmeta key ${metaKey} to field ${field?.contentstackFieldUid} with value:`, metaValue);
      }
    }
  } catch (error) {
    console.error('Error in createSchema:', error);
    schema.error = 'Failed to process WordPress blocks';
  }
  return schema;
}

function getAcfSourceKey(field: any): string {
  return field?.otherCmsField || getLastUid(field?.backupFieldUid || field?.uid || '');
}

function isAcfNestedGroupChild(field: any, allFields: any[]): boolean {
  const fieldUid = field?.contentstackFieldUid || '';
  if (!fieldUid) return false;
  return allFields.some(
    (parent) =>
      parent?.contentstackFieldType === 'group' &&
      parent?.contentstackFieldUid &&
      fieldUid.startsWith(`${parent.contentstackFieldUid}.`),
  );
}

function buildAcfGroupEntry(
  raw: any,
  groupField: any,
  allFields: any[],
  assetData: any,
): Record<string, any> | Record<string, any>[] | undefined {
  const nestedFields = getNestedFieldsForGroup(groupField, undefined, allFields);

  const processOne = (row: Record<string, any>): Record<string, any> | undefined => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return undefined;
    const out: Record<string, any> = {};
    for (const nestedField of nestedFields) {
      const sourceKey = getAcfSourceKey(nestedField);
      const rawValue = row[sourceKey];
      if (rawValue === undefined || rawValue === null) continue;
      const formatted = formatChildByType(null, nestedField, assetData, allFields, rawValue);
      if (formatted !== undefined && formatted !== null && formatted !== '') {
        out[getLastUid(nestedField?.contentstackFieldUid)] = formatted;
      }
    }
    return Object.keys(out).length > 0 ? out : undefined;
  };

  if (fieldIsMultipleInContentstack(groupField)) {
    if (!Array.isArray(raw)) return undefined;
    const rows = raw.map(processOne).filter(Boolean) as Record<string, any>[];
    return rows.length > 0 ? rows : undefined;
  }
  if (Array.isArray(raw)) return processOne(raw[0]);
  return processOne(raw);
}

async function createAcfSchema(
  fields: any,
  acfData: any,
  title: string,
  uid: string,
  assetData: any,
  _duplicateBlockMappings?: Record<string, string>,
) {
  const schema: any = {
    title,
    uid,
  };

  try {
    if (!acfData || typeof acfData !== 'object' || Array.isArray(acfData)) {
      return schema;
    }

    if (!Array.isArray(fields)) {
      console.warn('fields is not an array:', typeof fields);
      return schema;
    }

    for (const field of fields) {
      const fieldType = field?.contentstackFieldType;

      if (fieldType === 'modular_blocks' || fieldType === 'modular_blocks_child') {
        continue;
      }
      if (isAcfNestedGroupChild(field, fields)) {
        continue;
      }

      const outputKey = getLastUid(field?.contentstackFieldUid || field?.uid || '');
      if (!outputKey) continue;

      if (fieldType === 'group') {
        const rawGroup = acfData[getAcfSourceKey(field)];
        const built = buildAcfGroupEntry(rawGroup, field, fields, assetData);
        if (built !== undefined) {
          schema[outputKey] = built;
        }
        continue;
      }

      const rawValue = acfData[getAcfSourceKey(field)];
      if (rawValue === undefined || rawValue === null) continue;

      const formatted = formatChildByType(null, field, assetData, fields, rawValue);
      if (formatted !== undefined && formatted !== null && formatted !== '') {
        schema[outputKey] = formatted;
      }
    }
  } catch (error) {
    console.error('Error in createAcfSchema:', error);
    schema.error = 'Failed to process ACF fields';
  }

  return schema;
}

// Recursive helper function to process nested group structures
function processNestedGroup(
  child: any,
  childField: any,
  allFields: any[],
  modularBlockChild?: any,
): Record<string, any> {
  const nestedChildrenObject: Record<string, any> = {};
  const groupBlock = unwrapSingleChildGroup(child);
  if (!groupBlock?.innerBlocks?.length || !Array.isArray(groupBlock?.innerBlocks)) {
    // No nested children, return empty object for group type
    return {};
  }
  
  const nestedFields = getNestedFieldsForGroup(childField, modularBlockChild, allFields);

  if (nestedFields?.length === 0 && !modularBlockChild) {
    return {};
  }

  // Flatten layout wrappers (columns/column) and expand lists so nested leaves match their fields,
  // consistent with the top-level walker and the schema builder.
  flattenLayoutWrappers(groupBlock.innerBlocks).forEach((nestedChild: any, nestedIndex: number) => {
    try {
      const nestedEffective = unwrapSingleChildGroup(nestedChild);
      const nestedSlug = normalizedWpSlug(
        getFieldName(resolvedBlockName(nestedEffective)) || "",
      );
      const fromStrict = nestedFields?.find((field: any) => {
        const matchesBlock =
          normalizedWpSlug(field?.otherCmsType) === nestedSlug ||
          normalizedWpSlug(field?.otherCmsField) === nestedSlug;

        const uid = getLastUid(field?.contentstackFieldUid);
        const allowReuse =
          fieldAllowsRepeatedLeaves(field) ||
          !nestedChildrenObject[uid]?.length;
       
        return matchesBlock && allowReuse;
      });
      const siblingDirect = modularBlockChild
        ? allFields.filter((field: any) => {
            const fUid = field?.contentstackFieldUid || '';
            if (fUid === (childField?.contentstackFieldUid || '')) return false;
            if (!isDirectFieldOfModularBlock(modularBlockChild, field)) return false;
            const t = field?.otherCmsType?.toLowerCase();
            const n = field?.otherCmsField?.toLowerCase();
            return (
              normalizedWpSlug(t) === nestedSlug || normalizedWpSlug(n) === nestedSlug
            );
          })
        : [];
      const fromModularSibling = siblingDirect?.find((field: any) => {
        const uid = getLastUid(field?.contentstackFieldUid);
        return (
          fieldAllowsRepeatedLeaves(field) ||
          !nestedChildrenObject[uid]?.length
        );
      });
      const nestedChildField = fromStrict || fromModularSibling;
      
      
      if (!nestedChildField) {
        //console.info("no nested child field found ", nestedChild, nestedChildField, nestedFields, childField)
        return;
      }
      
      const nestedChildKey = getLastUid(nestedChildField?.contentstackFieldUid);
      
      if (nestedChildField?.contentstackFieldType === 'group') {
        const deeplyNestedObject = processNestedGroup(
          nestedEffective,
          nestedChildField,
          allFields,
          modularBlockChild,
        );
        const { remainder, hoisted } = partitionModularDirectSiblings(
          deeplyNestedObject || {},
          modularBlockChild,
          allFields,
          nestedChildKey,
        );
        if (Object.keys(hoisted)?.length > 0) {
          Object.assign(nestedChildrenObject, hoisted);
        }
        const nestedPayload =
          Object.keys(remainder)?.length > 0
            ? remainder
            : Object.keys(hoisted)?.length > 0 &&
                Object.keys(deeplyNestedObject || {})?.length > 0
              ? {}
              : deeplyNestedObject || {};
        if (fieldIsMultipleInContentstack(nestedChildField)) {
          if (Array.isArray(nestedChildrenObject[nestedChildKey])) {
            nestedChildrenObject[nestedChildKey].push(nestedPayload);
          } else {
            nestedChildrenObject[nestedChildKey] = [nestedPayload];
          }
        } else {
          nestedChildrenObject[nestedChildKey] = nestedPayload;
        }
      } else {
  
          const formattedNestedChild = formatChildByType(nestedEffective, nestedChildField, assetData, allFields);
          if (fieldAllowsRepeatedLeaves(nestedChildField)) {
            if (Array.isArray(nestedChildrenObject[nestedChildKey])) {
              formattedNestedChild && nestedChildrenObject[nestedChildKey].push(formattedNestedChild);
            } else {
              formattedNestedChild && (nestedChildrenObject[nestedChildKey] = [formattedNestedChild]);
            }
          } else {
            formattedNestedChild && (nestedChildrenObject[nestedChildKey] = formattedNestedChild);
          }

       //}
        
      }
    } catch (nestedError) {
      console.warn(`Error processing nested child block at index ${nestedIndex}:`, nestedError);
    }
  });
  return nestedChildrenObject;
}

// Helper function to collect HTML strings from innerBlocks recursively
function collectHtmlFromInnerBlocks(block: any): string {
  let html = '';
  
  if (block?.innerHTML) {
    html += block.innerHTML;
  }
  
  if (block?.innerBlocks && Array.isArray(block.innerBlocks) && block.innerBlocks.length > 0) {
    block.innerBlocks.forEach((innerBlock: any) => {
      html += collectHtmlFromInnerBlocks(innerBlock);
    });
  }
  
  return normalizeHtmlFragment(html);
}

// Helper function to extract all HTML from innerBlocks recursively
function extractAllHtmlFromInnerBlocks(block: any): any {
  const html = collectHtmlFromInnerBlocks(block);
  return html ;
}

/** Block HTML: top-level innerHTML, optional attrs/attributes, joined innerContent, or nested innerBlocks. */
function getBlockInnerHtmlString(block: any): string {
  const nonEmpty = (s: unknown): s is string =>
    typeof s === 'string' && s.trim().length > 0;

  const direct = [
    block?.innerHTML,
    block?.attrs?.innerHTML,
    block?.attributes?.innerHTML,
    block?.innerHtml
  ].find(nonEmpty) as string | undefined;
  if (direct) {
    return normalizeHtmlFragment(direct);
  }
  if (Array.isArray(block?.innerContent)) {
    const fromInnerContent = block.innerContent
      .map((p: any) => (typeof p === 'string' ? p : ''))
      .join('')
      .trim();
    if (fromInnerContent) {
      return normalizeHtmlFragment(fromInnerContent);
    }
  }
  return collectHtmlFromInnerBlocks(block);
}

// Helper function to format child blocks based on their type and field configuration
function formatChildByType(child: any, field: any, assetData: any, fields?: any[], value?: any) {
  let formatted ;
  
  try {
    
    // Process attributes based on field type configuration
    //if (child?.attributes && typeof child.attributes === 'object') {
     const attrKey = getFieldName(getFieldName(resolvedBlockName(child))?.toLowerCase() || getFieldName(resolvedBlockName(child)?.toLowerCase()));
        try {
          const attrValue = child?.attrs?.innerHTML ?? value ?? null;
          
          
          // Format based on common field types
          switch (field?.contentstackFieldType || 'text') {
            case 'modular_blocks':
              formatted = [];
              break;

            case 'multi_line_text':
            case 'single_line_text': {
              let htmlSource = '';
              if (child?.blockName != null && child.blockName !== '') {
                htmlSource = String(child.innerHTML ?? value ?? '').trim()
                  ? String(child.innerHTML ?? value ?? '')
                  : String(
                      getBlockInnerHtmlString(child) ??
                        collectHtmlFromInnerBlocks(child) ??
                        value ??
                        '',
                    );
                formatted = stripHtmlTags(htmlSource);
              } else {
                formatted =
                  stripHtmlTags(String(child?.innerHTML ?? value ?? '')) ||
                  (child ?? value ?? '');
              }
              break;
            }

            case 'number':
              formatted = typeof attrValue === 'number' ? attrValue : Number(attrValue) || 0;
              break;

            case 'boolean':
            const val = child?.attrs?.[attrKey] ?? value;

            const result = isNaN(val)
              ? Boolean(val)
              : Boolean(Number(val));
              formatted = result;
              break;

            case 'json': {
              let htmlContent = value ?? '';
                // Check if otherCmsField is "columns" - get all HTML data
              if (field?.otherCmsField?.toLowerCase() === 'columns') {
                htmlContent = extractAllHtmlFromInnerBlocks(child);
              }
              
              if (!htmlContent && child?.innerBlocks?.length > 0) {
                htmlContent = collectHtmlFromInnerBlocks(child);
              }
              if (!htmlContent) {
                htmlContent = (child?.blockName || child?.innerHTML)
                  ? child?.innerHTML
                  : child;
              }
              if (typeof htmlContent === 'string') {
                htmlContent = normalizeHtmlFragment(htmlContent);
              }
              const hasMeaningfulHtml = hasMeaningfulHtmlContent(htmlContent);

              // Only set when there is visible text or media/embeds; do not assign `undefined` (avoids false from `a && fn()` in multi-RTE).
              if (hasMeaningfulHtml ) {
                formatted = RteJsonConverter(htmlContent);
              }
              else if (value !== undefined) {
                formatted = RteJsonConverter(value);
                
              }
              break;
            }

            case 'html': {
              let rawHtml = '';
              if (typeof value === 'string' && value.trim()) {
                rawHtml = value;
              } else if (child?.blockName) {
                rawHtml = String(child?.innerHTML ?? formatted ?? '');
              } else if (child?.innerHTML) {
                rawHtml = String(child.innerHTML);
              }

              const htmlContent =
                typeof rawHtml === 'string'
                  ? normalizeHtmlFragment(rawHtml)
                  : rawHtml;
              const hasMeaningfulHtml = hasMeaningfulHtmlContent(htmlContent);

              if (hasMeaningfulHtml) {
                formatted = htmlContent;
              } else if (typeof value === 'string' && value.trim()) {
                formatted = normalizeHtmlFragment(value);
              }
              break;
            }

            case 'link': {
              const attrs = child?.attrs ?? child?.attributes ?? {};
              if (attrs.service) {
                formatted = { title: attrs.service, href: attrs.url };
                break;
              }
              // Use the first inner block if it exists; otherwise fall back to the block itself.
              // An empty innerBlocks array [] is truthy, so must check .length > 0 explicitly —
              // core/button keeps its href/text in its own innerHTML, not in a child block.
              const html = getBlockInnerHtmlString(
                child?.innerBlocks?.length > 0 ? child.innerBlocks[0] : child
              );
            
              let href = typeof attrs.url === 'string' && attrs.url ? attrs.url : '';
              let title = '';
              if (html) {
                try {
                  const $ = cheerio.load(html);
                  const a = $('a').first();
                  if (a?.length) {
                    href = a.attr('href') || href;
                    title = a.text().trim();
                    
                  } else {
                    title = $('button').first().text().trim();
                    
                  }
                } catch (e) {
                  console.warn('Error parsing innerHTML for link:', e);
                }
              }
              if (!title) {
                title =
                  (typeof attrs.text === 'string' && attrs.text.trim()) ||
                  (typeof attrs.title === 'string' && attrs.title.trim()) ||
                  (html ? stripHtmlTags(html).trim() : '') ||
                  '';
              }
              formatted = { title, href: href || '' };
              break;
            }

            case 'file': {
              // Extract media URL from innerHTML: img (core/image) or audio/source (core/audio)
              let fileName = '';
              let imgUrl = child?.attrs?.src ?? child?.attrs?.url;
              let id = child?.attrs?.id;

              const innerHtml = child?.innerHTML;
              if (innerHtml && typeof innerHtml === 'string') {
                try {
                  const $ = cheerio.load(innerHtml);
                  const imgTag = $('img').first();
                  if (imgTag.length) {
                    const src = imgTag.attr('src');
                    if (src) {
                      imgUrl = src;
                      // Extract filename from URL
                      const urlParts = src.split('/');
                      const fileNameWithExt = urlParts[urlParts?.length - 1]?.split('?')[0]; // Remove query params
                      fileName = fileNameWithExt.includes('.') ? fileNameWithExt.substring(0, fileNameWithExt.lastIndexOf('.')) : fileNameWithExt;
                    }
                  }
                  if (!fileName) {
                    const audioTag = $('audio').first();
                    let audioSrc = audioTag.attr('src');
                    if (!audioSrc) {
                      audioSrc = audioTag.find('source').first().attr('src') || '';
                    }
                    if (audioSrc) {
                      imgUrl = audioSrc;
                      const urlParts = audioSrc.split('/');
                      const fileNameWithExt = urlParts[urlParts.length - 1].split('?')[0];
                      fileName = fileNameWithExt.includes('.') ? fileNameWithExt.substring(0, fileNameWithExt.lastIndexOf('.')) : fileNameWithExt;
                    }
                  }
                } catch (htmlError) {
                  console.warn('Error parsing innerHTML for img/audio:', htmlError);
                }
              }
              // Blocks that store file URL on attrs (e.g. core/file href; some exports typo "herf")
              if (!fileName && (child?.attrs?.href || child?.attrs?.herf)) {
                const attrHref = child?.attrs?.href || child?.attrs?.herf;
                if (typeof attrHref === 'string' && attrHref) {
                  imgUrl = attrHref;
                  const urlParts = attrHref.split('/');
                  const fileNameWithExt = urlParts[urlParts.length - 1].split('?')[0];
                  fileName = fileNameWithExt.includes('.')
                    ? fileNameWithExt.substring(0, fileNameWithExt.lastIndexOf('.'))
                    : fileNameWithExt;
                }
              }

              // If no filename extracted from innerHTML, try to get it from src URL
              if (!fileName && imgUrl) {
                const urlParts = imgUrl.split('/');
                fileName = urlParts[urlParts.length - 1].split('?')[0];
              }

              const asset = assetData[`assets_${id}`] || assetData[fileName?.replace(/-/g, '_')?.toLowerCase()];
              formatted = asset;
              break;
            }

            case 'markdown':
              formatted = stripHtmlTags(child?.innerHTML);
              break;

            case 'group': {
             
              const attrs = child?.attrs || child?.attributes;
              const childBlockName =
                resolvedBlockName(child) || attrs?.originalName || child?.blockName;
              // Jetpack Story: slides in attrs.mediaFiles. Non-multiple CS groups get the first slide only.
              if (
                childBlockName === 'jetpack/story' &&
                Array.isArray(attrs?.mediaFiles)
              ) {
                const slides = attrs.mediaFiles.map((mf: any) => {
                  const id = mf?.id;

                  const imgUrl = mf?.url || '';
                  let baseName = '';
                  if (imgUrl) {
                    const urlParts = imgUrl.split('/');
                    const withExt = urlParts[urlParts.length - 1].split('?')[0];
                    baseName = withExt.includes('.')
                      ? withExt.substring(0, withExt.lastIndexOf('.'))
                      : withExt;
                  }
                  const asset = assetData[`assets_${id}`];

                  const groupCsUid = field?.backupFieldUid || '';
                  const isDirectChildOfThisGroup = (f: any) => {
                    const uid = f?.backupFieldUid || '';
                    if (groupCsUid && uid?.startsWith(`${groupCsUid}.`)) {
                      const rest = uid?.slice(groupCsUid?.length + 1);
                      return Boolean(rest && !rest?.includes('.'));
                    }
                    const slug = getFieldName(childBlockName);
                    return Boolean(slug && f?.contentstackField?.includes(slug));
                  };
                  const titleField = fields?.find(
                    (f: any) =>
                      f?.otherCmsField?.toLowerCase() === 'title' &&
                      isDirectChildOfThisGroup(f),
                  );
                  const altField = fields?.find(
                    (f: any) =>
                      f?.otherCmsField?.toLowerCase() === 'alt' &&
                      isDirectChildOfThisGroup(f),
                  );
                  const captionField = fields?.find(
                    (f: any) =>
                      f?.otherCmsField?.toLowerCase() === 'caption' &&
                      isDirectChildOfThisGroup(f),
                  );

                  const slide: Record<string, any> = { image: asset };
                  if (titleField?.contentstackFieldUid) {
                    slide[getLastUid(titleField.contentstackFieldUid)] =
                      formatChildByType(mf?.title, titleField, assetData, fields, mf?.title);
                  }
                  if (altField?.contentstackFieldUid) {
                    slide[getLastUid(altField.contentstackFieldUid)] =
                      formatChildByType(mf?.alt, altField, assetData, fields, mf?.alt);
                  }
                  if (captionField?.contentstackFieldUid) {
                    slide[getLastUid(captionField.contentstackFieldUid)] =
                      formatChildByType(mf?.caption, captionField, assetData, fields, mf?.caption);
                  }
                  return slide;
                });
                // Non-multiple CS groups expect one object; Jetpack mediaFiles is always an array.
                formatted =
                  slides.length === 0
                    ? undefined
                    : field?.advanced?.multiple === true
                      ? slides
                      : slides[0];
              } 
              break;
            }

            case 'dropdown': {
              const options = field?.options || [];
              const matchedOption = options.find(
                (opt: any) =>
                  String(opt.value) === String(attrValue) ||
                  String(opt.value) === String(child?.attrs?.[attrKey]) ||
                  String(opt.value) === String(child?.attributes?.[attrKey]),
              );
              formatted = matchedOption ? matchedOption.value : null;
              break;
            }
            default:
              // Default formatting - preserve original structure with null check
              formatted = attrValue ?? null;
          }
        } catch (attrError) {
          console.warn(`Error processing attribute ${attrKey}:`, attrError);
          if (attrKey && formatted !== undefined && formatted !== null && typeof formatted === 'object') {
            formatted[attrKey] = null;
          } else {
            formatted = null;
          }
        }
     
  } catch (error) {
    console.error('Error in formatChildByType:', error);
    formatted = 'Failed to process block attributes';
  }
  
  return formatted;
}
const extractCategoryReference = (categories: any) => {
  const categoryArray = Array?.isArray(categories) ? categories : [categories];

  const categoryReference = categoryArray?.filter((category: any) => category?.attributes?.domain === 'category');

  return categoryReference;

}

const extractTermsReference = (terms: any) => {
  const termArray = Array?.isArray(terms) ? terms : [terms];
  const termReference = termArray?.filter((term: any) => term?.attributes?.domain !== 'category');
  return termReference;
}

/**
 * Read the raw WXR XML for a project. Supports multi-file input (one export per post type): when
 * `inputPath` is a DIRECTORY, every `*.xml` inside is concatenated so downstream cheerio `$('item')`
 * lookups see items from every file — letting several post-type exports migrate into one stack. A
 * single-file path behaves exactly as before. WordPress post IDs are globally unique within a site's
 * exports, so per-item `wp:post_id` lookups across the merged blob stay unambiguous.
 */
async function readWxrXml(inputPath: string): Promise<string> {
  const stat = await fs.promises.stat(inputPath).catch(() => null);
  if (stat?.isDirectory()) {
    const files = (await fs.promises.readdir(inputPath))
      .filter((f) => f.toLowerCase().endsWith('.xml'))
      .sort();
    const parts = await Promise.all(
      files.map((f) => fs.promises.readFile(path.join(inputPath, f), 'utf8')),
    );
    return parts.join('\n');
  }
  return fs.promises.readFile(inputPath, 'utf8');
}

async function saveEntry(fields: any, entry: any,  file_path: string, assetData : any, categories: any, master_locale: string, destinationStackId: string, project: any, allTerms: any, duplicateBlockMappings?: Record<string, string>, allowedSeoUids?: Set<string>, ctMappingUids: string[] = []) {
  console.info("saveEntry");
  const locale = getLocale(master_locale, project) || master_locale;
  const mapperKeys = project?.mapperKeys || {};
  const authorsCtName = mapperKeys[MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME] ? mapperKeys[MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME] : MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME;
  const authorsSave = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, MIGRATION_DATA_CONFIG?.ENTRIES_DIR_NAME, authorsCtName, locale);
  const authorsFilePath = path.join(authorsSave, `${locale}.json`);
  let authorsData: Record<string, any> = {};
  try {
    authorsData = JSON.parse(await fs.promises.readFile(authorsFilePath, "utf8")) || {};
  } catch {
    console.warn(`Authors file not found at ${authorsFilePath}, proceeding without author references`);
  }

  //const Jsondata = await fs.promises.readFile(file_path, "utf8");
  const xmlData = await readWxrXml(file_path);
  const $ = cheerio.load(xmlData, { xmlMode: true });
  const items = $('item');
  const entryData: Record<string, any> = {};

  // Per authored content type, whether it declares a taxonomy field. An entry for an authored content
  // type that has NO taxonomy field must not carry a `taxonomies` key, else the CLI import rejects it
  // ("The content type '<uid>' does not have a taxonomy field."). Content types that aren't authored
  // (mapper-generated) always include the taxonomy field, so those default to attaching.
  const authoredHasTaxonomy = new Map<string, boolean>();
  const authoredCtByUid = new Map<string, any>();
  const authoredGfByUid = new Map<string, any>();
  try {
    const modelDir = resolveArticleModelDir(project);
    if (existsSync(modelDir)) {
      const { contentTypes: authoredCts, globalFields: authoredGfs } = await loadAuthoredSchemas(modelDir);
      for (const ct of authoredCts) {
        authoredCtByUid.set(ct?.uid, ct);
        authoredHasTaxonomy.set(
          ct?.uid,
          Array.isArray(ct?.schema) && ct.schema.some((f: any) => f?.data_type === 'taxonomy'),
        );
      }
      for (const gf of authoredGfs) authoredGfByUid.set(gf?.uid, gf);
    }
  } catch (err) {
    console.warn('Could not read authored content types for taxonomy check:', err);
  }
  // Side entries generated as a by-product of building a main entry (e.g. faq_item docs extracted from a
  // course body). Keyed by target content type uid → { entryUid: entry }. Written to their own
  // entries/<ct>/<locale>/<locale>.json after the main loop.
  const sideEntries: Record<string, Record<string, any>> = {};
  // Content-type uid -> title -> times seen. WordPress export titles are NOT globally unique (distinct
  // posts can share a title, e.g. three separate "SPC Welcome Webinar" events), but every content type
  // this migration writes to has `title: unique`. Disambiguates every title (main entries and generated
  // section side entries alike) the first time it collides within its own content type, rather than
  // trusting the source title or a per-parent-only counter to already be unique.
  const usedTitles = new Map<string, Map<string, number>>();
  // Taxonomy uid → whether authored, matched loosely (case- and separator-insensitive) so a WP post
  // type / mapper uid resolves to its authored content type even when they differ by `-` vs `_`.
  const normUid = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const authoredTaxByNorm = new Map<string, boolean>();
  for (const [uid, has] of authoredHasTaxonomy) authoredTaxByNorm.set(normUid(uid), has);
  // Does the mapper for THIS content type declare a taxonomy field? (Positive signal for CTs that
  // aren't in the authored model but were built with one.)
  const mapperDeclaresTaxonomy =
    Array.isArray(fields) &&
    fields.some(
      (f: any) =>
        f?.contentstackFieldType === 'taxonomy' ||
        f?.data_type === 'taxonomy' ||
        (typeof f?.contentstackFieldUid === 'string' && getLastUid(f.contentstackFieldUid) === 'taxonomies'),
    );
  /**
   * Whether the content type an item maps to declares a taxonomy field. Contentstack rejects an entry
   * carrying `taxonomies` when its content type has no taxonomy field, so we attach ONLY when the field
   * is positively confirmed — via the authored schema (by POST_TYPE_TARGETS or the mapping's own uids)
   * or the mapper — and default to NOT attaching otherwise. Prevents "content type '<uid>' does not have
   * a taxonomy field" for unmapped types (e.g. external → external-links).
   */
  const contentTypeHasTaxonomyField = (postType: string | undefined): boolean => {
    const ctUid = targetForPostType(postType)?.contentType;
    if (ctUid && authoredHasTaxonomy.has(ctUid)) return authoredHasTaxonomy.get(ctUid)!;
    for (const cand of [postType, ...ctMappingUids]) {
      const has = authoredTaxByNorm.get(normUid(cand));
      if (has !== undefined) return has;
    }
    return mapperDeclaresTaxonomy;
  };

  try {
    if(entry ){
      let cachedPostsForType: any[] | null = null;
      let cachedPostType: string | null = null;

      // Process each entry with its corresponding XML item
      for (let i = 0; i < entry?.length; i++) {
        const taxonomies: any = [];
        const tags: any = [];
        const item = entry[i];
        const terms: any = [];

        // Tags live inline on each <item> as <category domain="post_tag" ...> and do NOT depend on
        // channel-level <wp:category> definitions. Extract them unconditionally so tag data survives
        // even when the WXR export omits channel taxonomies. Category/term taxonomies still require
        // channel-level defs and remain in the guarded block below.
        const itemCategories = Array.isArray(item?.['category'])
          ? item['category']
          : (item?.['category'] ? [item['category']] : []);
        tags.push(
          ...itemCategories.filter((category: any) => category?.attributes?.domain === 'post_tag'),
        );

        if(itemCategories.length > 0 && categories?.length > 0){
          const category = itemCategories.filter((category: any) => category?.attributes?.domain === 'category');

          // for(const cat of category){
          //   const parentCategoryUid = categories?.find((category: any) => category?.["wp:category_nicename"] === cat?.attributes?.nicename)?.["wp:category_parent"];
          //   const parentCategory = parentCategoryUid ? categories?.find((category: any) => category?.["wp:category_nicename"] === parentCategoryUid)?.['wp:term_id'] 
          //   : categories?.find((category: any) => category?.["wp:category_nicename"] === cat?.attributes?.nicename)?.['wp:term_id'];
          //   const categoryName = cat?.attributes?.nicename;
            
          //   taxonomies.push({
          //     "taxonomy_uid": parentCategoryUid
          //       ? `${normalizeNicenameForUid(parentCategoryUid)}_${parentCategory}`
          //       : `${normalizeNicenameForUid(categoryName)}_${parentCategory}`,
          //     "term_uid": parentCategoryUid
          //       ? normalizeNicenameForUid(categoryName)
          //       : `${normalizeNicenameForUid(categoryName)}_${parentCategory}`
          //   });
          // } 

          const termCategory = itemCategories.filter((category: any) => category?.attributes?.domain !== 'category');
          const seenTermUids = new Set<string>();
          for (const term of termCategory) {
            const uid = allTerms?.find((t: any) => term?.attributes?.nicename === t?.["wp:term_slug"])?.["wp:term_id"];
            if (!uid) continue;
            const termUid = `terms_${uid}`;
            if (seenTermUids.has(termUid)) continue;
            seenTermUids.add(termUid);
            terms.push({ "uid": termUid, "_content_type_uid": 'terms' });
          }
        } else if (itemCategories.length > 0) {
          // Inline-only WXR (no channel <wp:category> defs): derive taxonomy references straight from
          // the inline <category domain=... nicename=...> tags. domain -> taxonomy_uid,
          // nicename -> term_uid, matching the taxonomies synthesized in createTaxonomy. `author`
          // maps to the Author reference and `post_tag` to native entry tags, so both are skipped.
          const seenTaxonomyRefs = new Set<string>();
          for (const cat of itemCategories) {
            const domain = cat?.attributes?.domain;
            if (!domain || domain === 'author' || domain === 'post_tag') continue;
            const taxonomy_uid = normalizeNicenameForUid(domain);
            const term_uid = normalizeNicenameForUid(cat?.attributes?.nicename);
            if (!term_uid) continue;
            const key = `${taxonomy_uid}:${term_uid}`;
            if (seenTaxonomyRefs.has(key)) continue;
            seenTaxonomyRefs.add(key);
            taxonomies.push({ taxonomy_uid, term_uid });
          }
        }
        // Every entry in this migration comes from the same WordPress site — there is no per-item WP
        // source data for the `site` taxonomy domain, so stamp it unconditionally (mirrors the fixed
        // site_scope.canonical_site default below).
        taxonomies.push({ taxonomy_uid: 'site', term_uid: 'scaled-agile' });
        const uid = idCorrector(`posts_${item?.["wp:post_id"]}`);

        const authorFieldInCT = fields?.find(
          (f: any) => f?.contentstackFieldUid === 'author' || f?.otherCmsField?.toLowerCase() === 'author',
        );

        const author = Object?.keys(authorsData)?.find((key: any) => authorsData[key]?.title?.toLowerCase() === item?.['dc:creator']?.toLowerCase());
        // Only emit a reference when the byline resolves to an actual author entry. An unresolved
        // `dc:creator` leaves `author` undefined, and `{ uid: undefined, _content_type_uid }`
        // serializes to `{ "_content_type_uid": "author" }` — a reference object with no `uid`. The
        // CLI audit destructures `uid` (undefined) then calls `reference.startsWith('blt')` on the
        // object, crashing with "reference.startsWith is not a function". Emit [] instead.
        const authorData = author
          ? [{
              "uid": author,
              "_content_type_uid": authorsCtName
            }]
          : [];
        const xmlItem = items?.length > 0 ? items?.filter((i, el) => {
          return $(el).find("wp\\:post_id").text() === item["wp:post_id"]
        }) : [];
      //   const targetItem = xmlItems.filter((i, el) => {
      //     return $(el).find("title").text() === entry.title;
      // }).first();
        // Find the matching XML item for this entry
        // const matchingXmlItem = xmlItems
        // .filter((_: any, el: any) => {
        //   const xmlPostId = $(el).find("wp\\:post_id").text();
        //   return xmlPostId === item["wp:post_id"];
        // })
        // .first();
        //console.info("matching xml item 1 --> ", matchingXmlItem);
          let wpPost: any;
        if(! project?.acfExportDir && project?.acfExportDir === ''){
          

        try {
          const postType = item?.['wp:post_type'];
          if (postType && postType !== cachedPostType) {
            const fetched = await fetchPostData(
              postType,
              project?.site_config ? { siteConfig: project.site_config } : {},
            );
            cachedPostsForType = Array.isArray(fetched) ? fetched : null;
            cachedPostType = postType;
          }
          wpPost = cachedPostsForType?.find(
            (p: any) => String(p?.id) === String(item?.['wp:post_id']),
          );
        } catch (acfFetchErr) {
          console.warn(`ACF REST fetch failed for entry ${uid}:`, acfFetchErr);
        }
      }

        const attachEntryMeta = (entryUid: string) => {
          const categoryReference = extractCategoryReference(item?.['category']);
          // Attach whenever taxonomy refs were collected — channel `category` domain (categoryReference)
          // or inline multi-domain tags (taxonomies populated above) — but only when the target content
          // type actually has a taxonomy field, or the import rejects the entry.
          if (
            (categoryReference?.length > 0 || taxonomies?.length > 0) &&
            contentTypeHasTaxonomyField(item?.['wp:post_type'])
          ) {
            entryData[entryUid]['taxonomies'] = taxonomies;
          }
          const termsReference = extractTermsReference(item?.['category']);
          if (termsReference?.length > 0 && terms?.length > 0) {
            entryData[entryUid]['terms'] = terms;
          }
          entryData[entryUid]['tags'] = tags?.map((tag: any) => tag?.text);
          if (authorFieldInCT && author) {
            const ctUid = authorFieldInCT?.refrenceTo?.[0] ?? authorsCtName;
            entryData[entryUid]['author'] = [{ uid: author, _content_type_uid: ctUid }];
          }
          entryData[entryUid]['locale'] = locale;
          entryData[entryUid]['publish_details'] = [];
        };

        if (xmlItem && xmlItem?.length > 0) {
          // Extract individual content encoded for this specific item
          const contentEncoded = $(xmlItem)?.find("content\\:encoded")?.text() || '';
          const blocksJson = await setupWordPressBlocks(contentEncoded);
          const blocksOutDir = path.join(
            MIGRATION_DATA_CONFIG.DATA,
            destinationStackId,
            'wordpress_blocks',
            String(item?.['wp:post_type'] || 'unknown').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().replace(/\s+/g, '_').slice(0, 40)
          );
          await fs.promises.mkdir(blocksOutDir, { recursive: true });
          await fs.promises.writeFile(
            path.join(blocksOutDir, `${uid}_${String(item?.title || 'untitled').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().replace(/\s+/g, '_').slice(0, 80)}.json`),
            JSON.stringify(blocksJson, null, 2),
            'utf8'
          );

          customLogger(project?.id, destinationStackId,'info', `Processed blocks for entry ${uid}`);


          // Post types mapped in POST_TYPE_TARGETS whose target content type is authored in the model
          // folder are shaped by the generic schema-driven engine (article, video, …). Everything else
          // keeps the mapper-driven path with its legacy field assignments below. A per-item override
          // (page-remap.json) can send an individual page to a different content type than its post
          // type's default — e.g. a Japanese blog page into `article`.
          const target = targetForItem(item, resolveArticleModelDir(project));
          const defaultTarget = targetForPostType(item?.['wp:post_type']);
          const targetCt = target ? authoredCtByUid.get(target.contentType) : undefined;
          // When the override sends this item to a different content type than the folder currently
          // being written, emit it as a SIDE ENTRY so it lands in entries/<thatContentType>/ instead —
          // the same mechanism faq_item/flexible_layouts use. Keeps createEntry's per-post-type folder
          // logic untouched while still distributing pages across models.
          const isRemapped = Boolean(
            target && defaultTarget && target.contentType !== defaultTarget.contentType,
          );
          if (target && targetCt) {
            const built = buildEntryFromSchema(targetCt, blocksJson, item, {
              uid,
              link: item?.link,
              contentKind: target.contentKind,
              assetData,
              authorData,
              taxonomies,
              locale,
              allowedSeoUids,
              globalFieldsByUid: authoredGfByUid,
              contentTypesByUid: authoredCtByUid,
              sideEntries,
              usedTitles,
            });
            // ACF-sourced fields (e.g. case_study_details, is_featured) come from ACF, not
            // content:encoded — merge them on top when present.
            let finalEntry = built;
            if (!project?.acfExportDir && wpPost?.acf) {
              const acfSchema = await createAcfSchema(fields, wpPost.acf, item?.title, uid, assetData, duplicateBlockMappings);
              // ACF has no notion of the flexible_layouts side entry buildEntryFromSchema just created
              // and referenced from a body/section field (e.g. case_studies.body_sections,
              // review_videos.body_content) — its own value for that uid would silently overwrite the
              // reference, orphaning the side entry. Never let the ACF merge touch those fields.
              const sectionRefUids = new Set<string>(
                (targetCt?.schema || [])
                  .filter((f: any) => isSectionReferenceField(f, authoredCtByUid))
                  .map((f: any) => String(f.uid)),
              );
              for (const key of sectionRefUids) delete acfSchema[key];
              finalEntry = { ...finalEntry, ...acfSchema };
            }
            if (isRemapped) {
              const store = sideEntries[target.contentType] ?? (sideEntries[target.contentType] = {});
              store[uid] = finalEntry;
              console.info(`Remapped ${uid} (${item?.['wp:post_name']}) into '${target.contentType}'`);
              continue; // written to entries/<target>/ instead of this post type's own file
            }
            entryData[uid] = finalEntry;
            console.info(`Processed entry ${uid} into '${target.contentType}' via schema-driven builder`);
          } else {
            // Pass individual content to createSchema
            entryData[uid] = await createSchema(fields, blocksJson, item?.title, uid, assetData, duplicateBlockMappings, item?.['wp:postmeta'], item?.link);

            if (!project?.acfExportDir && wpPost?.acf) {
              const acfSchema = await createAcfSchema(fields, wpPost.acf, item?.title, uid, assetData, duplicateBlockMappings);
              entryData[uid] = { ...entryData[uid], ...acfSchema };
            }
            const termsReference = extractTermsReference(item?.['category']);
            if(termsReference?.length > 0 && terms?.length > 0) {
              entryData[uid]['terms'] = terms;
            }
            entryData[uid]['tags'] = tags?.map((tag: any) => tag?.text);
            entryData[uid]['author'] = authorData;
            entryData[uid]['locale'] = locale;
            entryData[uid]['publish_details'] = [];

            // Editorial summary
            const excerptHtml = String(item?.['excerpt:encoded'] ?? '').trim();
            if (excerptHtml) {
              entryData[uid]['excerpt'] = stripHtmlTags(excerptHtml);
            }
            // Lifecycle: status + created/updated dates (ISO for the isodate fields)
            if (item?.['wp:status']) {
              entryData[uid]['status'] = String(item['wp:status']);
            }
            const createdIso = toIsoDate(item?.['wp:post_date_gmt'] ?? item?.['wp:post_date']);
            if (createdIso) entryData[uid]['cs_created_at'] = createdIso;
            const updatedIso = toIsoDate(item?.['wp:post_modified_gmt'] ?? item?.['wp:post_modified']);
            if (updatedIso) entryData[uid]['cs_updated_at'] = updatedIso;

            if(item?.['wp:postmeta']?.length > 0){
              const postmeta = item?.['wp:postmeta'];
              const seo: Record<string, any> = {};
              let thumbnailId: string | undefined;
              for(const meta of postmeta){
                const metaKey = meta?.['wp:meta_key'];
                const metaValue = meta?.['wp:meta_value'];
                // Yoast SEO → reusable "SEO" global field. A postmeta key under the `_yoast_wpseo_`
                // prefix maps to a sub-field (uid derived from the key), but only when that uid is
                // declared by the SEO global field schema (allowedSeoUids) — Contentstack drops entry
                // keys with no matching schema field, so writing them would silently lose the value.
                const seoSubUid = yoastSeoSubFieldUid(metaKey);
                if (seoSubUid && (!allowedSeoUids || allowedSeoUids.has(seoSubUid))) {
                  if (seoSubUid === 'yoast_wpseo_keywordsynonyms') {
                    const joined = parseYoastKeywordSynonyms(metaValue);
                    if (joined) seo[seoSubUid] = joined;
                  } else if (seoSubUid === 'yoast_wpseo_focuskeywords') {
                    const joined = parseYoastFocusKeywords(metaValue);
                    if (joined) seo[seoSubUid] = joined;
                  } else {
                    seo[seoSubUid] = metaValue;
                  }
                }
                if(metaKey === '_thumbnail_id' && metaValue){
                  thumbnailId = String(metaValue);
                }
              }
              if (Object.keys(seo).length > 0) {
                entryData[uid]['seo'] = seo;
              }
              // Featured image: attach the post thumbnail (_thumbnail_id → attachment) as a Contentstack
              // asset reference on the `featured_image` file field. Only when the referenced asset was
              // successfully downloaded/registered (present in assetData); failed downloads leave it unset.
              if (thumbnailId) {
                const featuredAsset = assetData?.[`assets_${thumbnailId}`];
                console.info(`Looking for featured image for entry ${uid} with thumbnail ID ${thumbnailId}`);
                if (featuredAsset) {
                  console.info(`Attaching featured image for entry ${uid} from thumbnail ID ${thumbnailId}`);
                  entryData[uid]['featured_image'] = featuredAsset;
                }
              }
            }

            attachEntryMeta(uid);
          }
          console.info(`Processed entry ${uid} with individual content`);
        } else if (wpPost?.acf) {
          entryData[uid] = await createAcfSchema(fields, wpPost.acf, item?.title, uid, assetData, duplicateBlockMappings);
          attachEntryMeta(uid);
          console.info(`Processed entry ${uid} from ACF only`);
        } else {
          console.warn(`No matching XML item found for entry ${uid}`);
        }
      }
    }
  } catch (err) {
    if (err instanceof Error) {
      console.warn(`⚠️ Failed to parse blocks for:`, err.message);
    } else {
      console.warn(`⚠️ Failed to parse blocks for:`, err);
    }
  }
  // Persist any side entries (e.g. faq_item docs extracted from course bodies) into their own content
  // type entries folder. Merge with anything already written so repeated content-type passes append.
  for (const [ctUid, entriesById] of Object.entries(sideEntries)) {
    if (!ctUid || !entriesById || !Object.keys(entriesById).length) continue;
    const sideFolderPath = path.join(
      MIGRATION_DATA_CONFIG.DATA, destinationStackId, MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME, ctUid, locale,
    );
    if (!existsSync(sideFolderPath)) await fs.promises.mkdir(sideFolderPath, { recursive: true });
    const sideFilePath = path.join(sideFolderPath, `${locale}.json`);
    let merged: Record<string, any> = entriesById;
    if (existsSync(sideFilePath)) {
      try {
        const existing = JSON.parse(await fs.promises.readFile(sideFilePath, 'utf8')) || {};
        merged = { ...existing, ...entriesById };
      } catch { merged = entriesById; }
    }
    await writeFileAsync(sideFilePath, merged, 4);
    await fs.promises.writeFile(
      path.join(sideFolderPath, 'index.json'), JSON.stringify({ '1': `${locale}.json` }, null, 4), 'utf-8',
    );
    await fanOutEntriesToAdditionalLocales(
      sideFolderPath, locale,
      path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME, ctUid),
      project,
    );
    console.info(`Wrote ${Object.keys(entriesById).length} side entries into '${ctUid}'`);
  }

  return entryData;
}
/**
 * Replicate the master-locale entries JSON + index into each additional destination locale
 * folder so the CLI import creates entry variants under every mapped locale, not just master.
 * WP's WXR format doesn't carry per-locale content, so each locale gets the same payload —
 * Contentstack's fallback chain handles the read-side behavior and the user can edit the
 * variants later.
 */
async function fanOutEntriesToAdditionalLocales(
  postFolderPath: string,
  masterLocaleCode: string,
  contentTypeRoot: string,
  project: any,
): Promise<void> {
  const additional = project?.locales ?? {};
  const masterFilePath = path.join(postFolderPath, `${masterLocaleCode}.json`);
  if (!existsSync(masterFilePath)) return;
  const masterContent = await fs.promises.readFile(masterFilePath, 'utf-8');
  for (const destLocale of Object.keys(additional)) {
    if (!destLocale || destLocale === masterLocaleCode) continue;
    const localeFolderPath = path.join(contentTypeRoot, destLocale);
    if (!existsSync(localeFolderPath)) {
      await fs.promises.mkdir(localeFolderPath, { recursive: true });
    }
    const localeFilePath = path.join(localeFolderPath, `${destLocale}.json`);
    await fs.promises.writeFile(localeFilePath, masterContent, 'utf-8');
    await fs.promises.writeFile(
      path.join(localeFolderPath, 'index.json'),
      JSON.stringify({ '1': `${destLocale}.json` }, null, 4),
      'utf-8',
    );
  }
}

async function createEntry(file_path: string, packagePath: string, destinationStackId: string, projectId: string, contentTypes: any, mapperKeys: any, master_locale: string, project: any){
  const locale = getLocale(master_locale, project) || master_locale;
  const Jsondata = await fs.promises.readFile(packagePath, "utf8");
  const xmlData = await readWxrXml(file_path);
  const $ = cheerio.load(xmlData, { xmlMode: true });
  const entriesJsonData = JSON.parse(Jsondata);
  const entries = entriesJsonData?.rss?.channel?.["item"];
  const categories = entriesJsonData?.rss?.channel?.["wp:category"];
  const allCategories = Array?.isArray(categories) ? categories : (categories ? [categories] : []);

  const authorsData = entriesJsonData?.rss?.channel?.["wp:author"];
  const authors = Array?.isArray(authorsData) ? authorsData : [authorsData];

  const termsData = entriesJsonData?.rss?.channel?.["wp:term"];
  const allTerms = Array?.isArray(termsData) ? termsData : [termsData];
 
  assetsSave = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME);
  const assetsSchemaPath = path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE);
  const assetData = JSON.parse(await fs.promises.readFile(assetsSchemaPath, "utf8")) || {};

  const itemsArray = Array?.isArray(entries) ? entries : (entries ? [entries] : []);

  // Sub-field uids the SEO global field declares (from the content_mapper). Entry SEO values are
  // filtered to this set so Yoast keys with no matching schema field aren't written (and dropped).
  const allowedSeoUids = seoAllowedSubUids(contentTypes);


  if(! existsSync(path.join(MIGRATION_DATA_CONFIG.DATA,destinationStackId,
    MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME))){
    await fs.promises.mkdir(path.join(MIGRATION_DATA_CONFIG.DATA,destinationStackId,
      MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME), { recursive: true });
  }
  const authorContentTypes = contentTypes?.filter((contentType: any) => contentType?.contentstackUid === 'author');
  if(authorContentTypes?.length > 0){
    const postsFolderName = mapperKeys[authorContentTypes?.[0]?.contentstackUid] ? mapperKeys[authorContentTypes?.[0]?.contentstackUid] : authorContentTypes?.[0]?.contentstackUid;
  
    // Create master locale folder and file
    postFolderPath = path.join(MIGRATION_DATA_CONFIG.DATA,destinationStackId,
      MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME, postsFolderName, locale);
    if(! existsSync(postFolderPath)){
      await fs.promises.mkdir(postFolderPath, { recursive: true });
    }
    const authorContent = await saveAuthors(authors, destinationStackId, projectId,authorContentTypes[0],master_locale, project?.locales, project);

    const filePath = path.join(postFolderPath,  `${locale}.json`);

    await writeFileAsync(filePath, authorContent, 4);

    await fs.promises.writeFile(path.join(postFolderPath, "index.json"),
      JSON.stringify({ "1":  `${locale}.json` }, null, 4), "utf-8"
    );
    await fanOutEntriesToAdditionalLocales(
      postFolderPath,
      locale,
      path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME, postsFolderName),
      project,
    );
  }

  const termsContentTypes = contentTypes?.filter((contentType: any) => contentType?.contentstackUid === 'terms');
  if(termsContentTypes?.length > 0){
    const termsFolderName = mapperKeys[termsContentTypes?.[0]?.contentstackUid] ? mapperKeys[termsContentTypes?.[0]?.contentstackUid] : termsContentTypes?.[0]?.contentstackUid;

    const termsFolderPath = path.join(MIGRATION_DATA_CONFIG.DATA,destinationStackId,
      MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME, termsFolderName, locale);

    if(! existsSync(termsFolderPath)){
      await fs.promises.mkdir(termsFolderPath, { recursive: true });
    }
    const termsContent = await createTerms(allTerms, destinationStackId, projectId, termsContentTypes[0],master_locale, project?.locales, project);
   
    const filePath = path.join(termsFolderPath,  `${locale}.json`);

    await writeFileAsync(filePath, termsContent, 4);

    await fs.promises.writeFile(path.join(termsFolderPath, "index.json"),
      JSON.stringify({ "1":  `${locale}.json` }, null, 4), "utf-8"
    );
    await fanOutEntriesToAdditionalLocales(
      termsFolderPath,
      locale,
      path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME, termsFolderName),
      project,
    );
  }
  const postContentTypes = contentTypes?.filter(
    (contentType: any) =>
      contentType?.contentstackUid !== 'author' &&
      contentType?.contentstackUid !== 'terms'
  );
  

  
  for(const contentType of postContentTypes){
    //await startingDirPosts(contentType?.contentstackUid, master_locale, project?.locales);
    const contentTypeUid = contentType?.contentstackTitle?.toLowerCase();
    const contentstackUid = contentType?.contentstackUid?.toLowerCase();
    const otherCmsUid = contentType?.otherCmsUid?.toLowerCase();
    // Post types mapped in POST_TYPE_TARGETS are written into their target content-type folder (and
    // merged there), so several WP post types can collapse into one Contentstack CT — e.g. blogs +
    // case studies both land in `article`. Unmapped post types keep their own per-post-type folder.
    const mappedTarget =
      targetForPostType(otherCmsUid) ||
      targetForPostType(contentstackUid) ||
      targetForPostType(contentTypeUid);
    const isMappedTarget = Boolean(mappedTarget);
    const postsFolderName = mappedTarget
      ? mappedTarget.contentType
      : (mapperKeys[contentType?.contentstackUid] ? mapperKeys[contentType?.contentstackUid] : contentType?.contentstackUid);
    // Create master locale folder and file
    postFolderPath = path.join(MIGRATION_DATA_CONFIG.DATA,destinationStackId,
      MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME, postsFolderName, locale);
    if(postFolderPath &&! existsSync(postFolderPath)){
      await fs.promises.mkdir(postFolderPath, { recursive: true });
    }
    const statusArray = ["publish", "inherit"];
    const entry = entries?.filter((data: any) => {
      const postType = data?.["wp:post_type"]?.toLowerCase();
      const matchesType =
        postType === contentTypeUid ||
        postType === contentstackUid ||
        postType === otherCmsUid;
      const matchesStatus = statusArray.includes(data?.["wp:status"]);
      return matchesType && matchesStatus;
    });

      const content = await saveEntry(contentType?.fieldMapping, entry,file_path, assetData, allCategories, master_locale, destinationStackId, project, allTerms, contentType?.duplicateBlockMappings, allowedSeoUids, [contentstackUid, otherCmsUid, contentTypeUid, mappedTarget?.contentType].filter(Boolean) as string[]) || {};

      const filePath = path.join(postFolderPath,  `${locale}.json`);
      // Article is fed by more than one WP post type; merge into any entries already written to the
      // shared folder so a later post type (e.g. case_study after post) appends instead of clobbering.
      let outContent: Record<string, any> = content;
      if (isMappedTarget && existsSync(filePath)) {
        try {
          const existing = JSON.parse(await fs.promises.readFile(filePath, "utf8")) || {};
          outContent = { ...existing, ...content };
        } catch {
          outContent = content;
        }
      }
      await writeFileAsync(filePath, outContent, 4);

      await fs.promises.writeFile(path.join(postFolderPath, "index.json"),
        JSON.stringify({ "1":  `${locale}.json` }, null, 4), "utf-8"
      );
      await fanOutEntriesToAdditionalLocales(
        postFolderPath,
        locale,
        path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME, postsFolderName),
        project,
      );
      console.info(`Processed content for ${contentType?.contentstackTitle}:`, Object?.keys(content)?.length, "items");
    }
}

/**
 * Folder holding the hand-authored Contentstack content models (article/course/event/… + global
 * fields). Defaults to `<repo>/export-data` (sibling of `api/`); override with the `CONTENT_MODEL_DIR`
 * env var. Files may be flat `*.json` OR split into `content-types/` and `global-fields/` subfolders.
 */
const CONTENT_MODEL_DIR = process.env.CONTENT_MODEL_DIR
  ? path.resolve(process.env.CONTENT_MODEL_DIR)
  : path.resolve(process.cwd(), '..', 'export-data');

/**
 * Resolve the folder holding the hand-authored content models. No project/database field is required:
 * it defaults to `CONTENT_MODEL_DIR`. Overridable, in order, by `project.articleModelDir` (only if
 * already present) or the `ARTICLE_MODEL_DIR` env var — both optional, so the default works with zero
 * configuration.
 */
function resolveArticleModelDir(project: any): string {
  if (project?.articleModelDir) return path.resolve(project.articleModelDir);
  if (process.env.ARTICLE_MODEL_DIR) return path.resolve(process.env.ARTICLE_MODEL_DIR);
  return CONTENT_MODEL_DIR;
}

/** Read a JSON file, returning `fallback` when it is missing or unparseable. */
async function readJsonOrDefault<T>(filePath: string, fallback: T): Promise<T> {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(await fs.promises.readFile(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

/**
 * Scan a folder of authored `*.json` schema files and classify each by CONTENT (not filename), so
 * files can be named anything (e.g. `article (8).json`, `cta (1).json`). A definition with `options`
 * is a content type; a definition with a `schema` but no `options` is a global field.
 *
 * Supports two layouts: flat `*.json` directly in `srcDir` (e.g. `article-model/`), or split into
 * subfolders like `content-types/` and `global-fields/` (e.g. `export-data/`). Each immediate
 * subdirectory's `*.json` files are read too; classification is by content, so the folder name is
 * incidental.
 */
async function loadAuthoredSchemas(srcDir: string): Promise<{ contentTypes: any[]; globalFields: any[] }> {
  const contentTypes: any[] = [];
  const globalFields: any[] = [];

  const jsonPaths: string[] = [];
  for (const name of await fs.promises.readdir(srcDir)) {
    const full = path.join(srcDir, name);
    const stat = await fs.promises.stat(full).catch(() => null);
    if (stat?.isDirectory()) {
      for (const sub of await fs.promises.readdir(full)) {
        if (sub.toLowerCase().endsWith('.json')) jsonPaths.push(path.join(full, sub));
      }
    } else if (name.toLowerCase().endsWith('.json')) {
      jsonPaths.push(full);
    }
  }

  for (const filePath of jsonPaths) {
    const def = await readJsonOrDefault<any>(filePath, null);
    if (!def?.uid || !Array.isArray(def?.schema)) continue;
    if (def?.options) contentTypes.push(def);
    else globalFields.push(def);
  }
  return { contentTypes, globalFields };
}

/**
 * "Drop-in" the hand-authored Article content model into the import folder instead of relying on the
 * per-post-type schema inferred by the mapper.
 *
 * The Contentstack CLI imports content types from the aggregate `content_types/schema.json` array and
 * global fields from `global_fields/globalfields.json` — NOT from the individual `<uid>.json` files —
 * so this rewrites those aggregates: it drops every Article-source post type (post/case_study) plus
 * any uid being re-supplied, then appends the authored content types (Article, Author, …) and upserts
 * the authored global fields (seo, page_settings, cta, …) by uid. Individual `<uid>.json` files are
 * kept in sync too for CLI versions that read them.
 *
 * Files are read from the folder resolved by resolveArticleModelDir (default `<repo>/export-data`)
 * and classified by content, so filenames don't matter. No-ops with a warning when the folder is
 * missing or holds no `article` content type, so a normal migration is unaffected. Must run AFTER
 * createEntry (entries already routed to the `article` folder) and BEFORE the CLI import.
 */
async function dropInArticleContentTypes(destinationStackId: string, projectId: string, project: any): Promise<void> {
  const srcDir = resolveArticleModelDir(project);
  const contentTypesDir = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, MIGRATION_DATA_CONFIG.CONTENT_TYPES_DIR_NAME);
  const globalFieldsDir = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, MIGRATION_DATA_CONFIG.GLOBAL_FIELDS_DIR_NAME);
  const ctSchemaPath = path.join(contentTypesDir, MIGRATION_DATA_CONFIG.CONTENT_TYPES_SCHEMA_FILE);
  const gfAggregatePath = path.join(globalFieldsDir, MIGRATION_DATA_CONFIG.GLOBAL_FIELDS_FILE_NAME);

  if (!existsSync(srcDir)) {
    const msg = `Article drop-in skipped: no authored content model folder at ${srcDir}. Create it (default '<repo>/export-data', or set CONTENT_MODEL_DIR/ARTICLE_MODEL_DIR) and put the content-type/global-field JSON files inside (flat, or under content-types/ and global-fields/).`;
    console.warn(msg);
    await customLogger(projectId, destinationStackId, 'warn', msg);
    return;
  }

  const { contentTypes: authoredDefs, globalFields: authoredGlobalFields } = await loadAuthoredSchemas(srcDir);
  const articleDef = authoredDefs.find((ct: any) => ct?.uid === ARTICLE_TARGET_CT_UID);
  if (!articleDef) {
    const msg = `Article drop-in: no content type with uid '${ARTICLE_TARGET_CT_UID}' found in ${srcDir}; entries were routed to the article folder but no schema was supplied, so the import will not create the Article content type.`;
    console.warn(msg);
    await customLogger(projectId, destinationStackId, 'warn', msg);
    return;
  }

  // Mapped source post types plus every uid we are re-supplying are dropped from the inferred
  // content-type set, then replaced by the authored definitions.
  const removeUids = new Set<string>(Object.keys(POST_TYPE_TARGETS));
  for (const ct of authoredDefs) removeUids.add(ct.uid);

  // 1. Rewrite the aggregate content-type index (schema.json) — what the CLI actually imports.
  const ctAggregate = await readJsonOrDefault<any[]>(ctSchemaPath, []);
  const filtered = (Array.isArray(ctAggregate) ? ctAggregate : []).filter(
    (ct: any) => !removeUids.has(ct?.uid),
  );
  filtered.push(...authoredDefs);
  await fs.promises.mkdir(contentTypesDir, { recursive: true });
  await fs.promises.writeFile(ctSchemaPath, JSON.stringify(filtered, null, 2));

  // 2. Keep individual <uid>.json files consistent: write authored, remove folded-in post types.
  const authoredUids = new Set(authoredDefs.map((d: any) => d.uid));
  for (const def of authoredDefs) {
    await fs.promises.writeFile(path.join(contentTypesDir, `${def.uid}.json`), JSON.stringify(def));
  }
  for (const postType of Object.keys(POST_TYPE_TARGETS)) {
    // Skip post types whose target IS an authored content type (e.g. video → video): that file was
    // just written above and must not be deleted. Only truly folded-in types (post/case_study → article)
    // are removed.
    if (authoredUids.has(postType)) continue;
    const inferred = path.join(contentTypesDir, `${postType}.json`);
    if (existsSync(inferred)) {
      try {
        await fs.promises.unlink(inferred);
      } catch (err) {
        console.warn(`Article drop-in: failed to remove inferred content type ${inferred}:`, err);
      }
    }
  }

  // 3. Upsert authored global fields (seo, page_settings, cta…) into the aggregate globalfields.json.
  if (authoredGlobalFields.length > 0) {
    const gfAggregate = await readJsonOrDefault<any[]>(gfAggregatePath, []);
    const byUid = new Map<string, any>(
      (Array.isArray(gfAggregate) ? gfAggregate : []).map((gf: any) => [gf?.uid, gf]),
    );
    for (const gf of authoredGlobalFields) byUid.set(gf.uid, gf);
    await fs.promises.mkdir(globalFieldsDir, { recursive: true });
    await fs.promises.writeFile(gfAggregatePath, JSON.stringify([...byUid.values()], null, 2));
  }

  const removedPostTypes = Object.keys(POST_TYPE_TARGETS).filter((u) => u !== ARTICLE_TARGET_CT_UID);
  const done = `Article drop-in complete: registered content types [${authoredDefs.map((d: any) => d.uid).join(', ')}] in schema.json (removed folded-in: ${removedPostTypes.join(', ') || 'none'}), upserted ${authoredGlobalFields.length} global field(s) [${authoredGlobalFields.map((g: any) => g.uid).join(', ')}], entries merged into '${ARTICLE_TARGET_CT_UID}'.`;
  console.info(done);
  await customLogger(projectId, destinationStackId, 'info', done);
}

async function createTaxonomy(file_path: string, packagePath: string, destinationStackId: string, projectId: string, contentTypes: any, mapperKeys: any, master_locale: string, project: any){
  console.info("createTaxonomy");
  const taxonomiesPath = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, MIGRATION_DATA_CONFIG.TAXONOMIES_DIR_NAME);
  await fs.promises.mkdir(taxonomiesPath, { recursive: true });

  const Jsondata = await fs.promises.readFile(packagePath, "utf8");
  const xmlData = await readWxrXml(file_path);
  const categoriesData = JSON.parse(Jsondata)?.rss?.channel?.["wp:category"] || JSON.parse(Jsondata)?.channel?.["wp:category"];
  const categoriesJsonData = Array?.isArray(categoriesData) ? categoriesData : (categoriesData ? [categoriesData] : []);

  if(categoriesJsonData?.length > 0){
    const allTaxonomies : any = {}
    for(const category of categoriesJsonData){
      if(!category?.['wp:category_parent']){
        const terms = [];
        
        const categoryName = category?.["wp:cat_name"];
        const categoryUid = `${category?.["wp:category_nicename"]}_${category?.["wp:term_id"]}`;
        const categoryDescription = category?.["wp:category_description"];
        const childCategories = categoriesJsonData?.filter((child: any) => child?.['wp:category_parent'] === category?.["wp:category_nicename"]);
        for(const childCategory of childCategories){
          terms?.push({
            "uid": normalizeNicenameForUid(childCategory?.["wp:category_nicename"]),
            "name": childCategory?.["wp:cat_name"],
            "description": childCategory?.["wp:category_description"],
            "parent_uid": normalizeNicenameForUid(categoryUid),
          })
        }
        const taxonomy = {
          "uid": normalizeNicenameForUid(categoryUid),
          "name": categoryName,
          "description": categoryDescription,
          
        }
        allTaxonomies[categoryUid] = {
          "uid": normalizeNicenameForUid(categoryUid),
          "name": categoryName,
          "description": categoryDescription,
          
        }
        terms?.push({
          "uid": normalizeNicenameForUid(categoryUid),
          "name": categoryName,
          "description": categoryDescription,
          "parent_uid": null,
        })
        const taxonomyData = {taxonomy, terms};
        await writeFileAsync(path.join(taxonomiesPath, `${normalizeNicenameForUid(categoryUid)}.json`), JSON.stringify(taxonomyData, null, 4), 4);
        customLogger(projectId, destinationStackId, 'info', `Category ${categoryName} has been successfully extracted`);
    }       
    }
    await writeFileAsync(path.join(taxonomiesPath, MIGRATION_DATA_CONFIG.TAXONOMIES_FILE_NAME), JSON.stringify(allTaxonomies, null, 4), 4);
  }
  else {
    // Inline-only WXR: no channel <wp:category> definitions. Synthesize taxonomies + terms from the
    // inline <category domain=... nicename=...> tags on the items — each domain a taxonomy, each
    // distinct nicename a (flat) term. Mirrors the mapper's inline derivation and the per-entry
    // taxonomy refs in saveEntry. `author` (Author reference) and `post_tag` (native entry tags)
    // are excluded so they aren't duplicated as taxonomies.
    const parsed = JSON.parse(Jsondata);
    const rawItems = parsed?.rss?.channel?.["item"] ?? parsed?.channel?.["item"];
    const itemsArray = Array?.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);
    const EXCLUDED_DOMAINS = new Set(["author", "post_tag"]);

    // domain uid -> { name, terms: Map<termUid, term> }
    const byDomain = new Map<string, { name: string; terms: Map<string, any> }>();
    for (const item of itemsArray) {
      const cats = Array?.isArray(item?.category) ? item.category : (item?.category ? [item.category] : []);
      for (const cat of cats) {
        const domain = cat?.attributes?.domain;
        if (!domain || EXCLUDED_DOMAINS.has(domain)) continue;
        const nicename = cat?.attributes?.nicename;
        if (!nicename) continue;
        const domainUid = normalizeNicenameForUid(domain);
        if (!byDomain.has(domainUid)) {
          byDomain.set(domainUid, { name: humanizeSlug(domain), terms: new Map() });
        }
        const termUid = normalizeNicenameForUid(nicename);
        const bucket = byDomain.get(domainUid)!;
        if (!bucket.terms.has(termUid)) {
          const termText = typeof cat?.text === 'string' && cat.text.trim() ? cat.text.trim() : humanizeSlug(nicename);
          bucket.terms.set(termUid, {
            "uid": termUid,
            "name": termText,
            "description": "",
            "parent_uid": null,
          });
        }
      }
    }

    // Pass 2 — nest hierarchical terms encoded in the term NAME with `>` (see nestHierarchicalTerms).
    for (const { terms } of byDomain.values()) {
      nestHierarchicalTerms(Array.from(terms.values()));
    }

    if (byDomain.size > 0) {
      const allTaxonomies: any = {};
      for (const [domainUid, { name, terms }] of byDomain) {
        const taxonomy = { "uid": domainUid, "name": name, "description": "" };
        allTaxonomies[domainUid] = { "uid": domainUid, "name": name, "description": "" };
        const taxonomyData = { taxonomy, terms: Array.from(terms.values()) };
        await writeFileAsync(path.join(taxonomiesPath, `${domainUid}.json`), JSON.stringify(taxonomyData, null, 4), 4);
        customLogger(projectId, destinationStackId, 'info', `Taxonomy ${name} has been successfully extracted`);
      }
      await writeFileAsync(path.join(taxonomiesPath, MIGRATION_DATA_CONFIG.TAXONOMIES_FILE_NAME), JSON.stringify(allTaxonomies, null, 4), 4);
    } else {
      console.warn("No categories found to extract");
      customLogger(projectId, destinationStackId, 'error', "No categories found to extract");
    }
  }

  // Static 'site' taxonomy — which Scaled Agile brand a piece of content belongs to. Not derived from
  // WXR categories (unlike everything above), so it's never produced by either branch: content types
  // that reference taxonomy_uid 'site' (e.g. external_link) previously got a term stamped on the entry
  // (see saveEntry) for a taxonomy that was never imported, so the CLI dropped it with
  // "Term 'scaled-agile' does not exist in taxonomy 'site'". Terms mirror the site_scope global field's
  // canonical_site enum so both stay in sync.
  const siteTaxonomyData = {
    taxonomy: { uid: 'site', name: 'Sites', description: '' },
    terms: [
      { uid: 'scaled-agile', name: 'Scaled Agile', description: '', parent_uid: null },
      { uid: 'scaled-group', name: 'Scaled Group', description: '', parent_uid: null },
      { uid: 'ai-native', name: 'AI-Native', description: '', parent_uid: null },
    ],
  };
  await writeFileAsync(path.join(taxonomiesPath, 'site.json'), JSON.stringify(siteTaxonomyData, null, 4), 4);
  const indexPath = path.join(taxonomiesPath, MIGRATION_DATA_CONFIG.TAXONOMIES_FILE_NAME);
  let taxonomiesIndex: any = {};
  try {
    taxonomiesIndex = JSON.parse(await fs.promises.readFile(indexPath, 'utf8'));
  } catch {
    // Index not written yet (e.g. the "no categories found" branch above never created it).
  }
  taxonomiesIndex['site'] = { uid: 'site', name: 'Sites', description: '' };
  await writeFileAsync(indexPath, JSON.stringify(taxonomiesIndex, null, 4), 4);
  customLogger(projectId, destinationStackId, 'info', "Taxonomy Sites has been successfully extracted");
}


// helper functions
async function writeFileAsync(filePath: string, data: any, tabSpaces: number) {
  filePath = path.resolve(filePath);
  data =
    typeof data == "object" ? JSON.stringify(data, null, tabSpaces)
      : data || "{}";
  await fs.promises.writeFile(filePath, data, "utf-8");
}

async function writeOneFile(indexPath: string, fileMeta: any) {
    fs.writeFile(indexPath, JSON.stringify(fileMeta), (err) => {
      if (err) {
        console.error('Error writing file: 3', err);
      }
    });
  }

const getKeys = (obj: Record<string, any>): string[] => { //Function to fetch all the locale codes
  return Object.keys(obj);
};

/************  Locale module functions start *********/
  
const createLocale = async (req: any, destinationStackId: string, projectId: string, project: any) => {
  const srcFunc = 'createLocale';
  try {
    const baseDir = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId);
    const localeSave = path.join(baseDir, MIGRATION_DATA_CONFIG.LOCALE_DIR_NAME);
    const allLocalesResp = await orgService.getLocales(req)
    const masterLocale = Object?.keys?.(project?.master_locale ?? LOCALE_MAPPER?.masterLocale)?.[0];
    const msLocale: any = {};
    const uid = uuidv4();
    msLocale[uid] = {
      "code": masterLocale,
      "fallback_locale": null,
      "uid": uid,
      "name": allLocalesResp?.data?.locales?.[masterLocale] ?? ''
    }
    const message = getLogMessage(
      srcFunc,
      `Master locale ${masterLocale} has been successfully transformed.`,
      {}
    )
    await customLogger(projectId, destinationStackId, 'info', message);
    const allLocales: any = {};
    for (const [key, value] of Object.entries(project?.locales ?? LOCALE_MAPPER.locales)) {
      const localeUid = uuidv4();
      if (key !== 'masterLocale' && typeof value === 'string') {
        allLocales[localeUid] = {
          "code": key,
          "fallback_locale": masterLocale,
          "uid": localeUid,
          "name": allLocalesResp?.data?.locales?.[key] ?? ''
        }
        const message = getLogMessage(
          srcFunc,
          `locale ${value} has been successfully transformed.`,
          {}
        )
        await customLogger(projectId, destinationStackId, 'info', message);
      }
    }
    const masterPath = path.join(localeSave, MIGRATION_DATA_CONFIG.LOCALE_MASTER_LOCALE);
    const allLocalePath = path.join(localeSave, MIGRATION_DATA_CONFIG.LOCALE_FILE_NAME);
    fs.access(localeSave, async (err) => {
      if (err) {
        fs.mkdir(localeSave, { recursive: true }, async (err) => {
          if (!err) {
            await writeOneFile(masterPath, msLocale);
            await writeOneFile(allLocalePath, allLocales);
          }
        })
      } else {
        await writeOneFile(masterPath, msLocale);
        await writeOneFile(allLocalePath, allLocales);
      }
    })
  } catch (err) {
    const message = getLogMessage(
      srcFunc,
      `error while Createing the locales.`,
      {},
      err
    )
    await customLogger(projectId, destinationStackId, 'error', message);
  }
}

const getTermsFieldValue = (field: any, data: any, url: string) => {
  const fieldUid = field?.uid;
  const otherCmsField = field?.otherCmsField;
  const fieldUidLower = fieldUid?.toLowerCase();
  const otherCmsFieldLower = otherCmsField?.toLowerCase();
  
  // Field mapping for common WordPress author fields
  const fieldMapping: Record<string, string> = {
    'term_taxonomy': 'wp:term_taxonomy',
    'term_slug': 'wp:term_slug',
    'term_parent': 'wp:term_parent',
    'term_name': 'wp:term_name',
    'termmeta': 'wp:termmeta',
    'term_description': 'wp:term_description',

  };
  const wpFieldKey = fieldMapping[fieldUidLower] || fieldMapping[otherCmsFieldLower];
  if (wpFieldKey) {
    const value = data[wpFieldKey];
    // Handle special cases
    if (wpFieldKey === 'wp:term_name' && !value) {
      return data['wp:term_name'];
    }
    return value;
  }
  return null;
}
const createTerms = async (allTerms: any, destinationStackId: string, projectId: string, contentType: any, master_locale: string, locales: object, project: any) => {
  const srcFunc = 'createTerms';
  const localeKeys = getKeys(locales)
  try {
    const termsData:{ [key: string]: any } = {}

    for (const data of allTerms) {
      const uid = `terms_${data["wp:term_id"]}`;
      const title = data?.["wp:term_name"];
      const url = `/${title?.toLowerCase()?.replace(/ /g, "_")}`;
      const customId = idCorrector(uid);

      const termdataEntry: any = {
        uid: uid,
        title: data?.["wp:term_name"],
        url: url,
      };

      // Process each field in the content type's field mapping
      if (contentType?.fieldMapping && Array?.isArray(contentType?.fieldMapping)) {
        for (const field of contentType.fieldMapping) {
          const fieldValue = getTermsFieldValue(field, data, url);
          
          // Store the field value in authordataEntry using field.uid
          if (field?.uid && fieldValue !== undefined && fieldValue !== null) {
            termdataEntry[field?.contentstackFieldUid] = formatChildByType(fieldValue, field, assetData, contentType?.fieldMapping);
          }
        }
      }
      termsData[customId] = termdataEntry
      termsData[customId].publish_details = [];
      const message = getLogMessage(
        srcFunc,
        `Entry title ${data["wp:term_name"]} (terms) in the ${master_locale} locale has been successfully transformed.`,
        {}
      );
      await customLogger(projectId, destinationStackId, 'info', message);
    }

    for (const loc of localeKeys) {
        if (loc === master_locale) continue;
      
        const localeFolderPath = path.join(entrySave, MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME, loc);
        const indexPath = path.join(localeFolderPath, "index.json");
      
        try {
          await fs.promises.writeFile(
            indexPath,
            JSON.stringify({ "1": `${loc}.json` }, null, 4)
          );
        } catch (err) {
          console.error(`Error writing index.json for locale ${loc}:`, err);
        }
    }

    const message = getLogMessage(
      srcFunc,
      `${allTerms?.length} Terms exported successfully`,
      {}
    )
    await customLogger(projectId, destinationStackId, 'info', message);


    return termsData;
  } catch (err) {
    const message = getLogMessage(
      srcFunc,
      `error while Createing the terms.`,
      {},
      err
    )
    await customLogger(projectId, destinationStackId, 'error', message);
  }
}

/************  Assests module functions start *********/

/**
 * Asset folder hierarchy created in the target stack: a parent `02-scaled-agile` with three children
 * (`illustrations`, `images`, `pdfs`). Assets are routed into a child by file type; anything that fits
 * none (video/office/etc.) lands directly under the parent. UIDs are stable readable strings so the
 * folder objects (folders.json) and each asset's `parent_uid` reference the same values.
 */
const ASSET_FOLDERS = {
  root: { uid: 'scaled_agile', name: '02-scaled-agile', parent_uid: null as string | null },
  illustrations: { uid: 'scaled_agile_illustrations', name: 'illustrations', parent_uid: 'scaled_agile' },
  images: { uid: 'scaled_agile_images', name: 'images', parent_uid: 'scaled_agile' },
  pdfs: { uid: 'scaled_agile_pdfs', name: 'pdfs', parent_uid: 'scaled_agile' },
} as const;

// Everything that goes into the `images` folder: raster images, SVGs, and videos (per requirement).
const IMAGE_FOLDER_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'ico', 'avif', 'bmp', 'tiff', // raster
  'svg', // vector
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v', // video
]);

/** folders.json content: one folder object per ASSET_FOLDERS entry, in the CLI-import shape. */
function assetFoldersJson(): any[] {
  return Object.values(ASSET_FOLDERS).map((f) => ({
    urlPath: `/assets/${f.uid}`,
    uid: f.uid,
    content_type: 'application/vnd.contenstack.folder',
    tags: [],
    name: f.name,
    is_dir: true,
    parent_uid: f.parent_uid,
    _version: 1,
  }));
}

/** Target folder uid for an asset, by file extension: pdf→pdfs, raster/svg/video→images, else root. */
function assetFolderUid(extension: string): string {
  const e = String(extension || '').replace(/^\./, '').toLowerCase();
  if (e === 'pdf') return ASSET_FOLDERS.pdfs.uid;
  if (IMAGE_FOLDER_EXTS.has(e)) return ASSET_FOLDERS.images.uid; // raster + svg + video
  return ASSET_FOLDERS.root.uid; // office docs / audio / archives / other → under the parent folder
}

async function startingDirAssests(destinationStackId: string) {
  try {
    // Check if assetsSave directory exists
    assetsSave = path.join(
      MIGRATION_DATA_CONFIG.DATA,
      destinationStackId,
      MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME
    );

    assetMasterFolderPath = path.join(
      MIGRATION_DATA_CONFIG.DATA,
      destinationStackId,
      "logs",
      MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME
    );

    failedJSONFilePath = path.join(
      assetMasterFolderPath,
      MIGRATION_DATA_CONFIG.ASSETS_FAILED_FILE
    );
    await fs.promises.mkdir(assetMasterFolderPath, { recursive: true });
      await fs.promises.writeFile(failedJSONFilePath,  "{}" );
    try {
      await fs.promises.access(assetsSave);
    } catch {
      // Directory doesn't exist, create it
      await fs.promises.mkdir(assetsSave, { recursive: true });
      // Create files directory for storing all asset files
      await fs.promises.mkdir(path.join(assetsSave, "files"), { recursive: true });
      await fs.promises.writeFile(
        path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_FILE_NAME),
        JSON.stringify({ "1" : 'index.json' }, null, 4)
      );
      await fs.promises.writeFile(
        path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE),
        "{}"
      );
      await fs.promises.writeFile(
        path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_FOLDER_FILE_NAME),
        JSON.stringify(assetFoldersJson(), null, 4)
      );
      await fs.promises.mkdir(assetMasterFolderPath, { recursive: true });
      await fs.promises.writeFile(failedJSONFilePath,  "{}" );

      return;
    }

    // Ensure files directory exists even if assetsSave already exists
    const filesDir = path.join(assetsSave, "files");
    try {
      await fs.promises.access(filesDir);
    } catch {
      await fs.promises.mkdir(filesDir, { recursive: true });
    }

    // Ensure the asset-folder hierarchy is present even when the assets dir already existed.
    await fs.promises.writeFile(
      path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_FOLDER_FILE_NAME),
      JSON.stringify(assetFoldersJson(), null, 4)
    );

    // Check if assets.json exists
    const assetsJsonPath = path.join(
      assetsSave,
      MIGRATION_DATA_CONFIG.ASSETS_FILE_NAME
    );
    const assetsSchemaJsonPath = path.join(
      assetsSave,
      MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE
    );
    try {
      await fs.promises.access(assetsJsonPath);
      // Read assets.json data
      const fileContent = await fs.promises.readFile(assetsJsonPath, "utf8");
      assetData = JSON.parse(fileContent);
    } catch {
      // assets.json doesn't exist, create it
      await fs.promises.writeFile(assetsJsonPath,  JSON.stringify({ "1" : MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE }, null, 4));
      return;
    }

    try {
      await fs.promises.access(assetsSchemaJsonPath);
      // Read assets.json data
      const fileContent = await fs.promises.readFile(assetsSchemaJsonPath, "utf8");
      assetData = JSON.parse(fileContent);
    } catch {
      // assets.json doesn't exist, create it
      await fs.promises.writeFile(assetsSchemaJsonPath, "{}");
      return;
    }

    // Check if assetMasterFolderPath exists
    try {
      await fs.promises.access(assetMasterFolderPath);
    } catch {
      // Directory doesn't exist, create it
      await fs.promises.mkdir(assetMasterFolderPath, { recursive: true });
      await fs.promises.writeFile(
        path.join(assetMasterFolderPath,MIGRATION_DATA_CONFIG.ASSETS_FAILED_FILE),
        "{}"
      );
      return;
    }
  } catch (error) {
    console.error("Error in startingDir:", error);
    return;
  }
}

function toCheckUrl(url : string, baseSiteUrl: string) {

  const validPattern = /^(https?:\/\/|www\.)/;
  return validPattern.test(url) ? url
    : `${baseSiteUrl}${url.replace(/^\/+/, "")}`;
}

function normalizeAssetUrl(url: string, baseSiteUrl: string): string {
  return encodeURI(toCheckUrl(url, baseSiteUrl));
}

/**
 * Base key for an asset URL, collapsing WordPress-generated size/scaled variants to their original so
 * inline `content:encoded` images aren't re-downloaded as duplicates of the attachment. WP names resized
 * copies `<name>-<W>x<H>.<ext>` (e.g. `foo-1024x576.jpg`) and the scaled original `<name>-scaled.<ext>`;
 * both collapse to `<name>.<ext>`. Only such a suffix immediately before the extension is stripped
 * (repeatedly, so `foo-scaled-300x200.jpg` → `foo.jpg`), leaving collision suffixes like `foo-2.jpg`
 * untouched. Lowercased and query/hash-stripped so trivial URL differences still match.
 */
function assetBaseKey(url: string, baseSiteUrl: string): string {
  let s = normalizeAssetUrl(url, baseSiteUrl).split('?')[0].split('#')[0].toLowerCase();
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/-(?:\d+x\d+|scaled)(\.[a-z0-9]+)$/i, '$1');
  }
  return s;
}

function isAssetUrlDownloaded(url: string, baseSiteUrl: string): boolean {
  const key = assetBaseKey(url, baseSiteUrl);
  return Object.values(assetData).some(
    (asset: any) => asset?.url && assetBaseKey(asset.url, baseSiteUrl) === key
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Max download attempts (initial + retries) per asset before giving up. */
const MAX_ASSET_ATTEMPTS = 4;

/**
 * Whether a failed asset download is worth retrying. The source host (Vercel-fronted) returns 403
 * under burst load (rate-limiting) — those recover on a spaced retry. 429 and 5xx are transient too,
 * as are network errors/timeouts (no response). A 404 is permanent (file deleted), so don't retry it.
 */
function isRetryableAssetError(err: any): boolean {
  const status = err?.response?.status ?? err?.status;
  if (status === 404) return false;
  if (status === 403 || status === 429) return true;
  if (typeof status === 'number' && status >= 500) return true;
  return !err?.response; // network error / timeout
}

/** Exponential backoff with jitter: 1s, 2s, 4s … capped at 8s, + up to 250ms jitter to de-sync bursts. */
function assetRetryBackoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 8000) + Math.floor(Math.random() * 250);
}

async function saveAsset(assets: any, retryCount: number, affix: string, destinationStackId: string, projectId: string, baseSiteUrl:string) {
  const srcFunc = 'saveAsset';
  const url = encodeURI(toCheckUrl(assets["wp:attachment_url"],baseSiteUrl));
  const originalName = url.split("/").pop() || "";
  const fileExtension = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
  const nameWithoutExt = originalName.includes('.') ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName;

  // WordPress alt text lives on the attachment as the `_wp_attachment_image_alt` postmeta. It is the
  // canonical accessibility/SEO text for the image, so carry it onto the Contentstack asset's
  // description (preferred over the usually-empty content/excerpt fallbacks).
  const attachmentMeta = Array.isArray(assets["wp:postmeta"])
    ? assets["wp:postmeta"]
    : (assets["wp:postmeta"] ? [assets["wp:postmeta"]] : []);
  const altText = attachmentMeta.find(
    (m: any) => m?.["wp:meta_key"] === "_wp_attachment_image_alt" && m?.["wp:meta_value"],
  )?.["wp:meta_value"] || "";

  let description =
    altText ||
    assets["description"] ||
    assets["content:encoded"] ||
    assets["excerpt:encoded"] ||
    "";
  description =
    description.length > 255 ? description.slice(0, 255) : description;

  const parent_uid = assetFolderUid(fileExtension);

  const customId = `assets_${assets["wp:post_id"]}`;
  // Use customId as filename to ensure uniqueness, preserve extension

  const filename = `${customId}${fileExtension}`;
  const assetPath = path.resolve(assetsSave, "files", customId);
  const filePath = path.join(assetPath, filename);

  // Skip only when the downloaded file already exists (not the empty folder).
  // Previously we mkdir'd assetPath then tested existsSync(assetPath), which is
  // always true after mkdir and incorrectly skipped every download.
  if (existsSync(filePath)) {
    return assets["wp:post_id"];
  }

  if (!existsSync(assetPath)) {
    await fs.promises.mkdir(assetPath, { recursive: true });
  }

  try {
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      }
    });
    // Ensure files directory exists
    fs.mkdirSync(
      path.resolve(assetsSave, "files", customId),
      { recursive: true }
    );
    fs.writeFileSync(path.resolve(assetsSave, "files", customId, filename), response.data);

    const stats = fs.lstatSync(path.resolve(assetsSave, "files", customId, filename));
    const acc: any = {};
    const key = customId;

    acc[key] = {
      uid: key,
      urlPath: `/assets/${customId}`,
      status: true,
      content_type: getMimeTypeFromExtension(fileExtension?.split('.')?.[1]),
      file_size: `${stats.size}`,
      tag: [],
      filename: filename,
      url,
      is_dir: false,
      parent_uid,
      _version: 1,
      title: assets["title"] || nameWithoutExt,
      publish_details: [],
      description,
    };

    // Clear any prior failed-download record for this asset now that it succeeded (e.g. on a backoff
    // retry). The failed entry is keyed by wp:post_id (no `assets_` prefix), so delete by that key —
    // the old code used customId and never actually removed recovered assets from cs_failed.
    const failedKey = assets["wp:post_id"];
    if (failedJSON[failedKey]) {
      delete failedJSON[failedKey];
      await writeFileAsync(failedJSONFilePath, failedJSON, 4);
    }
    assetData[key] = acc[key];


    await writeFileAsync(
      path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE),
      assetData,
      4
    );
    const message = getLogMessage(
      "createAssetFolderFile",
      `An asset with id ${customId} and name ${filename} downloaded successfully.`,
      {}
    )
    await customLogger(projectId, destinationStackId, 'info', message);


    return assets["wp:post_id"];
  } catch (err: any) {
    const assetName = assets["title"] || nameWithoutExt;
    failedJSON[assets["wp:post_id"]] = {
      failedUid: assets["wp:post_id"],
      name: assetName,
      url,
      reason_for_error: err?.message || "error",
    };

    try {
      await fs.promises.access(assetMasterFolderPath);
    } catch {
      await fs.promises.mkdir(assetMasterFolderPath, { recursive: true });
    }
    await fs.promises.writeFile(
      path.join(assetMasterFolderPath,MIGRATION_DATA_CONFIG.ASSETS_FAILED_FILE),
      "{}"
    );
   await writeFileAsync(failedJSONFilePath, failedJSON, 4);

    // Retry transient failures (403 rate-limit, 429, 5xx, network/timeout) with exponential backoff.
    // The previous immediate single retry didn't help rate-limiting — spacing the retry is what recovers it.
    if (retryCount + 1 < MAX_ASSET_ATTEMPTS && isRetryableAssetError(err)) {
      await sleep(assetRetryBackoffMs(retryCount));
      return await saveAsset(assets, retryCount + 1, affix, destinationStackId, projectId, baseSiteUrl);
    } else {
      const message = getLogMessage(
        srcFunc,
        `Failed to download asset with id ${assets["wp:post_id"]} after ${retryCount + 1} attempt(s)`,
        {},
        err
      )
      await customLogger(projectId, destinationStackId, 'error', message);
      return assets["wp:post_id"];
    }
  }
}

/**
 * Checks if a URL is valid for downloading (not a data URI, etc.)
 * @param url - The URL to check
 * @returns true if the URL is valid for downloading
 */
function isValidImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  // Skip data URIs
  if (url.trim().startsWith('data:')) {
    return false;
  }
  
  // Skip empty or very short URLs
  if (url.trim().length < 5) {
    return false;
  }
  
  // Skip javascript: and other non-http protocols
  const lowerUrl = url.toLowerCase().trim();
  if (lowerUrl.startsWith('javascript:') || 
      lowerUrl.startsWith('mailto:') || 
      lowerUrl.startsWith('tel:')) {
    return false;
  }
  
  return true;
}

/** True if URL path ends with a common image extension (for <a href> image links). */
function looksLikeImageFileUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  const pathOnly = url.trim().split('?')[0].split('#')[0];
  return /\.(jpe?g|png|gif|webp|svg|bmp|ico|avif|heic|heif)$/i.test(pathOnly);
}

/**
 * Extracts image and audio media URLs from HTML content (img, a[href]→image files, audio, CSS backgrounds)
 * @param htmlContent - The HTML content string
 * @param baseSiteUrl - Base site URL for resolving relative URLs
 * @returns Array of unique image and audio URLs
 */
function extractImageUrlsFromContent(htmlContent: string, baseSiteUrl: string): string[] {
  if (!htmlContent || typeof htmlContent !== 'string') {
    return [];
  }

  const imageUrls = new Set<string>();
  
  try {
    const $ = cheerio.load(htmlContent);
    
    // Extract img src attributes
    $('img').each((_, element) => {
      const src = $(element).attr('src');
      if (src && isValidImageUrl(src)) {
        const fullUrl = toCheckUrl(src, baseSiteUrl);
        if (isValidImageUrl(fullUrl)) {
          imageUrls.add(fullUrl);
        }
      }
      
      // Also check data-src (lazy loading)
      const dataSrc = $(element).attr('data-src');
      if (dataSrc && isValidImageUrl(dataSrc)) {
        const fullUrl = toCheckUrl(dataSrc, baseSiteUrl);
        if (isValidImageUrl(fullUrl)) {
          imageUrls.add(fullUrl);
        }
      }
      
      // Check srcset attribute
      const srcset = $(element).attr('srcset');
      if (srcset) {
        const srcsetUrls = srcset.split(',').map(s => s.trim().split(/\s+/)[0]);
        srcsetUrls.forEach(url => {
          if (isValidImageUrl(url)) {
            const fullUrl = toCheckUrl(url, baseSiteUrl);
            if (isValidImageUrl(fullUrl)) {
              imageUrls.add(fullUrl);
            }
          }
        });
      }
    });

    // Image URLs linked via <a href="..."> (skip non-image hrefs)
    $('a[href]').each((_, element) => {
      const href = $(element).attr('href');
      if (href && isValidImageUrl(href) && looksLikeImageFileUrl(href)) {
        const fullUrl = toCheckUrl(href, baseSiteUrl);
        if (isValidImageUrl(fullUrl) && looksLikeImageFileUrl(fullUrl)) {
          imageUrls.add(fullUrl);
        }
      }
    });

    // Extract audio src (e.g. core/audio) and nested <source> elements
    $('audio').each((_, element) => {
      const src = $(element).attr('src');
      if (src && isValidImageUrl(src)) {
        const fullUrl = toCheckUrl(src, baseSiteUrl);
        if (isValidImageUrl(fullUrl)) {
          imageUrls.add(fullUrl);
        }
      }
      $(element)
        .find('source')
        .each((_, srcEl) => {
          const s = $(srcEl).attr('src');
          if (s && isValidImageUrl(s)) {
            const fullUrl = toCheckUrl(s, baseSiteUrl);
            if (isValidImageUrl(fullUrl)) {
              imageUrls.add(fullUrl);
            }
          }
        });
    });

    // Extract background images from style attributes
    $('[style*="background-image"]').each((_, element) => {
      const style = $(element).attr('style');
      if (style) {
        const bgImageMatch = style.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/i);
        if (bgImageMatch && bgImageMatch[1] && isValidImageUrl(bgImageMatch[1])) {
          const fullUrl = toCheckUrl(bgImageMatch[1], baseSiteUrl);
          if (isValidImageUrl(fullUrl)) {
            imageUrls.add(fullUrl);
          }
        }
      }
    });
    
    // Extract URLs from CSS background-image in style tags
    $('style').each((_, element) => {
      const styleContent = $(element).html();
      if (styleContent) {
        const bgImageMatches = styleContent.match(/background-image:\s*url\(['"]?([^'")]+)['"]?\)/gi);
        if (bgImageMatches) {
          bgImageMatches.forEach(match => {
            const urlMatch = match.match(/url\(['"]?([^'")]+)['"]?\)/i);
            if (urlMatch && urlMatch[1] && isValidImageUrl(urlMatch[1])) {
              const fullUrl = toCheckUrl(urlMatch[1], baseSiteUrl);
              if (isValidImageUrl(fullUrl)) {
                imageUrls.add(fullUrl);
              }
            }
          });
        }
      }
    });
  } catch (error) {
    console.error('Error extracting image/audio URLs from content:', error);
  }

  return Array.from(imageUrls);
}

/**
 * Saves an asset from a URL
 * @param url - The asset URL to download
 * @param affix - Affix string
 * @param destinationStackId - Destination stack ID
 * @param projectId - Project ID
 * @param baseSiteUrl - Base site URL
 * @param retryCount - Retry count for failed downloads
 */
async function saveAssetFromUrl(
  url: string,
  affix: string,
  destinationStackId: string,
  projectId: string,
  baseSiteUrl: string,
  retryCount: number = 0
): Promise<string | null> {
  const srcFunc = 'saveAssetFromUrl';
  const encodedUrl = normalizeAssetUrl(url, baseSiteUrl);

  if (isAssetUrlDownloaded(url, baseSiteUrl)) {
    const existingAsset = Object.values(assetData).find(
      (asset: any) =>
        asset?.url && normalizeAssetUrl(asset.url, baseSiteUrl) === encodedUrl
    ) as { uid?: string } | undefined;
    return existingAsset?.uid ?? null;
  }

  const originalName = url.split("/").pop()?.split("?")[0] || `asset_${Date.now()}`;
  const fileExtension = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
  const nameWithoutExt = originalName.includes('.') ? originalName.substring(0, originalName.lastIndexOf('.')) : originalName;

  const customId = `${nameWithoutExt?.replace(/-/g, '_')?.toLowerCase()}`;
  const filename = `${customId}${fileExtension}`;
  const filePath = path.resolve(assetsSave, "files", customId, filename);

  if (existsSync(filePath)) {
    return customId;
  }
  
  const parent_uid = assetFolderUid(fileExtension);
  
  try {
    const response = await axios.get(encodedUrl, {
      responseType: "arraybuffer",
      timeout: 30000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      }
    });
    
    // Ensure files directory exists
    await fs.promises.mkdir(
      path.resolve(assetsSave, "files", customId),
      { recursive: true }
    );
    
    await fs.promises.writeFile(path.resolve(assetsSave, "files", customId, filename), response?.data);
    
    const stats = fs.lstatSync(path.resolve(assetsSave, "files", customId, filename));
    const acc: any = {};
    const key = customId;
    
    acc[key] = {
      uid: key,
      urlPath: `/assets/${customId}`,
      status: true,
      content_type: getMimeTypeFromExtension(fileExtension?.split('.')?.[1]),
      file_size: `${stats.size}`,
      tag: [],
      filename: filename,
      url: encodedUrl,
      is_dir: false,
      parent_uid,
      _version: 1,
      title: nameWithoutExt,
      publish_details: [],
      description: `Asset extracted from content:encoded`,
    };
    
    if (failedJSON[customId]) {
      delete failedJSON[customId];
      await writeFileAsync(failedJSONFilePath, failedJSON, 4);
    }
    
    assetData[key] = acc[key];
    
    await writeFileAsync(
      path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE),
      assetData,
      4
    );
    
    const message = getLogMessage(
      srcFunc,
      `An asset with id ${customId} and name ${originalName} downloaded successfully from content:encoded.`,
      {}
    );
    await customLogger(projectId, destinationStackId, 'info', message);
    
    return customId;
  } catch (err: any) {
    const assetName = nameWithoutExt || originalName;
    failedJSON[customId] = {
      failedUid: customId,
      name: assetName,
      url: encodedUrl,
      reason_for_error: err?.message || "error",
    };
    
    try {
      await fs.promises.access(assetMasterFolderPath);
    } catch {
      await fs.promises.mkdir(assetMasterFolderPath, { recursive: true });
    }
    await fs.promises.writeFile(
      path.join(assetMasterFolderPath, MIGRATION_DATA_CONFIG.ASSETS_FAILED_FILE),
      "{}"
    );
    await writeFileAsync(failedJSONFilePath, failedJSON, 4);
    
    // Retry transient failures (403 rate-limit, 429, 5xx, network/timeout) with exponential backoff,
    // mirroring saveAsset — a spaced retry recovers rate-limited downloads that an immediate one can't.
    if (retryCount + 1 < MAX_ASSET_ATTEMPTS && isRetryableAssetError(err)) {
      await sleep(assetRetryBackoffMs(retryCount));
      return await saveAssetFromUrl(url, affix, destinationStackId, projectId, baseSiteUrl, retryCount + 1);
    } else {
      const message = getLogMessage(
        srcFunc,
        `Failed to download asset from URL: ${encodedUrl} after ${retryCount + 1} attempt(s)`,
        {},
        err
      );
      await customLogger(projectId, destinationStackId, 'error', message);
      return null;
    }
  }
}

async function getAsset(attachments: any[], affix: string, destinationStackId: string, projectId: string, baseSiteUrl:string) {
  const BATCH_SIZE = 5; // 5 promises at a time
  const BATCH_DELAY_MS = 400; // pause between batches so we don't trip the source host's rate limiter
  const results = [];

  for (let i = 0; i < attachments?.length; i += BATCH_SIZE) {
    const batch = attachments?.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch?.map(async (data) => {
        await saveAsset(data, 0, affix, destinationStackId, projectId, baseSiteUrl)
      })
    );
    results?.push(...batchResults);

    // Throttle between batches (skip the wait after the final batch).
    if (i + BATCH_SIZE < attachments?.length) {
      await sleep(BATCH_DELAY_MS);
    }
  }
  await fs.promises.writeFile(
    path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_FILE_NAME),
    JSON.stringify({ "1": MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE }, null, 4),
    "utf-8"
  );
  
  return results;
}

async function getAllAssets(
  affix: string,
  packagePath: string,
  destinationStackId: string,
  projectId: string
) {
  try {
    await startingDirAssests(destinationStackId);
    const alldata: any = await fs.promises.readFile(packagePath, "utf8");
    const alldataParsed = JSON.parse(alldata);
    const baseSiteUrl =
    alldataParsed?.rss?.channel?.["wp:base_site_url"] ||
    alldataParsed?.channel?.["wp:base_site_url"];
    const assets: Asset[] =
      alldataParsed?.rss?.channel?.item ?? alldataParsed?.channel?.item;
    if (!assets || assets?.length === 0) {
      const message = getLogMessage(
        "createAssetFolderFile",
        `No assets found.`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
      return;
    }

    // Download attachment assets.
    // WordPress registers size/`-scaled` variants (and the same file cross-referenced across
    // per-post-type exports) as SEPARATE attachment posts. Collapse them by base key so each
    // underlying image is downloaded once; prefer the original (the URL that equals its own base
    // key, i.e. has no `-WxH`/`-scaled` suffix) over a variant when both exist.
    const attachments = assets?.filter(
      ({ "wp:post_type": postType }) => postType === "attachment"
    );
    const dedupedAttachments: any[] = [];
    if (attachments?.length > 0) {
      const byBaseKey = new Map<string, any>();
      let skippedDuplicateAttachments = 0;
      for (const att of attachments) {
        const attUrl = att?.["wp:attachment_url"];
        if (!attUrl) { dedupedAttachments.push(att); continue; }
        const key = assetBaseKey(attUrl, baseSiteUrl);
        const existing = byBaseKey.get(key);
        if (!existing) {
          byBaseKey.set(key, att);
          continue;
        }
        skippedDuplicateAttachments++;
        // Prefer the original file over a variant if the current one is the un-suffixed original.
        const isOriginal = assetBaseKey(attUrl, baseSiteUrl) ===
          normalizeAssetUrl(attUrl, baseSiteUrl).split('?')[0].split('#')[0].toLowerCase();
        if (isOriginal) byBaseKey.set(key, att);
      }
      dedupedAttachments.push(...byBaseKey.values());
      if (skippedDuplicateAttachments > 0) {
        await customLogger(
          projectId,
          destinationStackId,
          'info',
          getLogMessage('getAllAssets', `Skipped ${skippedDuplicateAttachments} duplicate attachment(s) that are size/scaled variants of, or the same file as, another attachment.`, {}),
        );
      }
      await getAsset(dedupedAttachments, affix, destinationStackId, projectId, baseSiteUrl);
    }

    // NOTE: content:encoded image download is intentionally DISABLED — only attachment posts are
    // migrated as assets. Inline body images are no longer pulled into the stack. Re-enable the
    // block below to restore downloading images referenced from content:encoded fields.
    //
    // // Extract and download assets from content:encoded fields
    // const allImageUrls = new Set<string>();
    //
    // // Seed with the base keys of already-downloaded assets (the attachments) so their WordPress size/
    // // scaled variants embedded in content:encoded are skipped instead of re-downloaded as duplicates.
    // // The same set also dedups variants of one image across content:encoded fields.
    // const seenAssetKeys = new Set<string>();
    // for (const asset of Object.values(assetData)) {
    //   const u = (asset as any)?.url;
    //   if (u) seenAssetKeys.add(assetBaseKey(u, baseSiteUrl));
    // }
    // let skippedVariantCount = 0;
    //
    // // Process all items to extract image URLs from content:encoded
    // for (const item of assets) {
    //   const contentEncoded = item["content:encoded"];
    //   if (contentEncoded && typeof contentEncoded === 'string' && item?.['wp:status'] !== 'draft') {
    //     const imageUrls = extractImageUrlsFromContent(contentEncoded, baseSiteUrl);
    //     imageUrls.forEach((url) => {
    //       const key = assetBaseKey(url, baseSiteUrl);
    //       if (seenAssetKeys.has(key)) {
    //         skippedVariantCount++;
    //         return; // duplicate of an attachment (or another content image) at a different size
    //       }
    //       seenAssetKeys.add(key);
    //       allImageUrls.add(url);
    //     });
    //   }
    // }
    // if (skippedVariantCount > 0) {
    //   await customLogger(
    //     projectId,
    //     destinationStackId,
    //     'info',
    //     getLogMessage('getAllAssets', `Skipped ${skippedVariantCount} content:encoded image(s) that duplicate an attachment or another image at a different size/resolution.`, {}),
    //   );
    // }
    //
    // // Download all unique image URLs found in content:encoded
    // if (allImageUrls.size > 0) {
    //   const imageUrlArray = Array.from(allImageUrls);
    //   const BATCH_SIZE = 5; // Process 5 URLs at a time
    //   const message = getLogMessage(
    //     "getAllAssets",
    //     `Found ${imageUrlArray.length} unique image URLs in content:encoded fields. Starting download...`,
    //     {}
    //   );
    //   await customLogger(projectId, destinationStackId, 'info', message);
    //
    //   for (let i = 0; i < imageUrlArray.length; i += BATCH_SIZE) {
    //     const batch = imageUrlArray.slice(i, i + BATCH_SIZE);
    //
    //     await Promise.allSettled(
    //       batch.map(async (url) => {
    //         await saveAssetFromUrl(url, affix, destinationStackId, projectId, baseSiteUrl);
    //       })
    //     );
    //   }
    //
    //   const completionMessage = getLogMessage(
    //     "getAllAssets",
    //     `Completed downloading assets from content:encoded fields.`,
    //     {}
    //   );
    //   await customLogger(projectId, destinationStackId, 'info', completionMessage);
    // }

    return;
  } catch (error) {
    return {
      err: "error in Workpresss",
      error: error,
    };
  }
}

/************  End of assests module functions *********/


/************  end of chunks module functions *********/

/************  authors module functions start *********/
async function startingDirAuthors(
    affix: string,
    ct: string,
    master_locale: string,
    locales: object
  ) {
    const localeKeys = getKeys(locales);
    const authorFolderName = ct || MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME;
  
    authorsFolderPath = path.join(entrySave, authorFolderName, master_locale);
    authorsFilePath = path.join(authorsFolderPath, `${master_locale}.json`);
  
    try {
      await fs.promises.access(authorsFolderPath);
    } catch {
      await fs.promises.mkdir(authorsFolderPath, { recursive: true });
      await fs.promises.writeFile(authorsFilePath, "{}");
    }
  
    // Read master data once
    let masterData = "{}";
    try {
      masterData = await fs.promises.readFile(authorsFilePath, "utf-8");
    } catch (err) {
      console.error("Error reading master author file:", err);
    }
  
    for (const loc of localeKeys) {
      if (loc === master_locale) continue;
  
      const localeFolderPath = path.join(entrySave, authorFolderName, loc);
      const localeFilePath = path.join(localeFolderPath, `${loc}.json`);
  
      try {
        await fs.promises.mkdir(localeFolderPath, { recursive: true });
        await fs.promises.writeFile(localeFilePath, masterData);
      } catch (err) {
        console.error(`Error creating/writing file for locale ${loc}:`, err);
      }
    }
}

const filePath = false;

// Helper function to get author field value based on field mapping
function getAuthorFieldValue(field: any, authorData: any, fallbackUrl?: string): any {
  const fieldUid = field?.uid;
  const otherCmsField = field?.otherCmsField;
  const fieldUidLower = fieldUid?.toLowerCase();
  const otherCmsFieldLower = otherCmsField?.toLowerCase();
  
  // Field mapping for common WordPress author fields
  const fieldMapping: Record<string, string> = {
    'email': 'wp:author_email',
    'first_name': 'wp:author_first_name',
    'first name': 'wp:author_first_name',
    'last_name': 'wp:author_last_name',
    'last name': 'wp:author_last_name',
    'display_name': 'wp:author_display_name',
    'display name': 'wp:author_display_name',
    'description': 'wp:author_description',
    'website': 'wp:author_url',
    'url': 'wp:author_url',
  };
  
  // Try direct match with field.uid (case-sensitive)
  if (fieldUid && authorData[fieldUid] !== undefined) {
    return authorData[fieldUid];
  }
  
  // Try direct match with otherCmsField (case-sensitive)
  if (otherCmsField && authorData[otherCmsField] !== undefined) {
    return authorData[otherCmsField];
  }
  
  // Check field mapping for WordPress-specific fields (case-insensitive)
  const wpFieldKey = fieldMapping[fieldUidLower] || fieldMapping[otherCmsFieldLower];
  if (wpFieldKey) {
    const value = authorData[wpFieldKey];
    // Handle special cases
    if (wpFieldKey === 'wp:author_display_name' && !value) {
      return authorData['wp:author_login'];
    }
    if ((wpFieldKey === 'wp:author_url') && !value && fallbackUrl) {
      return fallbackUrl;
    }
    return value;
  }
  
  return null;
}

async function saveAuthors(authorDetails: any[], destinationStackId: string, projectId: string, contentType: any, master_locale:string, locales:object, project: any) {
    const srcFunc = "saveAuthors";
    const localeKeys = getKeys(locales)
    try {
      // Load asset data for file/asset field processing
      const assetsSave = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId, MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME);
      const assetsSchemaPath = path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE);
      let assetData: Record<string, any> = {};
      
      try {
        if (existsSync(assetsSchemaPath)) {
          const assetDataContent = await fs.promises.readFile(assetsSchemaPath, "utf8");
          assetData = JSON.parse(assetDataContent) || {};
        }
      } catch (err) {
        console.warn('Asset data file not found or could not be read, proceeding without asset data');
      }
  
      const authordata: { [key: string]: any } = {};
  
      for (const data of authorDetails) {
        const uid = `authors_${data["wp:author_id"] ?? data["wp:author_login"]}`;
        const title = data["wp:author_login"] ?? `Authors - ${data["wp:author_id"]}`;
        const url = `/${title.toLowerCase().replace(/ /g, "_")}`;
        const customId = idCorrector(uid);
  
        // Build author data entry dynamically based on field mapping
        const authordataEntry: any = {
          uid: uid,
          title: title,
          url: url,
        };
  
        // Process each field in the content type's field mapping
        if (contentType?.fieldMapping && Array.isArray(contentType.fieldMapping)) {
          for (const field of contentType.fieldMapping) {
            const fieldValue = getAuthorFieldValue(field, data, url);
            
            // Store the field value in authordataEntry using field.uid
            if (field?.uid && fieldValue !== undefined && fieldValue !== null) {
              authordataEntry[field?.contentstackFieldUid] = formatChildByType(fieldValue, field, assetData, contentType?.fieldMapping);
            }
          }
        }
  
        authordata[customId] = authordataEntry
        authordata[customId].publish_details = [];
        const message = getLogMessage(
          srcFunc,
          `Entry title ${data["wp:author_login"]} (authors) in the ${master_locale} locale has been successfully transformed.`,
          {}
        );
  
        await customLogger(projectId, destinationStackId, 'info', message);
      }
      // await writeFileAsync(authorsFilePath, authordata, 4);
      // await writeFileAsync(
      //   path.join(authorsFolderPath, "index.json"),
      //   { "1": `${master_locale}.json` },
      //     4
      //     );
      //     // Write index.json in other locale folders (not master)
      for (const loc of localeKeys) {
          if (loc === master_locale) continue;
        
          const localeFolderPath = path.join(entrySave, MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME, loc);
          const indexPath = path.join(localeFolderPath, "index.json");
        
          try {
            await fs.promises.writeFile(
              indexPath,
              JSON.stringify({ "1": `${loc}.json` }, null, 4)
            );
          } catch (err) {
            console.error(`Error writing index.json for locale ${loc}:`, err);
          }
        }
  
  
      const message = getLogMessage(
        srcFunc,
        `${authorDetails?.length} Authors exported successfully`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
      return authordata;
    } catch (error) {
      const message = getLogMessage(
        srcFunc,
        (error as Error)?.message,
        {},
        error as Error
      )
      await customLogger(projectId, destinationStackId, 'error', message);
      return {
        err: (error as Error)?.message,
        error: error as Error,
      };
    }
  }
async function getAllAuthors(affix: string, packagePath: string,destinationStackId: string, projectId: string,contentTypes:any, keyMapper:any, master_locale:string, project:any) {
  const srcFunc = "getAllAuthors";
  const ct:any = keyMapper?.["authors"];
  const contenttype = contentTypes?.find((item:any)=> item?.otherCmsUid === 'authors')
  try {
    await startingDirAuthors(affix, ct, master_locale, project?.locales);
    const alldata: any = await fs.promises.readFile(packagePath, "utf8");
    const alldataParsed = JSON.parse(alldata);
    const authors: any =
      alldataParsed?.rss?.channel?.["wp:author"] ??
      alldataParsed?.channel?.["wp:author"] ??
      "";

    if (authors && authors.length > 0) {
      if (!filePath) {
        await saveAuthors(authors, destinationStackId, projectId,contenttype,master_locale, project?.locales,project);
      } else {
        const authorIds = fs.existsSync(filePath)? fs.readFileSync(filePath, "utf-8").split(",")
          : [];

        if (authorIds.length > 0) {
          const authorDetails = authors.filter((author: any) =>
            authorIds.includes(author["wp:author_id"])
          );

          if (authorDetails.length > 0) {
            await saveAuthors(authorDetails, destinationStackId, projectId,contenttype,master_locale, project?.locales,project);
          }
        }
      }
    } else if (typeof authors === "object") {
      if (
        !filePath ||
        (fs.existsSync(filePath) &&
          fs
            .readFileSync(filePath, "utf8")
            .split(",")
            .includes(authors["wp:author_id"]))
      ) {
        await saveAuthors([authors], destinationStackId, projectId,contenttype, master_locale, project?.locales,project);
      } else {
        const message = getLogMessage(
          srcFunc,
          `No authors UID found`,
          {}
        )
        await customLogger(projectId, destinationStackId, 'info', message);
      }
    } else {
      const message = getLogMessage(
        srcFunc,
        `No authors found`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
    }
  } catch (error) {
    const message = getLogMessage(
      srcFunc,
      `Error while getting authors`,
      {},
      error
    )
    await customLogger(projectId, destinationStackId, 'error', message);
  }
}
/************  end of authors module functions *********/



/************  Start of Global fields module functions *********/
async function copyFolder(src: string, dest: string) {
  try {
    // Create the destination folder if it doesn't exist
    await fs.promises.mkdir(dest, { recursive: true });

    // Read all items in the source folder
    const items = await fs.promises.readdir(src, { withFileTypes: true });

    for (const item of items) {
      const srcPath = path.join(src, item.name);
      const destPath = path.join(dest, item.name);

      // If the item is a directory, recursively copy its contents
      if (item.isDirectory()) {
        await copyFolder(srcPath, destPath);
      } else {
        // If the item is a file, copy it to the destination
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  } catch (err) {
    const message = getLogMessage(
      "copyFolder",
      `Error copying folder from ${src} to ${dest}.`,
      {},
      err
    )
    await customLogger("projectId", dest, 'error', message);

  }
}
async function extractGlobalFields(destinationStackId: string, projectId: string) {
  const srcFunc = "extractGlobalFields";
  const sourcePath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "upload-api",
    "migration-wordpress"
  );
  const destinationPath = path.join(MIGRATION_DATA_CONFIG.DATA, MIGRATION_DATA_CONFIG.DATA);

  const foldersToCopy = ["locales"]; //, "global_fields", "extensions"

  for (const folder of foldersToCopy) {
    const sourceFolderPath = path.join(sourcePath, folder);
    const destinationFolderPath = path.join(destinationPath, folder);

    try {
      await copyFolder(sourceFolderPath, destinationFolderPath);
      const message = getLogMessage(
        srcFunc,
        `Successfully copied ${folder}`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
    } catch (err) {
      const message = getLogMessage(
        srcFunc,
        `Error copying ${folder}.`,
        {},
        err
      )
      await customLogger(projectId, destinationStackId, 'error', message);
    }
  }
}
/************  end of Global fields module functions *********/

const createVersionFile = async (destinationStackId: string, projectId: string) => {
  try {
    await writeFileAsync(path?.join?.(DATA, destinationStackId, EXPORT_INFO_FILE),
      {
        contentVersion: 2,
        logsPath: "",
      }, 4)
      const message = getLogMessage(
        "createVersionFile",
        `Version File created`,
        {}
      );
      await customLogger(projectId, destinationStackId, "info", message);
  } catch (err) {
    const message = getLogMessage(
      "createVersionFile",
      `Error writing file: ${err}`,
      {},
      err
    )
    await customLogger(projectId, destinationStackId, 'error', message);
  }
};

export const wordpressService = {
  getAllAssets,
  createLocale,
  getAllAuthors,
  extractGlobalFields,
  createVersionFile,
  createEntry,
  createTaxonomy,
  dropInArticleContentTypes
};