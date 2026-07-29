import { describe, it, expect } from "vitest";
import AdmZip from "adm-zip";

/**
 * TDD — v3 bundleWriter.service. Produces the ACTUAL Contentstack export
 * bundle zip on disk (real content_types/global_fields/assets/entries files,
 * in the exact folder shape a real CS export uses — content_version pointer
 * files + real per-module data — the same shape bundle.service already knows
 * how to read back). Pure function: no network, no filesystem — just bytes in,
 * a zip Buffer out. Round-tripped through AdmZip to assert on real entries.
 */
import { buildStackBundleZip } from "../../../../v3/services/bundleWriter.service.js";

const readJson = (zip: AdmZip, path: string): any => {
  const entry = zip.getEntry(path);
  if (!entry) return undefined;
  return JSON.parse(zip.readAsText(entry));
};

describe("v3 bundleWriter.service", () => {
  it("(positive) writes real content types, global fields, assets, and entries into the CS bundle folder shape", () => {
    const buf = buildStackBundleZip({
      contentTypes: [{ uid: "blog", title: "Blog Post", schema: [] }],
      globalFields: [{ uid: "seo", title: "SEO", schema: [] }],
      assets: [{ uid: "a1", filename: "hero.png", url: "https://x/hero.png" }],
      entriesByContentType: [
        { ctUid: "blog", entries: [{ uid: "e1", title: "Welcome Post", locale: "en-us" }] },
      ],
    });
    const zip = new AdmZip(buf);

    expect(readJson(zip, "content_types/schema.json")).toEqual([
      { uid: "blog", title: "Blog Post", schema: [] },
    ]);
    expect(readJson(zip, "global_fields/globalfields.json")).toEqual([
      { uid: "seo", title: "SEO", schema: [] },
    ]);
    // assets/assets.json must stay a chunk pointer (real CS shape); the real
    // data lives in assets/index.json, keyed by uid.
    expect(readJson(zip, "assets/assets.json")).toEqual({ "1": "index.json" });
    expect(readJson(zip, "assets/index.json")).toEqual({
      a1: { uid: "a1", filename: "hero.png", url: "https://x/hero.png" },
    });
    // entries: per content type, per locale, a chunk pointer + the real map.
    expect(readJson(zip, "entries/blog/en-us/index.json")).toEqual({ "1": "en-us.json" });
    expect(readJson(zip, "entries/blog/en-us/en-us.json")).toEqual({
      e1: { uid: "e1", title: "Welcome Post", locale: "en-us" },
    });
  });

  // Negative — taxonomy #1 (missing/empty): an empty selection still produces
  // a structurally valid bundle (empty arrays/maps), not a crash or missing files.
  it("(negative) an entirely empty input still produces a valid, well-formed empty bundle", () => {
    const buf = buildStackBundleZip({
      contentTypes: [],
      globalFields: [],
      assets: [],
      entriesByContentType: [],
    });
    const zip = new AdmZip(buf);

    expect(readJson(zip, "content_types/schema.json")).toEqual([]);
    expect(readJson(zip, "global_fields/globalfields.json")).toEqual([]);
    expect(readJson(zip, "assets/index.json")).toEqual({});
    expect(readJson(zip, "assets/assets.json")).toEqual({ "1": "index.json" });
    // No content types selected -> no entries/ folder at all.
    expect(zip.getEntries().some((e) => e.entryName.startsWith("entries/"))).toBe(false);
  });

  // Regression guard: items missing a `uid` must be dropped rather than
  // corrupting the map under an "undefined" key.
  it("(negative) items without a uid are skipped when building the assets/entries maps", () => {
    const buf = buildStackBundleZip({
      contentTypes: [],
      globalFields: [],
      assets: [{ filename: "no-uid.png" } as any, { uid: "a1", filename: "hero.png" }],
      entriesByContentType: [{ ctUid: "blog", entries: [{ title: "no uid" } as any, { uid: "e1", title: "Real" }] }],
    });
    const zip = new AdmZip(buf);

    expect(readJson(zip, "assets/index.json")).toEqual({ a1: { uid: "a1", filename: "hero.png" } });
    expect(readJson(zip, "entries/blog/en-us/en-us.json")).toEqual({ e1: { uid: "e1", title: "Real" } });
  });

  // Custom locale support — default is en-us, but a stack's master locale
  // could differ; the writer must honor whatever locale is passed in.
  it("(positive) a custom locale is used for the entries folder path", () => {
    const buf = buildStackBundleZip({
      contentTypes: [],
      globalFields: [],
      assets: [],
      entriesByContentType: [{ ctUid: "blog", entries: [{ uid: "e1", title: "Bonjour" }] }],
      locale: "fr-fr",
    });
    const zip = new AdmZip(buf);

    expect(readJson(zip, "entries/blog/fr-fr/index.json")).toEqual({ "1": "fr-fr.json" });
    expect(readJson(zip, "entries/blog/fr-fr/fr-fr.json")).toEqual({ e1: { uid: "e1", title: "Bonjour" } });
  });
});
