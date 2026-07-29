import { describe, it, expect } from "vitest";
import AdmZip from "adm-zip";

import {
  parseBundle,
  parseBundleDetails,
  filterBundleBySelection,
  BundleError,
} from "../../../../v3/services/bundle.service.js";

/**
 * TDD — v3 bundle.service (parseBundle).
 * Backs TC_SRC_019 (validate → manifest with per-module counts) and TC_SRC_028
 * (invalid bundle → user-visible error, no manifest). feature.md FR-3.3/3.8, EC-3.
 */
const validExport = (): Buffer => {
  const zip = new AdmZip();
  zip.addFile("export-info.json", Buffer.from(JSON.stringify({ contentVersion: 2 })));
  zip.addFile(
    "content_types/schema.json",
    Buffer.from(JSON.stringify([{ uid: "a" }, { uid: "b" }]))
  );
  zip.addFile("global_fields/globalfields.json", Buffer.from(JSON.stringify([{ uid: "g" }])));
  zip.addFile("entries/a/en-us/en-us.json", Buffer.from(JSON.stringify({ e1: {}, e2: {} })));
  zip.addFile("entries/a/en-us/index.json", Buffer.from(JSON.stringify({ "1": "en-us.json" })));
  return zip.toBuffer();
};

describe("v3 bundle.service — parseBundle", () => {
  it("TC_SRC_019 (positive): a valid export yields a manifest with correct per-module counts", () => {
    const r = parseBundle(validExport());
    expect(r.modules.contentTypes).toBe(2);
    expect(r.modules.globalFields).toBe(1);
    expect(r.modules.entries).toBe(2); // summed keys of the locale data file, index.json skipped
    expect(r.manifest.find((m) => m.name === "Content Types")!.count).toBe(2);
    expect(r.contentVersion).toBe(2);
  });

  // Negative — taxonomy #1 (missing/empty module): absent module folder → count 0, not a crash.
  it("TC_SRC_019 (negative): a valid marker with no content_types reports Content Types count 0", () => {
    const zip = new AdmZip();
    zip.addFile("export-info.json", Buffer.from(JSON.stringify({ contentVersion: 2 })));
    const r = parseBundle(zip.toBuffer());
    expect(r.modules.contentTypes).toBe(0);
    expect(r.manifest.find((m) => m.name === "Content Types")!.count).toBe(0);
  });

  it("TC_SRC_028 (positive): a non-zip payload is rejected with BundleError 400 'Not a valid .zip archive.'", () => {
    try {
      parseBundle(Buffer.from("this is not a zip"));
      expect.unreachable("parseBundle should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(BundleError);
      expect((e as BundleError).status).toBe(400);
      expect((e as BundleError).message).toBe("Not a valid .zip archive.");
    }
  });

  // Negative — taxonomy #2 (invalid shape): a real zip that isn't a CS export is rejected specifically.
  it("TC_SRC_028 (negative): a zip lacking export-info and content_types is rejected as not a CS export", () => {
    const zip = new AdmZip();
    zip.addFile("readme.txt", Buffer.from("hello"));
    try {
      parseBundle(zip.toBuffer());
      expect.unreachable("parseBundle should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(BundleError);
      expect((e as BundleError).status).toBe(400);
      expect((e as BundleError).message).toMatch(/Not a Contentstack export bundle/);
    }
  });

  // Regression: assets/assets.json is a locale/chunk POINTER file (always
  // {"1":"index.json"} in real CS exports), never the real asset list — the
  // real per-asset map lives in assets/index.json. Counting assets.json's own
  // keys always reported "1 asset" regardless of the real count.
  it("(regression, positive) asset count is read from assets/index.json (the real per-asset map), not assets/assets.json", () => {
    const zip = new AdmZip();
    zip.addFile("export-info.json", Buffer.from(JSON.stringify({ contentVersion: 2 })));
    zip.addFile("content_types/schema.json", Buffer.from(JSON.stringify([{ uid: "a" }])));
    zip.addFile("assets/assets.json", Buffer.from(JSON.stringify({ "1": "index.json" })));
    zip.addFile(
      "assets/index.json",
      Buffer.from(
        JSON.stringify({
          asset1: { uid: "asset1", filename: "hero.png", title: "Hero" },
          asset2: { uid: "asset2", filename: "logo.svg", title: "Logo" },
        })
      )
    );
    const r = parseBundle(zip.toBuffer());
    expect(r.modules.assets).toBe(2);
    expect(r.manifest.find((m) => m.name === "Assets")!.count).toBe(2);
  });

  // Negative — taxonomy #1 (missing/empty): no assets/index.json at all → 0, not a crash,
  // and NOT the chunk-pointer's own key count.
  it("(regression, negative) a bundle with only the chunk pointer (no index.json) reports 0 assets", () => {
    const zip = new AdmZip();
    zip.addFile("export-info.json", Buffer.from(JSON.stringify({ contentVersion: 2 })));
    zip.addFile("assets/assets.json", Buffer.from(JSON.stringify({ "1": "index.json" })));
    const r = parseBundle(zip.toBuffer());
    expect(r.modules.assets).toBe(0);
  });
});

/**
 * TDD — v3 bundle.service (parseBundleDetails). Backs the live per-item export
 * log ("Exporting asset: hero.png", "Exporting entry: Welcome (BlogPost)")
 * requested for the Activity log — named samples + accurate totals per module.
 */
describe("v3 bundle.service — parseBundleDetails", () => {
  const richExport = (): Buffer => {
    const zip = new AdmZip();
    zip.addFile("export-info.json", Buffer.from(JSON.stringify({ contentVersion: 2 })));
    zip.addFile(
      "content_types/schema.json",
      Buffer.from(JSON.stringify([{ uid: "blog", title: "Blog Post" }]))
    );
    zip.addFile(
      "global_fields/globalfields.json",
      Buffer.from(JSON.stringify([{ uid: "seo", title: "SEO" }]))
    );
    zip.addFile(
      "assets/index.json",
      Buffer.from(
        JSON.stringify({
          a1: { uid: "a1", filename: "hero.png", title: "Hero" },
          a2: { uid: "a2", filename: "logo.svg", title: "Logo" },
        })
      )
    );
    zip.addFile(
      "entries/blog/en-us/en-us.json",
      Buffer.from(
        JSON.stringify({
          e1: { uid: "e1", title: "Welcome Post" },
          e2: { uid: "e2", title: "Second Post" },
        })
      )
    );
    return zip.toBuffer();
  };

  it("(positive) returns named content types, global fields, an asset sample, and per-CT entry samples with accurate counts", () => {
    const d = parseBundleDetails(richExport());
    expect(d.contentTypes).toEqual([{ uid: "blog", title: "Blog Post" }]);
    expect(d.globalFields).toEqual([{ uid: "seo", title: "SEO" }]);
    expect(d.assetCount).toBe(2);
    // Filenames (not display titles) — matches how assets are recognized in the export log.
    expect(d.assetSample.map((a) => a.title)).toEqual(expect.arrayContaining(["hero.png", "logo.svg"]));
    expect(d.entriesByContentType).toHaveLength(1);
    expect(d.entriesByContentType[0]).toMatchObject({ ctUid: "blog", ctTitle: "Blog Post", count: 2 });
    expect(d.entriesByContentType[0].sample.map((e: any) => e.title).sort()).toEqual([
      "Second Post",
      "Welcome Post",
    ]);
  });

  // Negative — taxonomy #1 (missing/empty): an export with none of these modules present
  // returns empty arrays/zero counts, not a crash.
  it("(negative) an export with no assets/entries/global fields returns empty samples and zero counts", () => {
    const zip = new AdmZip();
    zip.addFile("export-info.json", Buffer.from(JSON.stringify({ contentVersion: 2 })));
    zip.addFile("content_types/schema.json", Buffer.from(JSON.stringify([{ uid: "a", title: "A" }])));
    const d = parseBundleDetails(zip.toBuffer());
    expect(d.globalFields).toEqual([]);
    expect(d.assetSample).toEqual([]);
    expect(d.assetCount).toBe(0);
    expect(d.entriesByContentType).toEqual([{ ctUid: "a", ctTitle: "A", sample: [], count: 0 }]);
  });
});

/**
 * TDD — v3 bundle.service (filterBundleBySelection). Backs the "genuine file
 * export" feature: a file-mode "Specific module" export must actually produce
 * a real bundle containing ONLY the selected modules' real files — not just
 * gate the preview counts (feature.md FR-5.5 real-export follow-up).
 */
describe("v3 bundle.service — filterBundleBySelection", () => {
  it("(positive) keeps only the real files for selected modules, dropping the rest entirely", () => {
    const out = new AdmZip(filterBundleBySelection(validExport(), ["contentTypes", "globalFields"]));
    const names = out.getEntries().map((e) => e.entryName);

    expect(names).toContain("content_types/schema.json");
    expect(names).toContain("global_fields/globalfields.json");
    expect(names.some((n) => n.startsWith("entries/"))).toBe(false);
    // The real data is unchanged, byte-for-byte — same real content types as the source.
    const cts = JSON.parse(out.readAsText("content_types/schema.json"));
    expect(cts).toEqual([{ uid: "a" }, { uid: "b" }]);
  });

  // Negative — contrast: omitting the selection (whole-bundle scope) keeps everything.
  it("(negative) omitting the selection keeps every module's real files", () => {
    const out = new AdmZip(filterBundleBySelection(validExport()));
    const names = out.getEntries().map((e) => e.entryName);

    expect(names).toContain("content_types/schema.json");
    expect(names).toContain("global_fields/globalfields.json");
    expect(names.some((n) => n.startsWith("entries/"))).toBe(true);
  });

  // Regression: a bundle nested under a single top-level folder (as some real
  // CS exports are) must have that prefix stripped in the output, matching
  // our own writer's flat convention — not double-nested.
  it("(regression) strips a single-top-folder prefix so the output bundle is flat, like our own writer", () => {
    const zip = new AdmZip();
    zip.addFile("myexport/export-info.json", Buffer.from(JSON.stringify({ contentVersion: 2 })));
    zip.addFile("myexport/content_types/schema.json", Buffer.from(JSON.stringify([{ uid: "a" }])));
    const out = new AdmZip(filterBundleBySelection(zip.toBuffer(), ["contentTypes"]));
    const names = out.getEntries().map((e) => e.entryName);

    expect(names).toContain("content_types/schema.json");
    expect(names.some((n) => n.startsWith("myexport/"))).toBe(false);
  });
});
