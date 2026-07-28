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
const detectPrefix = (names: string[]): string => {
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
    assets: lenOf(readJson("assets/assets.json")),
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
