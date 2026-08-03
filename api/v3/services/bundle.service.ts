import AdmZip from "adm-zip";

import { HTTP_CODES } from "../constants/http.js";

/**
 * v3 Contentstack export-bundle parser — standalone. Validates an uploaded
 * `.zip` and derives a per-module manifest against the real CS export layout.
 */
export class BundleError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "BundleError";
  }
}

/** Zip-bomb guard: reject if total uncompressed size exceeds this. */
const MAX_UNCOMPRESSED = 1024 * 1024 * 1024; // 1 GB

export interface ManifestRow {
  name: string;
  count: number;
}
export interface ParsedBundle {
  contentVersion?: number;
  modules: Record<string, number>;
  manifest: ManifestRow[];
}

/** Module catalog + dependency edges (drives the "required by" forcing, FR-3.6). */
export const MODULE_DEFS: { key: string; label: string; dependsOn: string[] }[] = [
  { key: "contentTypes", label: "Content Types", dependsOn: [] },
  { key: "globalFields", label: "Global Fields", dependsOn: [] },
  { key: "entries", label: "Entries", dependsOn: ["contentTypes", "assets"] },
  { key: "assets", label: "Assets", dependsOn: [] },
  { key: "locales", label: "Locales", dependsOn: [] },
  { key: "extensions", label: "Extensions", dependsOn: [] },
  { key: "taxonomies", label: "Taxonomies", dependsOn: [] },
  { key: "environments", label: "Environments", dependsOn: [] },
  { key: "webhooks", label: "Webhooks", dependsOn: [] },
];

const lenOf = (v: any): number =>
  Array.isArray(v)
    ? v.length
    : v && typeof v === "object"
    ? Object.keys(v).length
    : 0;

/** If the whole export is nested under a single top folder, return that prefix. */
export const detectPrefix = (names: string[]): string => {
  const atRoot =
    names.includes("export-info.json") ||
    names.some((n) => n.startsWith("content_types/"));
  if (atRoot) return "";
  const tops = new Set(names.map((n) => n.split("/")[0]).filter(Boolean));
  return tops.size === 1 ? `${[...tops][0]}/` : "";
};

export const parseBundle = (buffer: Buffer): ParsedBundle => {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw new BundleError(HTTP_CODES.BAD_REQUEST, "Not a valid .zip archive.");
  }

  const entries = zip.getEntries();
  if (!entries.length) {
    throw new BundleError(HTTP_CODES.BAD_REQUEST, "The archive is empty.");
  }

  const totalUncompressed = entries.reduce(
    (sum, e) => sum + (e.header?.size ?? 0),
    0
  );
  if (totalUncompressed > MAX_UNCOMPRESSED) {
    throw new BundleError(
      HTTP_CODES.BAD_REQUEST,
      "Archive uncompressed size exceeds the allowed limit."
    );
  }

  const names = entries.map((e) => e.entryName.replace(/\\/g, "/"));
  const prefix = detectPrefix(names);

  const readJson = (rel: string): any => {
    const entry = zip.getEntry(prefix + rel);
    if (!entry) return undefined;
    try {
      return JSON.parse(zip.readAsText(entry));
    } catch {
      return undefined;
    }
  };
  const hasDir = (rel: string) => names.some((n) => n.startsWith(prefix + rel));

  const info = readJson("export-info.json");
  if (!info && !hasDir("content_types/")) {
    throw new BundleError(
      HTTP_CODES.BAD_REQUEST,
      "Not a Contentstack export bundle (missing export-info.json / content_types)."
    );
  }

  let contentTypes = lenOf(readJson("content_types/schema.json"));
  if (!contentTypes) {
    contentTypes = names.filter(
      (n) =>
        n.startsWith(prefix + "content_types/") &&
        n.endsWith(".json") &&
        !n.endsWith("/schema.json")
    ).length;
  }

  let entriesCount = 0;
  for (const e of entries) {
    const n = e.entryName.replace(/\\/g, "/");
    if (
      n.startsWith(prefix + "entries/") &&
      n.endsWith(".json") &&
      !n.endsWith("/index.json")
    ) {
      try {
        entriesCount += lenOf(JSON.parse(zip.readAsText(e)));
      } catch {
        /* skip unreadable entry file */
      }
    }
  }

  const modules: Record<string, number> = {
    contentTypes,
    globalFields: lenOf(readJson("global_fields/globalfields.json")),
    entries: entriesCount,
    // assets/assets.json is a locale/chunk POINTER file (always {"1":"index.json"}
    // in real CS exports) — the real per-asset map is assets/index.json.
    assets: lenOf(readJson("assets/index.json")),
    locales: lenOf(readJson("locales/locales.json")),
    extensions: lenOf(readJson("extensions/extensions.json")),
    taxonomies: lenOf(readJson("taxonomies/taxonomies.json")),
    environments: lenOf(readJson("environments/environments.json")),
    webhooks: lenOf(readJson("webhooks/webhooks.json")),
  };

  const manifest: ManifestRow[] = MODULE_DEFS.map((m) => ({
    name: m.label,
    count: modules[m.key] ?? 0,
  }));

  return { contentVersion: info?.contentVersion, modules, manifest };
};

const MODULE_FOLDER_PREFIX: Record<string, string> = {
  contentTypes: "content_types/",
  globalFields: "global_fields/",
  assets: "assets/",
  entries: "entries/",
};

/**
 * Repackages an uploaded bundle down to only the real files for the selected
 * modules — the genuine file-mode export, not just a gated preview count.
 * `selected` omitted means "whole bundle" (everything kept, unchanged).
 * Strips a single enclosing top-level folder, if present, so the output is
 * flat — matching bundleWriter.service's own convention.
 */
export const filterBundleBySelection = (buffer: Buffer, selected?: string[]): Buffer => {
  const src = new AdmZip(buffer);
  const entries = src.getEntries();
  const names = entries.map((e) => e.entryName.replace(/\\/g, "/"));
  const prefix = detectPrefix(names);
  const wants = (key: string) => !selected || selected.includes(key);

  const out = new AdmZip();
  for (const e of entries) {
    if (e.isDirectory) continue;
    const rel = e.entryName.replace(/\\/g, "/").slice(prefix.length);
    if (!rel) continue;
    const gatedModule = Object.entries(MODULE_FOLDER_PREFIX).find(([, folder]) => rel.startsWith(folder));
    if (gatedModule && !wants(gatedModule[0])) continue;
    out.addFile(rel, e.getData());
  }
  return out.toBuffer();
};

/**
 * Extracts the content-type schema array from a bundle (for the file-mode graph
 * build). Prefers `content_types/schema.json`; falls back to per-CT files.
 */
export const parseBundleContentTypes = (buffer: Buffer): any[] => {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return [];
  }
  const names = zip.getEntries().map((e) => e.entryName.replace(/\\/g, "/"));
  const prefix = detectPrefix(names);

  const schemaEntry = zip.getEntry(prefix + "content_types/schema.json");
  if (schemaEntry) {
    try {
      const arr = JSON.parse(zip.readAsText(schemaEntry));
      if (Array.isArray(arr)) return arr;
    } catch {
      /* fall through */
    }
  }

  const cts: any[] = [];
  for (const e of zip.getEntries()) {
    const n = e.entryName.replace(/\\/g, "/");
    if (
      n.startsWith(prefix + "content_types/") &&
      n.endsWith(".json") &&
      !n.endsWith("/schema.json")
    ) {
      try {
        cts.push(JSON.parse(zip.readAsText(e)));
      } catch {
        /* skip */
      }
    }
  }
  return cts;
};

export interface NamedItem {
  uid: string;
  title: string;
}
export interface EntryTypeSample {
  ctUid: string;
  ctTitle: string;
  sample: NamedItem[];
  count: number;
}
export interface BundleDetails {
  contentTypes: NamedItem[];
  globalFields: NamedItem[];
  assetSample: NamedItem[];
  assetCount: number;
  entriesByContentType: EntryTypeSample[];
}

/** How many named items to sample per module for the live export log. */
export const LOG_SAMPLE_SIZE = 6;

/**
 * Named-item samples + accurate counts for a bundle, used to render real
 * per-item lines in the live export log ("Exporting asset: hero.png",
 * "Exporting entry: Welcome Post (Blog Post)") instead of only stage
 * summaries. Counts are always exact; `sample`/`assetSample` are capped at
 * LOG_SAMPLE_SIZE for readability — the caller logs "…and N more" for the rest.
 */
export const parseBundleDetails = (buffer: Buffer): BundleDetails => {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return { contentTypes: [], globalFields: [], assetSample: [], assetCount: 0, entriesByContentType: [] };
  }

  const allEntries = zip.getEntries();
  const names = allEntries.map((e) => e.entryName.replace(/\\/g, "/"));
  const prefix = detectPrefix(names);

  const readJson = (rel: string): any => {
    const entry = zip.getEntry(prefix + rel);
    if (!entry) return undefined;
    try {
      return JSON.parse(zip.readAsText(entry));
    } catch {
      return undefined;
    }
  };

  const contentTypes: NamedItem[] = parseBundleContentTypes(buffer).map((ct: any) => ({
    uid: ct?.uid,
    title: ct?.title ?? ct?.uid,
  }));

  const globalFieldsRaw = readJson("global_fields/globalfields.json");
  const globalFields: NamedItem[] = (Array.isArray(globalFieldsRaw) ? globalFieldsRaw : []).map(
    (gf: any) => ({ uid: gf?.uid, title: gf?.title ?? gf?.uid })
  );

  // assets/assets.json is a chunk pointer; assets/index.json is the real map.
  const assetsRaw = readJson("assets/index.json");
  const assetEntries: any[] =
    assetsRaw && typeof assetsRaw === "object" ? Object.values(assetsRaw) : [];
  const assetCount = assetEntries.length;
  const assetSample: NamedItem[] = assetEntries.slice(0, LOG_SAMPLE_SIZE).map((a: any) => ({
    uid: a?.uid,
    title: a?.filename ?? a?.title ?? a?.uid,
  }));

  const entriesByContentType: EntryTypeSample[] = contentTypes.map((ct) => {
    let sample: NamedItem[] = [];
    let count = 0;
    for (const e of allEntries) {
      const n = e.entryName.replace(/\\/g, "/");
      if (
        n.startsWith(`${prefix}entries/${ct.uid}/`) &&
        n.endsWith(".json") &&
        !n.endsWith("/index.json")
      ) {
        try {
          const data = JSON.parse(zip.readAsText(e));
          const items: any[] = data && typeof data === "object" ? Object.values(data) : [];
          count += items.length;
          if (sample.length < LOG_SAMPLE_SIZE) {
            sample = sample.concat(
              items.slice(0, LOG_SAMPLE_SIZE - sample.length).map((it: any) => ({
                uid: it?.uid,
                title: it?.title ?? it?.uid,
              }))
            );
          }
        } catch {
          /* skip unreadable entry file */
        }
      }
    }
    return { ctUid: ct.uid, ctTitle: ct.title, sample, count };
  });

  return { contentTypes, globalFields, assetSample, assetCount, entriesByContentType };
};
