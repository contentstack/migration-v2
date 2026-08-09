import fs from "fs";
import path from "path";

/**
 * Reads a project's export folder into the shape the audit checks consume
 * (cs-audit-report trd.md TR-1, TR-2, TR-3).
 *
 * Tolerant of two producers by design (FR-1.2, FR-1.3): this repository's exporter
 * writes modules at the export root with `<locale>.json` entry files, and the
 * Contentstack CLI nests them under a branch folder with `<uuid>-entries.json`. A
 * caller cannot tell which wrote the export it is given.
 *
 * Every module is read inside its own boundary, so one unreadable file degrades one
 * check rather than the whole audit (FR-1.5). `readable: false` is reserved for the
 * export DIRECTORY being unusable — the case that drives the panel's error state.
 */
export interface AuditExportRecord {
  ctUid: string;
  locale: string;
  uid: string;
  entry: any;
}

export interface AuditModulePresence {
  contentTypes: boolean;
  globalFields: boolean;
  assets: boolean;
  entries: boolean;
}

export interface AuditExportData {
  /** False only when the export directory itself cannot be read at all (EC-1). */
  readable: boolean;
  /** Set when `readable` is false — a fixed classification, never a raw path. */
  failureReason?: "export_missing" | "export_unreadable";
  modules: AuditModulePresence;
  contentTypes: any[];
  globalFields: any[];
  assets: Record<string, any>;
  /** Fallback records already dropped (TR-2). */
  records: AuditExportRecord[];
  entryRecordCount: number;
  variantRecords: AuditExportRecord[];
  variantsPresent: boolean;
  /** Module key → failure reason, for checks that must resolve `unavailable`. */
  errors: Record<string, string>;
  /** The export's own timestamp, used as the findings cache key (FR-7.8). */
  exportedAt?: string;
}

/** Directory names that mark a folder as an export root (or a branch within one). */
const MODULE_DIRS = [
  "content_types",
  "global_fields",
  "assets",
  "entries",
  "locales",
];

const readJson = (file: string): unknown =>
  JSON.parse(fs.readFileSync(file, "utf8"));

const isDir = (p: string): boolean => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const listDir = (p: string): string[] => {
  try {
    return fs.readdirSync(p);
  } catch {
    return [];
  }
};

const holdsAnyModule = (dir: string): boolean =>
  MODULE_DIRS.some((m) => isDir(path.join(dir, m)));

/**
 * Resolves the directory the modules actually live in. Prefers the given root; falls
 * back to a single sub-folder that holds recognised modules, which is the CLI's
 * branch layout. A sub-folder holding none of them is NOT a branch root — treating it
 * as one would turn an empty export into a branch export whose modules failed to
 * load, and those are different claims (FR-1.2, FR-2.10).
 */
const resolveModuleRoot = (dir: string): string => {
  if (holdsAnyModule(dir)) return dir;
  for (const name of listDir(dir)) {
    const candidate = path.join(dir, name);
    if (isDir(candidate) && holdsAnyModule(candidate)) return candidate;
  }
  return dir;
};

/** Every `.json` file directly inside `dir`, excluding chunk-pointer files. */
const dataFilesIn = (dir: string): string[] =>
  listDir(dir)
    .filter((f) => f.endsWith(".json") && f !== "index.json")
    .map((f) => path.join(dir, f));

/**
 * Entry data files hold a uid→entry map. A duplicated uid within one locale can only
 * survive once (TC_AR_007's negative), which the map gives us for free.
 */
const recordsFromFile = (
  file: string,
  ctUid: string,
  locale: string
): AuditExportRecord[] => {
  const parsed = readJson(file);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  return Object.entries(parsed as Record<string, any>)
    .filter(([, entry]) => entry && typeof entry === "object")
    .map(([uid, entry]) => ({ ctUid, locale, uid: entry.uid ?? uid, entry }));
};

interface EntryScan {
  records: AuditExportRecord[];
  variantRecords: AuditExportRecord[];
  variantsPresent: boolean;
  /**
   * How many entry DATA FILES were found. Module presence is judged on this rather
   * than on record counts, uniformly with every other module: presence means "this
   * module was exported", and an `entries/` folder containing no data file was not.
   * Judging it on records would make an export whose every record is a fallback look
   * like an export with no entries module at all.
   */
  fileCount: number;
}

const readEntries = (root: string): EntryScan => {
  const out: EntryScan = {
    records: [],
    variantRecords: [],
    variantsPresent: false,
    fileCount: 0,
  };
  const entriesDir = path.join(root, "entries");
  if (!isDir(entriesDir)) return out;

  for (const ctUid of listDir(entriesDir)) {
    const ctDir = path.join(entriesDir, ctUid);
    if (!isDir(ctDir)) continue;

    for (const locale of listDir(ctDir)) {
      const localeDir = path.join(ctDir, locale);
      if (!isDir(localeDir)) continue;

      for (const file of dataFilesIn(localeDir)) {
        out.fileCount += 1;
        const found = recordsFromFile(file, ctUid, locale);
        for (const rec of found) {
          /*
            TR-2 — the fallback filter. Contentstack answers a request for an
            unlocalized locale with the master-locale entry, marked by `entry_locale`
            in its publish rows. Such a record is content SERVED in this locale by
            fallback, not content that exists in it; migrating it as localized would
            turn an untranslated page into a translated one and destroy the fallback
            relationship. The record's own `locale` is what gives it away.
          */
          if (rec.entry?.locale && rec.entry.locale !== locale) continue;
          out.records.push(rec);
        }
      }

      const variantsDir = path.join(localeDir, "variants");
      if (!isDir(variantsDir)) continue;
      out.variantsPresent = true;
      for (const entryUid of listDir(variantsDir)) {
        const vDir = path.join(variantsDir, entryUid);
        if (!isDir(vDir)) continue;
        for (const file of dataFilesIn(vDir)) {
          out.variantRecords.push(...recordsFromFile(file, ctUid, locale));
        }
      }
    }
  }
  return out;
};

const NO_MODULES: AuditModulePresence = {
  contentTypes: false,
  globalFields: false,
  assets: false,
  entries: false,
};

export const readAuditExport = (exportDir: string): AuditExportData => {
  if (!isDir(exportDir)) {
    return {
      readable: false,
      failureReason: "export_missing",
      modules: { ...NO_MODULES },
      contentTypes: [],
      globalFields: [],
      assets: {},
      records: [],
      entryRecordCount: 0,
      variantRecords: [],
      variantsPresent: false,
      errors: {},
    };
  }

  const root = resolveModuleRoot(exportDir);
  const errors: Record<string, string> = {};

  /** Reads one module, recording a failure against it rather than throwing. */
  const module = <T>(key: string, fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch (e: any) {
      errors[key] = e?.message ?? "unreadable";
      return fallback;
    }
  };

  const contentTypes = module<any[]>(
    "contentTypes",
    () => {
      const dir = path.join(root, "content_types");
      if (!isDir(dir)) return [];
      const schema = path.join(dir, "schema.json");
      if (fs.existsSync(schema)) {
        const parsed = readJson(schema);
        return Array.isArray(parsed) ? parsed : [];
      }
      // The CLI writes one file per content type with no combined schema.json.
      return dataFilesIn(dir)
        .map((f) => readJson(f))
        .filter((c: any) => c && typeof c === "object" && c.uid);
    },
    []
  );

  const globalFields = module<any[]>(
    "globalFields",
    () => {
      const file = path.join(root, "global_fields", "globalfields.json");
      if (!fs.existsSync(file)) return [];
      const parsed = readJson(file);
      return Array.isArray(parsed) ? parsed : Object.values(parsed as object);
    },
    []
  );

  const assets = module<Record<string, any>>(
    "assets",
    () => {
      const dir = path.join(root, "assets");
      if (!isDir(dir)) return {};
      const index = path.join(dir, "index.json");
      if (fs.existsSync(index)) {
        const parsed = readJson(index);
        return parsed && typeof parsed === "object" ? (parsed as Record<string, any>) : {};
      }
      // The CLI shards assets into `<uuid>-assets.json` beside a chunk pointer.
      const merged: Record<string, any> = {};
      for (const f of dataFilesIn(dir)) {
        const parsed = readJson(f);
        if (!parsed || typeof parsed !== "object") continue;
        for (const [uid, asset] of Object.entries(parsed as Record<string, any>)) {
          if (asset && typeof asset === "object") merged[uid] = asset;
        }
      }
      return merged;
    },
    {}
  );

  const entries = module<EntryScan>(
    "entries",
    () => readEntries(root),
    { records: [], variantRecords: [], variantsPresent: false, fileCount: 0 }
  );

  /** A module is present when a data file for it exists on disk (FR-1.6). */
  const fileExists = (...parts: string[]) => fs.existsSync(path.join(root, ...parts));
  const anyDataFile = (dirName: string) => {
    const dir = path.join(root, dirName);
    return isDir(dir) && dataFilesIn(dir).length > 0;
  };

  const exportedAt = (() => {
    try {
      const file = path.join(root, "export-info.json");
      if (!fs.existsSync(file)) return undefined;
      const parsed = readJson(file) as any;
      return typeof parsed?.exportedAt === "string" ? parsed.exportedAt : undefined;
    } catch {
      return undefined;
    }
  })();

  return {
    readable: true,
    modules: {
      contentTypes: fileExists("content_types", "schema.json") || anyDataFile("content_types"),
      globalFields: fileExists("global_fields", "globalfields.json"),
      assets: fileExists("assets", "index.json") || anyDataFile("assets"),
      // Same rule, one level deeper: a data file somewhere under entries/<ct>/<locale>/.
      // An `entries/` folder with no data file in it was not exported (FR-1.6), and
      // reporting it present would make the unpublished check say 0 of 0 — a clean
      // result for a module nobody looked at (FR-2.11).
      entries: entries.fileCount > 0,
    },
    contentTypes,
    globalFields,
    assets,
    records: entries.records,
    entryRecordCount: entries.records.length,
    variantRecords: entries.variantRecords,
    variantsPresent: entries.variantsPresent,
    errors,
    exportedAt,
  };
};
