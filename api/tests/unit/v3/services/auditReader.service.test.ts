import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * TDD — cs-audit-report, Phase 1 tranche 1: the export reader.
 *
 * Backs TC_AR_001–TC_AR_015 (feature.md FR-1.1 … FR-1.7, trd.md TR-1 … TR-3).
 *
 * Real filesystem I/O against a throwaway temp directory — the filesystem IS
 * this unit's subject, so mocking it would test nothing. No network boundary
 * exists to mock: the audit makes no Contentstack calls (feature.md DEP-5).
 *
 * The reader is deliberately tolerant of two export layouts, because two
 * producers exist: this repository's exporter writes modules at the root with
 * `<locale>.json` entry files, and the Contentstack CLI writes them inside a
 * branch folder with `<uuid>-entries.json` files (FR-1.2, FR-1.3).
 */
import {
  readAuditExport,
  AuditExportData,
} from "../../../../v3/services/auditReader.service.js";

const TMP = path.join(os.tmpdir(), `v3-audit-reader-${process.pid}`);

const writeJson = (p: string, data: unknown): void => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
};

/** A minimal entry record. `locale` defaults to the folder it is written into. */
const rec = (uid: string, locale: string, over: Record<string, unknown> = {}) => ({
  uid,
  title: `Entry ${uid}`,
  locale,
  publish_details: [],
  ...over,
});

/**
 * Builds an export tree. `layout: 'branch'` nests every module under `main/`
 * and names entry files `<uuid>-entries.json`, reproducing the CLI's shape.
 */
const buildExport = (
  dir: string,
  opts: {
    layout?: "root" | "branch";
    contentTypes?: any[];
    globalFields?: any[];
    assets?: Record<string, any>;
    entries?: Record<string, Record<string, any[]>>; // ct -> locale -> records
    variants?: Record<string, Record<string, any[]>>;
    exportedAt?: string;
    omitModules?: string[];
  } = {}
): string => {
  const root = opts.layout === "branch" ? path.join(dir, "main") : dir;
  const omit = new Set(opts.omitModules ?? []);

  if (!omit.has("contentTypes")) {
    writeJson(path.join(root, "content_types", "schema.json"), opts.contentTypes ?? []);
  }
  if (!omit.has("globalFields")) {
    writeJson(path.join(root, "global_fields", "globalfields.json"), opts.globalFields ?? []);
  }
  if (!omit.has("assets")) {
    writeJson(path.join(root, "assets", "index.json"), opts.assets ?? {});
  }
  if (!omit.has("entries")) {
    for (const [ct, byLocale] of Object.entries(opts.entries ?? {})) {
      for (const [locale, records] of Object.entries(byLocale)) {
        const map: Record<string, any> = {};
        for (const r of records) map[r.uid] = r;
        const name =
          opts.layout === "branch" ? "3f2a1b0c-9d8e-entries.json" : `${locale}.json`;
        writeJson(path.join(root, "entries", ct, locale, name), map);
        writeJson(path.join(root, "entries", ct, locale, "index.json"), { "1": name });
      }
    }
  }
  for (const [ct, byLocale] of Object.entries(opts.variants ?? {})) {
    for (const [locale, records] of Object.entries(byLocale)) {
      const map: Record<string, any> = {};
      for (const r of records) map[r.uid] = r;
      writeJson(
        path.join(root, "entries", ct, locale, "variants", records[0]?.uid ?? "x", "v-variant-entry.json"),
        map
      );
    }
  }
  writeJson(path.join(root, "export-info.json"), {
    contentVersion: 2,
    exportedAt: opts.exportedAt ?? "2026-08-05T09:20:27.553Z",
  });
  return dir;
};

const recordKeys = (d: AuditExportData): string[] =>
  d.records.map((r) => `${r.ctUid}:${r.uid}:${r.locale}`).sort();

beforeEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
});

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe("v3 auditReader — directory resolution", () => {
  it("TC_AR_001 (positive): reads the export directory it is given and reports what it found", () => {
    const dir = buildExport(path.join(TMP, "e1"), {
      contentTypes: [{ uid: "blog", title: "Blog" }],
      entries: { blog: { en: [rec("e1", "en")] } },
    });

    const data = readAuditExport(dir);

    expect(data.modules).toMatchObject({ contentTypes: true, entries: true });
    expect(data.contentTypes).toHaveLength(1);
    expect(recordKeys(data)).toEqual(["blog:e1:en"]);
  });

  /*
    Negative — taxonomy #1 (missing input): the directory does not exist at all.

    This is EC-1's data half. The reader must report the failure in a form the
    caller can turn into the panel's error state, and must NOT return an
    empty-but-successful result — an empty success would render as a completed
    audit of a clean stack (FR-10.5), which is the single worst outcome for this
    feature.
  */
  it("TC_AR_001 (negative): a missing export directory is reported as unreadable, not as an empty success", () => {
    const missing = path.join(TMP, "does-not-exist");

    const data = readAuditExport(missing);

    expect(data.readable).toBe(false);
    expect(data.failureReason).toBe("export_missing");
    // Not an empty success: no module may be claimed present.
    expect(data.modules).toEqual({
      contentTypes: false,
      globalFields: false,
      assets: false,
      entries: false,
      taxonomies: false,
    });
  });
});

describe("v3 auditReader — layout tolerance", () => {
  it("TC_AR_002 (positive): finds modules sitting directly in the export root", () => {
    const dir = buildExport(path.join(TMP, "root"), {
      layout: "root",
      contentTypes: [{ uid: "blog" }],
      globalFields: [{ uid: "seo" }],
      assets: { a1: { uid: "a1", filename: "hero.png" } },
      entries: { blog: { en: [rec("e1", "en")] } },
    });

    const data = readAuditExport(dir);

    expect(data.readable).toBe(true);
    expect(data.modules).toEqual({
      contentTypes: true,
      globalFields: true,
      assets: true,
      entries: true,
      // False even here: these fixtures write no `taxonomies/` folder. The flag was
      // added with the unused-taxonomies check (commit 0a7b1331) after this suite was
      // written — see the note on the check count in `auditChecks.service.test.ts`.
      taxonomies: false,
    });
  });

  /*
    Negative — taxonomy #1 (empty input): a directory that exists but contains
    nothing. Distinct from TC_AR_001's negative: the export IS readable, there is
    simply nothing in it. Every module must report absent so each check resolves
    to `Not present` rather than to a count of zero (FR-2.11).
  */
  it("TC_AR_002 (negative): an existing but empty directory is readable with every module absent", () => {
    const dir = path.join(TMP, "empty");
    fs.mkdirSync(dir, { recursive: true });

    const data = readAuditExport(dir);

    expect(data.readable).toBe(true);
    expect(data.modules).toEqual({
      contentTypes: false,
      globalFields: false,
      assets: false,
      entries: false,
      taxonomies: false,
    });
    expect(data.records).toEqual([]);
  });

  it("TC_AR_003 (positive): finds modules nested inside a single branch sub-folder", () => {
    const dir = buildExport(path.join(TMP, "branch"), {
      layout: "branch",
      contentTypes: [{ uid: "blog" }],
      globalFields: [{ uid: "seo" }],
      assets: { a1: { uid: "a1" } },
      entries: { blog: { en: [rec("e1", "en")] } },
    });

    const data = readAuditExport(dir);

    // Identical result to the root layout — the caller cannot tell which
    // producer wrote the export, which is the point of FR-1.2.
    expect(data.modules).toEqual({
      contentTypes: true,
      globalFields: true,
      assets: true,
      entries: true,
      // False even here: these fixtures write no `taxonomies/` folder. The flag was
      // added with the unused-taxonomies check (commit 0a7b1331) after this suite was
      // written — see the note on the check count in `auditChecks.service.test.ts`.
      taxonomies: false,
    });
    expect(recordKeys(data)).toEqual(["blog:e1:en"]);
  });

  /*
    Negative — taxonomy #2 (invalid shape): a sub-folder exists but holds none of
    the recognised modules. It must not be mistaken for a branch folder, because
    doing so would make a genuinely empty export look like a branch export whose
    modules failed to load — reported as `Unavailable` instead of `Not present`,
    which are different claims (FR-2.10).
  */
  it("TC_AR_003 (negative): a sub-folder holding no recognised module is not treated as a branch root", () => {
    const dir = path.join(TMP, "not-a-branch");
    fs.mkdirSync(path.join(dir, "logs"), { recursive: true });
    fs.writeFileSync(path.join(dir, "logs", "export.log"), "some log output");

    const data = readAuditExport(dir);

    expect(data.readable).toBe(true);
    expect(data.modules.entries).toBe(false);
    expect(data.modules.contentTypes).toBe(false);
  });
});

describe("v3 auditReader — entry file naming", () => {
  it("TC_AR_004 (positive): reads entry records from '<locale>.json' files", () => {
    const dir = buildExport(path.join(TMP, "n1"), {
      layout: "root",
      entries: { blog: { en: [rec("e1", "en"), rec("e2", "en")] } },
    });

    expect(recordKeys(readAuditExport(dir))).toEqual(["blog:e1:en", "blog:e2:en"]);
  });

  it("TC_AR_005 (positive): reads entry records from '<uuid>-entries.json' files", () => {
    const dir = buildExport(path.join(TMP, "n2"), {
      layout: "branch",
      entries: { blog: { en: [rec("e1", "en"), rec("e2", "en")] } },
    });

    // Same records, different filename convention (FR-1.3).
    expect(recordKeys(readAuditExport(dir))).toEqual(["blog:e1:en", "blog:e2:en"]);
  });

  /*
    Negative — taxonomy #2 (invalid shape): `index.json` is a chunk pointer
    (`{"1": "en-us.json"}`), not entry data. Read as entry data it yields a
    phantom record keyed "1" with no uid, inflating the denominator and appearing
    in the table as a nameless row.
  */
  it("TC_AR_006 (negative): 'index.json' chunk pointers contribute no entry records", () => {
    const dir = buildExport(path.join(TMP, "n3"), {
      layout: "root",
      entries: { blog: { en: [rec("e1", "en")] } },
    });
    // buildExport already wrote index.json next to en.json; prove it is ignored.
    expect(fs.existsSync(path.join(dir, "entries", "blog", "en", "index.json"))).toBe(true);

    const data = readAuditExport(dir);

    expect(recordKeys(data)).toEqual(["blog:e1:en"]);
    expect(data.records.every((r) => !!r.uid)).toBe(true);
  });

  /*
    Negative — taxonomy #1 (empty input): a locale's data file is an empty object.
    It contributes no records, and — the load-bearing half — it must not drag the
    entries module to absent, because another locale does have data. Presence is
    a property of the module, not of each folder within it.
  */
  it("TC_AR_004 (negative): an empty locale data file contributes no records without marking entries absent", () => {
    const dir = buildExport(path.join(TMP, "n5"), {
      layout: "root",
      entries: { blog: { en: [rec("e1", "en")] } },
    });
    writeJson(path.join(dir, "entries", "blog", "de", "de.json"), {});

    const data = readAuditExport(dir);

    expect(data.modules.entries).toBe(true);
    expect(recordKeys(data)).toEqual(["blog:e1:en"]);
  });

  it("TC_AR_006 (positive): an entries folder yields exactly the records in its data file", () => {
    const dir = buildExport(path.join(TMP, "n4"), {
      layout: "root",
      entries: { blog: { en: [rec("e1", "en"), rec("e2", "en"), rec("e3", "en")] } },
    });

    expect(readAuditExport(dir).records).toHaveLength(3);
  });
});

describe("v3 auditReader — record identity", () => {
  it("TC_AR_007 (positive): the same entry uid in two locales yields two distinct records", () => {
    const dir = buildExport(path.join(TMP, "id1"), {
      layout: "root",
      entries: { page: { en: [rec("blt55e10ab", "en")], de: [rec("blt55e10ab", "de")] } },
    });

    const data = readAuditExport(dir);

    // Keyed by the PAIR (uid, locale) — FR-1.4. A uid-only key would collapse
    // these to one record and halve the denominator.
    expect(recordKeys(data)).toEqual(["page:blt55e10ab:de", "page:blt55e10ab:en"]);
    expect(data.records).toHaveLength(2);
  });

  /*
    Negative — taxonomy #7 (conflict): the same uid appears twice within one
    locale's data file. A uid-keyed map cannot hold both, so exactly one record
    must result — not two, and not zero.
  */
  it("TC_AR_007 (negative): a duplicated uid inside one locale yields a single record", () => {
    const dir = path.join(TMP, "id2");
    buildExport(dir, { layout: "root", entries: {} });
    writeJson(path.join(dir, "entries", "page", "en", "en.json"), {
      dup: rec("dup", "en", { title: "Second write wins" }),
    });

    const data = readAuditExport(dir);

    expect(data.records.filter((r) => r.uid === "dup")).toHaveLength(1);
  });
});

describe("v3 auditReader — fallback records", () => {
  it("TC_AR_008 (positive): a record whose own locale differs from its folder locale is dropped", () => {
    const dir = buildExport(path.join(TMP, "fb1"), {
      layout: "root",
      entries: {
        page: {
          de: [
            rec("real", "de"),
            // Contentstack's answer for an unlocalized locale: the master entry,
            // marked by entry_locale inside its publish rows.
            rec("bltdffbe49e924fbcc3", "en", {
              publish_details: [{ environment: "env1", locale: "de", entry_locale: "en" }],
            }),
          ],
        },
      },
    });

    const data = readAuditExport(dir);

    expect(recordKeys(data)).toEqual(["page:real:de"]);
    expect(data.records.find((r) => r.uid === "bltdffbe49e924fbcc3")).toBeUndefined();
  });

  /*
    Negative — taxonomy #4 (forbidden state): a dropped record must not survive
    anywhere in the reader's output. This is the assertion that makes FR-1.7
    meaningful — filtering the main list while leaving the record in a count or a
    secondary collection is the failure mode, and it is invisible until a number
    on screen is wrong.
  */
  it("TC_AR_009 (negative): a dropped fallback record is absent from the record count as well as the list", () => {
    const dir = buildExport(path.join(TMP, "fb2"), {
      layout: "root",
      entries: {
        page: { de: [rec("real", "de"), rec("fallback", "en")] },
        blog: { en: [rec("native", "en")] },
      },
    });

    const data = readAuditExport(dir);

    expect(data.records).toHaveLength(2);
    expect(data.entryRecordCount).toBe(2);
    expect(JSON.stringify(data.records)).not.toContain("fallback");
  });

  it("TC_AR_010 (negative): every retained record's own locale equals its folder locale", () => {
    const dir = buildExport(path.join(TMP, "fb3"), {
      layout: "root",
      entries: {
        page: {
          en: [rec("a", "en")],
          de: [rec("b", "de"), rec("c", "en")],
          fr: [rec("d", "fr"), rec("e", "en"), rec("f", "en")],
        },
      },
    });

    const data = readAuditExport(dir);

    // The invariant, stated directly: no retained record can disagree with the
    // folder it came from.
    for (const r of data.records) {
      expect(r.entry.locale).toBe(r.locale);
    }
    expect(data.records).toHaveLength(3);
  });

  it("TC_AR_011 (positive): a majority-fallback export retains only its localized records", () => {
    // Proportions taken from the 2026-08-05 reference export: 4 of 8 records in
    // the non-master folders are fallbacks, all 2 master-folder records are real.
    const dir = buildExport(path.join(TMP, "fb4"), {
      layout: "root",
      entries: {
        page: {
          en: [rec("p1", "en"), rec("p2", "en")],
          de: [rec("p1", "de"), rec("p2", "en"), rec("p3", "en")],
          fr: [rec("p1", "fr"), rec("p2", "en"), rec("p3", "en")],
        },
      },
    });

    const data = readAuditExport(dir);

    expect(recordKeys(data)).toEqual([
      "page:p1:de",
      "page:p1:en",
      "page:p1:fr",
      "page:p2:en",
    ]);
    expect(data.entryRecordCount).toBe(4);
  });

  /*
    Negative — taxonomy #4 (forbidden state): every record in a locale folder is a
    fallback, so that folder contributes nothing.

    The trap this guards: a dropped record must not still count as "this content
    type has entries". If it did, a content type whose only records are fallbacks
    would escape the empty-content-types check (FR-2.7) — the reader would drop
    the record from the list while leaving evidence of it behind in a per-content-
    type tally, and the check would read the tally.
  */
  it("TC_AR_011 (negative): a locale folder of nothing but fallback records leaves no trace of having had records", () => {
    const dir = buildExport(path.join(TMP, "fb5"), {
      layout: "root",
      entries: {
        press_release: { de: [rec("x", "en"), rec("y", "en")] },
        blog: { en: [rec("b1", "en")] },
      },
    });

    const data = readAuditExport(dir);

    expect(data.records.filter((r) => r.ctUid === "press_release")).toEqual([]);
    expect(data.entryRecordCount).toBe(1);
  });
});

describe("v3 auditReader — module presence", () => {
  it("TC_AR_012 (positive): presence is reported per module from what exists on disk", () => {
    const dir = buildExport(path.join(TMP, "mp1"), {
      layout: "root",
      assets: { a1: { uid: "a1" } },
      omitModules: ["entries", "globalFields"],
    });

    const data = readAuditExport(dir);

    expect(data.modules.assets).toBe(true);
    expect(data.modules.contentTypes).toBe(true);
    expect(data.modules.entries).toBe(false);
    expect(data.modules.globalFields).toBe(false);
  });

  /*
    Negative — taxonomy #2 (invalid shape / conflicting source of truth): the
    reader is given no access to the project's stored module selection at all, so
    it cannot be misled by one. Asserted by signature: presence is a function of
    the directory alone (FR-1.6).
  */
  it("TC_AR_013 (negative): an entries folder that exists but holds no records still reports entries absent", () => {
    const dir = buildExport(path.join(TMP, "mp2"), { layout: "root", entries: {} });
    // The folder exists — an exporter created it — but nothing is in it.
    fs.mkdirSync(path.join(dir, "entries"), { recursive: true });

    const data = readAuditExport(dir);

    // Presence must mean "there is entry data", not "there is a folder named
    // entries". Otherwise the unpublished check reports 0 of 0 and reads clean.
    expect(data.modules.entries).toBe(false);
    expect(data.records).toEqual([]);
  });
});

describe("v3 auditReader — per-module error isolation", () => {
  it("TC_AR_014 (positive): an unreadable module records an error against that module only", () => {
    const dir = buildExport(path.join(TMP, "err1"), {
      layout: "root",
      contentTypes: [{ uid: "blog" }],
      entries: { blog: { en: [rec("e1", "en")] } },
    });
    const gf = path.join(dir, "global_fields", "globalfields.json");
    fs.chmodSync(gf, 0o000);

    const data = readAuditExport(dir);

    expect(data.errors.globalFields).toBeTruthy();
    // The rest of the export still loaded.
    expect(data.contentTypes).toHaveLength(1);
    expect(data.records).toHaveLength(1);
    expect(data.errors.entries).toBeUndefined();

    fs.chmodSync(gf, 0o644);
  });

  /*
    Negative — taxonomy #6 (dependency failure): invalid JSON in one module must
    not fail the whole read. The reader returning `readable: false` here would
    escalate one bad file into the panel's full error state, hiding three checks
    that could have run (FR-1.5 vs FR-10.4 — different failures, different UI).
  */
  it("TC_AR_015 (negative): invalid JSON in one module does not make the whole export unreadable", () => {
    const dir = buildExport(path.join(TMP, "err2"), {
      layout: "root",
      contentTypes: [{ uid: "blog" }],
      entries: { blog: { en: [rec("e1", "en")] } },
    });
    fs.writeFileSync(path.join(dir, "assets", "index.json"), "{ this is not json");

    const data = readAuditExport(dir);

    expect(data.readable).toBe(true);
    expect(data.errors.assets).toBeTruthy();
    expect(data.contentTypes).toHaveLength(1);
    expect(data.records).toHaveLength(1);
  });
});

describe("v3 auditReader — variants and cache key", () => {
  it("TC_AR_035 (positive): variant records are read separately and variant presence is reported", () => {
    const dir = buildExport(path.join(TMP, "var1"), {
      layout: "root",
      entries: { blog: { en: [rec("e1", "en")] } },
      variants: { blog: { en: [rec("e1-v", "en")] } },
    });

    const data = readAuditExport(dir);

    expect(data.variantsPresent).toBe(true);
    expect(data.variantRecords.map((r) => r.uid)).toEqual(["e1-v"]);
    // Variants are NOT mixed into the main record list — they must not inflate
    // the denominator, only satisfy asset references (FR-2.12, FR-3.2).
    expect(recordKeys(data)).toEqual(["blog:e1:en"]);
  });

  /*
    Negative — taxonomy #1 (missing input): no variants directory. The flag must
    be false rather than absent, because the unused-assets card branches on it to
    decide whether to disclose that variant content was not inspected — and an
    undefined flag would render the caveat as if variants HAD been checked.
  */
  it("TC_AR_036 (negative): an export with no variants directory reports variantsPresent false", () => {
    const dir = buildExport(path.join(TMP, "var2"), {
      layout: "root",
      entries: { blog: { en: [rec("e1", "en")] } },
    });

    const data = readAuditExport(dir);

    expect(data.variantsPresent).toBe(false);
    expect(data.variantRecords).toEqual([]);
  });

  it("TC_AR_037 (positive): the export's own exportedAt is returned for use as a cache key", () => {
    const dir = buildExport(path.join(TMP, "ck1"), {
      layout: "root",
      exportedAt: "2026-08-05T09:20:27.553Z",
    });

    expect(readAuditExport(dir).exportedAt).toBe("2026-08-05T09:20:27.553Z");
  });

  /*
    Negative — taxonomy #1 (missing input): an export with no export-info.json,
    so no cache key can be derived. It must come back undefined rather than as a
    fabricated timestamp, because a fabricated one would differ on every read and
    silently defeat the cache (FR-7.8).
  */
  it("TC_AR_037 (negative): an export with no export-info.json yields no cache key rather than a fabricated one", () => {
    const dir = path.join(TMP, "ck2");
    writeJson(path.join(dir, "content_types", "schema.json"), []);

    const data = readAuditExport(dir);

    expect(data.readable).toBe(true);
    expect(data.exportedAt).toBeUndefined();
  });

  /*
    ── CLI bookkeeping files are not assets ─────────────────────────────────────

    MEASURED against a real `csdx cm:stacks:export` of a 10-asset stack, which
    reported 11. The `assets/` folder holds three JSON files and only one is data:

      <uuid>-assets.json  → the 10 real assets, uid → asset
      assets.json         → a chunk INDEX: {"1": "<uuid>-assets.json"}
      metadata.json       → {"<uuid>-assets.json": [ …versions… ]}

    The merge walked every `*.json` except `index.json` and kept any value where
    `typeof value === "object"`. `metadata.json`'s value is an ARRAY, which passes
    that guard, so its KEY — a filename — was merged in as though it were an asset
    uid. One phantom asset per export, inflating the audit's count and producing a
    row whose uid is a filename.

    Same family as the export reader's index-vs-chunk bug: a CLI bookkeeping file
    read as data. Both were invisible against fixtures that only ever wrote the
    data file.
  */
  it("(chunks, positive) counts only the real assets, ignoring the chunk index and metadata files", () => {
    const root = buildExport(path.join(TMP, "chunks-pos"), { assets: {} });
    const dir = path.join(root, "assets");
    // The real CLI writes no `assets/index.json`; it writes the three files below.
    fs.rmSync(path.join(dir, "index.json"), { force: true });
    writeJson(path.join(dir, "uuid-assets.json"), {
      a1: { uid: "a1", filename: "one.png" },
      a2: { uid: "a2", filename: "two.png" },
    });
    // The CLI's real siblings, verbatim in shape.
    writeJson(path.join(dir, "assets.json"), { "1": "uuid-assets.json" });
    writeJson(path.join(dir, "metadata.json"), {
      "uuid-assets.json": [{ uid: "a1", url: "https://example.com/one.png" }],
    });

    const result = readAuditExport(root);

    expect(Object.keys(result.assets)).toEqual(["a1", "a2"]);
  });

  /*
    Negative — taxonomy #2 (invalid shape): a filename key must never become an
    asset uid, which is precisely what the array-valued metadata entry caused.
  */
  it("(chunks, negative) never treats a metadata filename key as an asset uid", () => {
    const root = buildExport(path.join(TMP, "chunks-neg"), { assets: {} });
    const dir = path.join(root, "assets");
    fs.rmSync(path.join(dir, "index.json"), { force: true });
    writeJson(path.join(dir, "uuid-assets.json"), { a1: { uid: "a1", filename: "one.png" } });
    writeJson(path.join(dir, "metadata.json"), {
      "uuid-assets.json": [{ uid: "a1", url: "https://example.com/one.png" }],
    });

    const result = readAuditExport(root);

    expect(Object.keys(result.assets)).not.toContain("uuid-assets.json");
    expect(Object.keys(result.assets)).toHaveLength(1);
  });
});

// ───── a v2-shaped export (cli-v1-to-v2-migration.md §4.1, §4.3 — Step 1) ─────

/**
 * The audit reads the export folder, so it inherits both of v2's layout changes.
 *
 * Content types already worked — this reader has always tried the aggregate and then
 * the per-item files. Two things did not:
 *
 *   - global fields were read ONLY from `globalfields.json`, which v2 never writes
 *   - assets were read ONLY from `assets/`, which does not exist for an org whose
 *     plan includes asset spaces (they live at `spaces/<space-uid>/assets/`)
 *
 * Both failed as an empty module rather than an error, so the audit would report a
 * clean bill of health for content it had never looked at — the exact false-clean
 * FR-2.11 exists to prevent.
 */
const writeV2GlobalFields = (root: string, uids: string[]): void => {
  for (const uid of uids) {
    writeJson(path.join(root, "global_fields", `${uid}.json`), { uid, title: uid, schema: [] });
  }
};

const writeSpacesAssets = (root: string, assets: Record<string, any>): void => {
  const dir = path.join(root, "spaces", "amb7b704d0f0a5e71e", "assets");
  writeJson(path.join(dir, "uuid-assets.json"), assets);
  writeJson(path.join(dir, "assets.json"), { "1": "uuid-assets.json" });
};

describe("v3 auditReader — a v2-shaped export", () => {
  it("reads global fields from the per-item files when there is no aggregate", () => {
    const dir = path.join(TMP, "gf-items");
    buildExport(dir, { omitModules: ["globalFields"] });
    writeV2GlobalFields(dir, ["seo", "cards", "tabs"]);

    const data = readAuditExport(dir);

    expect(data.globalFields.map((g: any) => g.uid).sort()).toEqual(["cards", "seo", "tabs"]);
    expect(data.modules.globalFields).toBe(true);
  });

  /*
    Negative — taxonomy #1 (missing input): v1 writes ONLY the aggregate and no per-field
    files at all, so the aggregate must still be read. Paired so the v2 path cannot be
    added by replacing the v1 one — which would zero the global-field check for every
    export already on disk.
  */
  it("still reads global fields from the aggregate, and reports absence when there is neither", () => {
    const dir = path.join(TMP, "gf-agg");
    buildExport(dir, { globalFields: [{ uid: "seo" }, { uid: "cards" }] });
    expect(readAuditExport(dir).globalFields).toHaveLength(2);

    const bare = path.join(TMP, `no-gf-${Math.random().toString(36).slice(2)}`);
    buildExport(bare, { omitModules: ["globalFields"] });
    const absent = readAuditExport(bare);
    expect(absent.globalFields).toEqual([]);
    // Absent, not empty: an empty module that reported `present` would give the check a
    // clean result for data nobody read (FR-2.11).
    expect(absent.modules.globalFields).toBe(false);
  });

  it("reads assets from spaces/<space-uid>/assets when there is no assets folder", () => {
    const dir = path.join(TMP, "sp-assets");
    buildExport(dir, { omitModules: ["assets"] });
    writeSpacesAssets(dir, {
      blt1: { uid: "blt1", filename: "a.jpg" },
      blt2: { uid: "blt2", filename: "b.jpg" },
    });

    const data = readAuditExport(dir);

    expect(Object.keys(data.assets).sort()).toEqual(["blt1", "blt2"]);
    expect(data.modules.assets).toBe(true);
  });

  /*
    Negative — taxonomy #2 (invalid shape): `spaces/` also holds `fields/` and
    `asset_types/`, whose `fields.json` and `asset-types.json` are chunk INDEXES. Neither
    is an asset store, and counting one would report a filename as an asset uid — the same
    mistake that once made this reader say 11 assets for a 10-asset export.
  */
  it("does not treat spaces/fields or spaces/asset_types as an asset store", () => {
    const dir = path.join(TMP, "sp-nonassets");
    buildExport(dir, { omitModules: ["assets"] });
    writeJson(path.join(dir, "spaces", "fields", "fields.json"), { "1": "uuid-fields.json" });
    writeJson(path.join(dir, "spaces", "fields", "uuid-fields.json"), { f1: { uid: "f1" } });
    writeJson(path.join(dir, "spaces", "asset_types", "asset-types.json"), {
      "1": "uuid-asset_types.json",
    });

    const data = readAuditExport(dir);

    expect(data.assets).toEqual({});
    expect(data.modules.assets).toBe(false);
  });

  it("reads a fully v2-shaped export: per-item global fields and spaces assets together", () => {
    const dir = path.join(TMP, "v2-full");
    buildExport(dir, {
      layout: "root",
      contentTypes: [{ uid: "article", schema: [] }],
      omitModules: ["globalFields", "assets"],
      entries: { article: { "en-us": [{ uid: "e1", locale: "en-us", publish_details: [] }] } },
    });
    writeV2GlobalFields(dir, ["seo"]);
    writeSpacesAssets(dir, { blt1: { uid: "blt1", filename: "a.jpg" } });

    const data = readAuditExport(dir);

    expect(data.readable).toBe(true);
    expect(data.globalFields).toHaveLength(1);
    expect(Object.keys(data.assets)).toEqual(["blt1"]);
    expect(data.modules).toMatchObject({ contentTypes: true, globalFields: true, assets: true, entries: true });
  });

  /*
    Negative — taxonomy #6 (dependency shape): the classic layout must keep working
    unchanged. Only asset-spaces orgs get `spaces/`; for everyone else, on both majors,
    assets stay in `assets/`.
  */
  it("still reads assets from the classic assets folder", () => {
    const dir = path.join(TMP, "classic-assets");
    buildExport(dir, { assets: { blt9: { uid: "blt9", filename: "z.jpg" } } });

    const data = readAuditExport(dir);

    expect(Object.keys(data.assets)).toEqual(["blt9"]);
    expect(data.modules.assets).toBe(true);
  });
});
