import type { AuditExportData, AuditExportRecord } from "./auditReader.service.js";

/**
 * The four audit checks and the state resolver
 * (cs-audit-report trd.md TR-4, TR-5, TR-6).
 *
 * Pure over the reader's output — no filesystem, no network. Every check resolves to
 * exactly one of three states, and `count` is present ONLY for `done`, so a renderer
 * cannot display a number for a check that did not run (FR-2.10, FR-2.11). That is
 * G-3, the feature's north-star: the page must never report a clean result for a
 * check it could not perform.
 */
export type AuditCheckState = "done" | "notPresent" | "unavailable";

export type AuditCategory =
  | "unusedAssets"
  | "unpublishedEntries"
  | "emptyContentTypes"
  | "unusedGlobalFields";

export interface AuditFlaggedItem {
  /** `entry:<ct>:<uid>:<locale>` or `asset:<uid>` — see feature.md FR-7.3. */
  key: string;
  category: AuditCategory;
  type: string;
  title: string;
  uid: string;
  contentType?: string;
  locale?: string;
  status: string;
}

export interface AuditCheck {
  id: AuditCategory;
  label: string;
  state: AuditCheckState;
  /**
   * Present ONLY when `state` is `done`. Absent — not zero — for the other two,
   * so a renderer cannot display a count for a check that did not run (FR-2.11).
   */
  count?: number;
  items: AuditFlaggedItem[];
}

export interface AuditTotals {
  contentTypes: number;
  globalFields: number;
  assets: number;
  entryRecords: number;
  denominator: number;
}

export interface AuditChecksResult {
  checks: AuditCheck[];
  totals: AuditTotals;
  /** False when the export carried no variant data, so the card can disclose it. */
  variantsInspected: boolean;
}

/** Order is the order the analyzing state lists them in (FR-2.1). */
const LABELS: Record<AuditCategory, string> = {
  unusedAssets: "Unused assets — referenced by any entry?",
  unpublishedEntries: "Unpublished entries — has publish details?",
  emptyContentTypes: "Empty content types — any entries at all?",
  unusedGlobalFields: "Unused global fields — referenced by a schema?",
};

const CHECK_ORDER: AuditCategory[] = [
  "unusedAssets",
  "unpublishedEntries",
  "emptyContentTypes",
  "unusedGlobalFields",
];

/**
 * Builds a check. `count` is attached only for `done` — and by omitting the property
 * entirely rather than setting it undefined, so `hasOwnProperty` is false and the
 * wire format cannot carry a zero for an unrun check.
 */
const check = (
  id: AuditCategory,
  state: AuditCheckState,
  items: AuditFlaggedItem[] = []
): AuditCheck => {
  const base: AuditCheck = { id, label: LABELS[id], state, items: state === "done" ? items : [] };
  if (state === "done") base.count = items.length;
  return base;
};

const entryKey = (r: AuditExportRecord): string =>
  `entry:${r.ctUid}:${r.uid}:${r.locale}`;

// ───────────────────────── asset references ─────────────────────────

/**
 * The uid segment of a Contentstack asset URL — `…/assets/<stackApiKey>/<uid>/<file>`.
 *
 * Matched by URL SHAPE rather than by searching text for the uid itself. FR-2.5 asks
 * for asset URLs in text fields, and `text.includes(uid)` is the cheap way to get
 * that — which then reports `a1` as referenced by the string `a1b2c3d4`. Because
 * FR-2.6 biases toward "used", that error is silent: the asset simply never appears as
 * unused and nobody notices the check under-reporting (TC_AR_030).
 */
const ASSET_URL_UID = /\/assets\/[^/\s"']+\/([A-Za-z0-9_-]{2,})\//g;

/**
 * Collects every asset uid a record references, from all six locations FR-2.5 names.
 *
 * Deliberately ONE pass over the record, accumulating into a shared set: the cost is
 * records + assets, never records × assets. A product-shaped scan passes at 400
 * records and dies at 50,000 (TRR-2, TC_AR_184).
 *
 * A bare uid appearing as a substring of unrelated text is NOT a reference
 * (TC_AR_030). Matching is therefore structural — an object carrying that uid, or a
 * uid in an asset-URL path segment — never `text.includes(uid)`. Because FR-2.6
 * biases toward "used", a loose match would silently under-report unused assets
 * forever and nobody would notice.
 */
const collectAssetRefs = (value: unknown, into: Set<string>, depth = 0): void => {
  if (value == null || depth > 24) return;

  if (typeof value === "string") {
    for (const m of value.matchAll(ASSET_URL_UID)) into.add(m[1]);
    return;
  }

  if (Array.isArray(value)) {
    for (const v of value) collectAssetRefs(v, into, depth + 1);
    return;
  }

  if (typeof value !== "object") return;
  const obj = value as Record<string, unknown>;

  /*
    Any object carrying a string `uid` is a candidate reference — a file field, whether
    the export stored the full asset object or only its uid.

    Deliberately broad, and safe in the one direction that matters: the candidate is
    only ever treated as a reference if it also appears in the asset index, so a
    non-asset uid cannot invent an asset. The residual risk is marking a real asset
    used because an unrelated record happens to carry the same uid — which is FR-2.6's
    required bias. The opposite error, calling a referenced asset unused, is the one
    that destroys content.
  */
  if (typeof obj.uid === "string") into.add(obj.uid);
  // A JSON rich-text embed.
  if (typeof obj["asset-uid"] === "string") into.add(obj["asset-uid"] as string);
  if (
    obj.type === "reference" &&
    obj.attrs &&
    typeof (obj.attrs as any)["asset-uid"] === "string"
  ) {
    into.add((obj.attrs as any)["asset-uid"]);
  }

  for (const [k, v] of Object.entries(obj)) {
    // publish_details carries environment and user uids, never asset ones.
    if (k === "publish_details" || k === "ACL") continue;
    collectAssetRefs(v, into, depth + 1);
  }
};

/**
 * Record-level keys that carry uids of things that are not assets: the entry's own
 * uid, its publish rows (environment and user uids), its ACL and its authorship.
 *
 * Skipping the record's OWN uid is load-bearing. Without it, an entry and an asset
 * that share a uid string — TC_AR_016's case — would have the entry mark the asset as
 * referenced by merely existing, and the asset would never be flagged.
 */
const RECORD_METADATA_KEYS = new Set([
  "uid",
  "publish_details",
  "ACL",
  "created_by",
  "updated_by",
  "_version",
  "_in_progress",
]);

/** Walks a record's FIELDS, skipping the metadata that carries non-asset uids. */
const collectRecordAssetRefs = (entry: unknown, into: Set<string>): void => {
  if (!entry || typeof entry !== "object") return;
  for (const [k, v] of Object.entries(entry as Record<string, unknown>)) {
    if (RECORD_METADATA_KEYS.has(k)) continue;
    collectAssetRefs(v, into, 1);
  }
};

// ───────────────────────── global field references ─────────────────────────

const collectGlobalFieldRefs = (schema: any[], into: Set<string>): void => {
  for (const f of schema ?? []) {
    if (f?.data_type === "global_field") {
      const to = Array.isArray(f.reference_to) ? f.reference_to : [f.reference_to];
      for (const t of to) if (typeof t === "string") into.add(t);
    }
    if (Array.isArray(f?.schema)) collectGlobalFieldRefs(f.schema, into);
    for (const b of f?.blocks ?? []) collectGlobalFieldRefs(b?.schema ?? [], into);
  }
};

// ───────────────────────── the checks ─────────────────────────

/**
 * Unpublished entries. A record is flagged when its `publish_details` carries no row
 * for **the locale of the folder it was read from** — never for the record's own
 * `locale` field (FR-2.2). For a genuinely localized record the two are identical; the
 * distinction exists so that a regression in the reader's fallback filter cannot
 * silently change this check's answer.
 */
const unpublishedCheck = (data: AuditExportData): AuditCheck => {
  if (data.errors.entries) return check("unpublishedEntries", "unavailable");
  if (!data.modules.entries) return check("unpublishedEntries", "notPresent");

  // No record carries the key at all — an export predating the publish-details fix.
  // The check cannot run, so it must say so rather than report zero (EC-5, FR-2.11).
  const anyHasKey = data.records.some(
    (r) => r.entry && Object.prototype.hasOwnProperty.call(r.entry, "publish_details")
  );
  if (data.records.length > 0 && !anyHasKey) {
    return check("unpublishedEntries", "unavailable");
  }

  const items = data.records
    .filter((r) => {
      const rows = r.entry?.publish_details;
      if (!Array.isArray(rows) || rows.length === 0) return true;
      return !rows.some((row: any) => row?.locale === r.locale);
    })
    .map<AuditFlaggedItem>((r) => ({
      key: entryKey(r),
      category: "unpublishedEntries",
      type: "Entry",
      title: r.entry?.title ?? r.uid,
      uid: r.uid,
      contentType: r.ctUid,
      locale: r.locale,
      status: "Never published",
    }));

  return check("unpublishedEntries", "done", items);
};

/**
 * Unused assets. Flagged only when nothing in the export references them (FR-2.5), and
 * folder assets are excluded entirely because a folder is not migratable content
 * (FR-2.9). Variant records are scanned too when present — 7 of the 10 referenced
 * assets on the reference stack are variant-only (FR-2.12).
 */
const unusedAssetsCheck = (data: AuditExportData): AuditCheck => {
  if (data.errors.assets) return check("unusedAssets", "unavailable");
  if (!data.modules.assets) return check("unusedAssets", "notPresent");

  const referenced = new Set<string>();
  for (const r of data.records) collectRecordAssetRefs(r.entry, referenced);
  for (const r of data.variantRecords) collectRecordAssetRefs(r.entry, referenced);

  const items = Object.entries(data.assets)
    .filter(([, asset]) => !asset?.is_dir)
    .filter(([uid]) => !referenced.has(uid))
    .map<AuditFlaggedItem>(([uid, asset]) => ({
      key: `asset:${uid}`,
      category: "unusedAssets",
      type: "Asset",
      title: asset?.filename ?? asset?.title ?? uid,
      uid,
      status: "Unused",
    }));

  return check("unusedAssets", "done", items);
};

/**
 * Empty content types. Assessed across ALL locales — a single record anywhere clears
 * the content type (FR-2.7). Fallback records were dropped by the reader before this
 * runs, so a content type whose only records were fallbacks is correctly flagged
 * empty (TC_AR_040).
 */
const emptyContentTypesCheck = (data: AuditExportData): AuditCheck => {
  if (data.errors.contentTypes) return check("emptyContentTypes", "unavailable");
  if (!data.modules.contentTypes) return check("emptyContentTypes", "notPresent");

  const withRecords = new Set(data.records.map((r) => r.ctUid));
  const items = data.contentTypes
    .filter((ct) => ct?.uid && !withRecords.has(ct.uid))
    .map<AuditFlaggedItem>((ct) => ({
      key: `contentType:${ct.uid}`,
      category: "emptyContentTypes",
      type: "Content type",
      title: ct.title ?? ct.uid,
      uid: ct.uid,
      status: "0 entries",
    }));

  return check("emptyContentTypes", "done", items);
};

/** Unused global fields — no content type schema references them (FR-2.8). */
const unusedGlobalFieldsCheck = (data: AuditExportData): AuditCheck => {
  if (data.errors.globalFields) return check("unusedGlobalFields", "unavailable");
  if (!data.modules.globalFields) return check("unusedGlobalFields", "notPresent");

  const referenced = new Set<string>();
  for (const ct of data.contentTypes) collectGlobalFieldRefs(ct?.schema ?? [], referenced);

  const items = data.globalFields
    .filter((gf) => gf?.uid && !referenced.has(gf.uid))
    .map<AuditFlaggedItem>((gf) => ({
      key: `globalField:${gf.uid}`,
      category: "unusedGlobalFields",
      type: "Global field",
      title: gf.title ?? gf.uid,
      uid: gf.uid,
      status: "Unreferenced",
    }));

  return check("unusedGlobalFields", "done", items);
};

const RUNNERS: Record<AuditCategory, (d: AuditExportData) => AuditCheck> = {
  unusedAssets: unusedAssetsCheck,
  unpublishedEntries: unpublishedCheck,
  emptyContentTypes: emptyContentTypesCheck,
  unusedGlobalFields: unusedGlobalFieldsCheck,
};

export const runAuditChecks = (data: AuditExportData): AuditChecksResult => {
  // All four, always, in the specified order — a check that vanished when its module
  // was absent would silently shrink the "n of 4 checks" counter (TC_AR_043).
  const checks = CHECK_ORDER.map((id) => RUNNERS[id](data));

  const assets = Object.values(data.assets).filter((a: any) => !a?.is_dir).length;
  const contentTypes = data.contentTypes.length;
  const globalFields = data.globalFields.length;
  const entryRecords = data.modules.entries ? data.records.length : 0;

  return {
    checks,
    totals: {
      contentTypes,
      globalFields,
      assets,
      entryRecords,
      denominator: contentTypes + globalFields + assets + entryRecords,
    },
    // Follows the reader's flag, never the presence of variant records — so a reader
    // change cannot silently flip the card's disclosure (TC_AR_036).
    variantsInspected: data.variantsPresent,
  };
};
