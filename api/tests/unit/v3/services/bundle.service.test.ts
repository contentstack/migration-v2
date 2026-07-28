import { describe, it, expect } from "vitest";
import AdmZip from "adm-zip";

import { parseBundle, BundleError } from "../../../../v3/services/bundle.service.js";

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
});
