import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * Source Export Revamp, Phase 3 — reading what the CLI wrote.
 *
 * Backs `docs/plans/source-export-revamp.md` Impact 2 (the `exportedAt` fix),
 * Impact 6 (the graph from disk) and Q-1 (per-module counts).
 *
 * Real filesystem against a temp dir: the folder layout IS the subject, so
 * mocking `fs` would test nothing. Fixtures use the CLI's real shape, measured
 * from `~/Documents/cs_chirag_demo` — modules inside a `<branch>/` subfolder,
 * `entries/<ct>/<locale>/<uuid>-entries.json`, `assets/<uuid>-assets.json`.
 */
import {
  resolveExportRoot,
  readExportCounts,
  readExportedContentTypes,
  stampExportedAt,
} from "../../../../v3/utils/exportFolder.util.js";

const TMP = path.join(os.tmpdir(), `v3-export-folder-${process.pid}`);
let dir: string;

const writeJson = (p: string, data: unknown) => {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data));
};

/** Builds a CLI-shaped export. `branch` mirrors the CLI's subfolder layout. */
const buildExport = (
  root: string,
  opts: {
    branch?: string;
    contentTypes?: unknown[];
    globalFields?: unknown[];
    assets?: number;
    entries?: Record<string, string[]>;
    exportInfo?: Record<string, unknown>;
  } = {}
) => {
  const base = opts.branch ? path.join(root, opts.branch) : root;
  if (opts.contentTypes) writeJson(path.join(base, "content_types", "schema.json"), opts.contentTypes);
  if (opts.globalFields) writeJson(path.join(base, "global_fields", "globalfields.json"), opts.globalFields);
  if (opts.assets !== undefined) {
    /*
      The CLI's real shape, corrected after running against a genuine export:
      `assets.json` is an INDEX of chunk filenames, and the assets themselves live
      in `<uuid>-assets.json`. The first version of this fixture put the assets in
      `assets.json` directly — a shape the CLI never produces — so the counter
      passed here while reporting 1 asset for a real 80-asset export.
    */
    const assets: Record<string, unknown> = {};
    for (let i = 0; i < opts.assets; i++) assets[`a${i}`] = { uid: `a${i}`, filename: `f${i}.png` };
    writeJson(path.join(base, "assets", "uuid-assets.json"), assets);
    writeJson(path.join(base, "assets", "assets.json"), { "1": "uuid-assets.json" });
  }
  for (const [ct, locales] of Object.entries(opts.entries ?? {})) {
    for (const locale of locales) {
      writeJson(path.join(base, "entries", ct, locale, "uuid-entries.json"), {
        e1: { uid: "e1", title: "One" },
        e2: { uid: "e2", title: "Two" },
      });
    }
  }
  if (opts.exportInfo) writeJson(path.join(base, "export-info.json"), opts.exportInfo);
  return base;
};

beforeEach(() => {
  dir = path.join(TMP, `case-${Math.random().toString(36).slice(2)}`);
  fs.mkdirSync(dir, { recursive: true });
});

afterEach(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

// ───────────────────────── locating the module root ─────────────────────────

describe("v3 export folder — locating the module root", () => {
  it("finds modules written directly at the root", () => {
    buildExport(dir, { contentTypes: [{ uid: "a", title: "A" }] });

    expect(resolveExportRoot(dir)).toBe(dir);
  });

  /*
    The CLI writes into a `<branch>/` subfolder, which is the layout every real
    CLI export has. Resolving one level down is what lets Audit and Content
    mapping read a CLI-produced bundle without changes of their own.
  */
  it("descends into the CLI's branch subfolder", () => {
    buildExport(dir, { branch: "main", contentTypes: [{ uid: "a", title: "A" }] });

    expect(resolveExportRoot(dir)).toBe(path.join(dir, "main"));
  });

  /*
    A directory holding no modules at all must resolve to itself rather than to
    some arbitrary subfolder. Guessing here would make a broken export look like
    a valid one rooted somewhere unexpected.
  */
  it("returns the directory itself when no module folder exists anywhere", () => {
    expect(resolveExportRoot(dir)).toBe(dir);
  });

  it("ignores a subfolder that holds no modules", () => {
    fs.mkdirSync(path.join(dir, "logs"), { recursive: true });
    buildExport(dir, { contentTypes: [{ uid: "a", title: "A" }] });

    expect(resolveExportRoot(dir)).toBe(dir);
  });
});

// ───────────────────────── per-module counts (Q-1) ─────────────────────────

describe("v3 export folder — counting what was exported", () => {
  it("counts content types, global fields, assets and entries", () => {
    buildExport(dir, {
      branch: "main",
      contentTypes: [{ uid: "a" }, { uid: "b" }, { uid: "c" }],
      globalFields: [{ uid: "g1" }, { uid: "g2" }],
      assets: 5,
      entries: { blog: ["en-us", "de-de"] },
    });

    // 2 entries per locale file × 2 locales
    expect(readExportCounts(dir)).toEqual({
      contentTypes: 3,
      globalFields: 2,
      assets: 5,
      entries: 4,
    });
  });

  /*
    A module the export did not include must count zero, not be absent or NaN.
    The counters feed StatTiles, and `NaN` renders as literal "NaN" while
    `undefined` renders as blank — both read as a bug to the operator.
  */
  it("reports zero, not undefined, for a module that was not exported", () => {
    buildExport(dir, { branch: "main", contentTypes: [{ uid: "a" }] });

    expect(readExportCounts(dir)).toEqual({
      contentTypes: 1,
      globalFields: 0,
      assets: 0,
      entries: 0,
    });
  });

  /*
    Counts must be readable MID-export, because they update per completed module
    (Q-1). A folder holding only the modules finished so far must not throw.
  */
  it("counts a partially written export without throwing", () => {
    buildExport(dir, { branch: "main", contentTypes: [{ uid: "a" }, { uid: "b" }] });

    expect(() => readExportCounts(dir)).not.toThrow();
    expect(readExportCounts(dir).contentTypes).toBe(2);
  });

  /*
    Malformed JSON in one module must not lose the counts for the others. One
    corrupt file should cost that module's number, not the whole panel.
  */
  it("keeps other counts when one module's file is malformed", () => {
    const base = buildExport(dir, { branch: "main", contentTypes: [{ uid: "a" }] });
    fs.mkdirSync(path.join(base, "assets"), { recursive: true });
    fs.writeFileSync(path.join(base, "assets", "uuid-assets.json"), "{ not json");

    const counts = readExportCounts(dir);
    expect(counts.contentTypes).toBe(1);
    expect(counts.assets).toBe(0);
  });

  /*
    Pins the distinction the first implementation got wrong: `assets.json` is a
    chunk INDEX, so counting it reports the number of chunks rather than of
    assets. Caught only by running against a real CLI export, which reported
    1 asset instead of 80.
  */
  it("counts assets from the chunk files, not from the assets.json index", () => {
    const base = buildExport(dir, { branch: "main" });
    const many: Record<string, unknown> = {};
    for (let i = 0; i < 80; i++) many[`a${i}`] = { uid: `a${i}` };
    writeJson(path.join(base, "assets", "chunk-assets.json"), many);
    writeJson(path.join(base, "assets", "assets.json"), { "1": "chunk-assets.json" });

    expect(readExportCounts(dir).assets).toBe(80);
  });

  it("counts an empty export as all zeros", () => {
    expect(readExportCounts(dir)).toEqual({
      contentTypes: 0,
      globalFields: 0,
      assets: 0,
      entries: 0,
    });
  });
});

// ───────────────────────── content types for the graph (Impact 6) ─────────────────────────

describe("v3 export folder — content types for the graph", () => {
  it("reads the exported content types", () => {
    buildExport(dir, {
      branch: "main",
      contentTypes: [
        { uid: "blog", title: "Blog" },
        { uid: "author", title: "Author" },
      ],
    });

    expect(readExportedContentTypes(dir).map((c: any) => c.uid)).toEqual(["blog", "author"]);
  });

  /*
    A missing content_types folder must yield an empty list rather than throw.
    A content-types-excluded export is legitimate (someone exporting only
    webhooks), and the graph for it is simply empty.
  */
  it("returns an empty list when no content types were exported", () => {
    buildExport(dir, { branch: "main", assets: 2 });

    expect(readExportedContentTypes(dir)).toEqual([]);
  });

  it("returns an empty list rather than throwing on malformed schema JSON", () => {
    const base = buildExport(dir, { branch: "main" });
    fs.mkdirSync(path.join(base, "content_types"), { recursive: true });
    fs.writeFileSync(path.join(base, "content_types", "schema.json"), "not json at all");

    expect(readExportedContentTypes(dir)).toEqual([]);
  });
});

// ───────────────────────── the exportedAt stamp (Impact 2) ─────────────────────────

describe("v3 export folder — stamping exportedAt", () => {
  it("adds exportedAt to the CLI's export-info.json", () => {
    const base = buildExport(dir, {
      branch: "main",
      contentTypes: [{ uid: "a" }],
      exportInfo: { contentVersion: 2, logsPath: "/somewhere" },
    });

    stampExportedAt(dir, "2026-08-11T10:00:00.000Z");

    const info = JSON.parse(fs.readFileSync(path.join(base, "export-info.json"), "utf8"));
    expect(info.exportedAt).toBe("2026-08-11T10:00:00.000Z");
  });

  /*
    The CLI's own fields must survive. `contentVersion` is what the IMPORT reads
    to decide how to interpret the bundle, so replacing the file wholesale would
    break the other half of the migration.
  */
  it("preserves the CLI's own fields rather than replacing the file", () => {
    const base = buildExport(dir, {
      branch: "main",
      contentTypes: [{ uid: "a" }],
      exportInfo: { contentVersion: 2, logsPath: "/somewhere" },
    });

    stampExportedAt(dir, "2026-08-11T10:00:00.000Z");

    const info = JSON.parse(fs.readFileSync(path.join(base, "export-info.json"), "utf8"));
    expect(info.contentVersion).toBe(2);
    expect(info.logsPath).toBe("/somewhere");
  });

  /*
    This is the whole reason Impact 2 exists. The Audit page's cache key IS
    `exportedAt`; without it a stale `audit.json` is indistinguishable from a
    fresh one, so Audit keeps showing findings from a PREVIOUS export with no
    error and no visible symptom. Two stamps must differ.
  */
  it("writes a distinct value per export, so the audit cache can invalidate", () => {
    const base = buildExport(dir, { branch: "main", contentTypes: [{ uid: "a" }] });

    stampExportedAt(dir, "2026-08-11T10:00:00.000Z");
    const first = JSON.parse(fs.readFileSync(path.join(base, "export-info.json"), "utf8")).exportedAt;
    stampExportedAt(dir, "2026-08-11T11:30:00.000Z");
    const second = JSON.parse(fs.readFileSync(path.join(base, "export-info.json"), "utf8")).exportedAt;

    expect(first).not.toBe(second);
    expect(second).toBe("2026-08-11T11:30:00.000Z");
  });

  it("creates export-info.json when the CLI left none", () => {
    const base = buildExport(dir, { branch: "main", contentTypes: [{ uid: "a" }] });

    stampExportedAt(dir, "2026-08-11T10:00:00.000Z");

    const info = JSON.parse(fs.readFileSync(path.join(base, "export-info.json"), "utf8"));
    expect(info.exportedAt).toBe("2026-08-11T10:00:00.000Z");
  });

  /*
    It must land in the MODULE root — the branch subfolder — because that is where
    the audit reader looks for it. Writing it one level up would leave the cache
    key permanently unreadable, which is the exact bug this fixes.
  */
  it("writes into the branch subfolder where the audit reader looks", () => {
    buildExport(dir, { branch: "main", contentTypes: [{ uid: "a" }] });

    stampExportedAt(dir, "2026-08-11T10:00:00.000Z");

    expect(fs.existsSync(path.join(dir, "main", "export-info.json"))).toBe(true);
  });

  /*
    Malformed existing JSON must not abort the stamp. Losing the cache key
    because the CLI wrote something unparseable would reintroduce the silent
    stale-audit bug through the back door.
  */
  it("still stamps when the existing export-info.json is malformed", () => {
    const base = buildExport(dir, { branch: "main", contentTypes: [{ uid: "a" }] });
    fs.writeFileSync(path.join(base, "export-info.json"), "{ broken");

    stampExportedAt(dir, "2026-08-11T10:00:00.000Z");

    const info = JSON.parse(fs.readFileSync(path.join(base, "export-info.json"), "utf8"));
    expect(info.exportedAt).toBe("2026-08-11T10:00:00.000Z");
  });
});
