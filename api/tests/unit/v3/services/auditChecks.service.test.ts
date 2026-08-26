import { describe, it, expect } from "vitest";

/**
 * TDD — cs-audit-report, Phase 1 tranche 1b: the four checks and the state resolver.
 *
 * Backs TC_AR_016–034, TC_AR_038–046 and TC_AR_050
 * (feature.md FR-2.1 … FR-2.12, FR-3.2, trd.md TR-4, TR-5, TR-6).
 *
 * Pure functions over already-parsed input, so no filesystem and no mocks — the
 * reader owns the disk (see auditReader.service.test.ts) and these consume its
 * output. Building the input by hand rather than by writing files keeps each case
 * to the one variable it is about.
 *
 * TC_AR_047/048 (rendered output for an unrun check) belong to the panel tranche,
 * and TC_AR_049 (the wire format's absent `count` key) to the endpoint tranche;
 * this file asserts the same rule at the layer that produces it.
 */
import { runAuditChecks } from "../../../../v3/services/auditChecks.service.js";
import type {
  AuditExportData,
  AuditExportRecord,
} from "../../../../v3/services/auditReader.service.js";

/** One entry record as the reader hands it over. */
const rec = (
  ctUid: string,
  uid: string,
  locale: string,
  entry: Record<string, unknown> = {}
): AuditExportRecord => ({
  ctUid,
  uid,
  locale,
  entry: { uid, locale, title: `Entry ${uid}`, publish_details: [], ...entry },
});

/** A publish row for the given locale. */
const pub = (locale: string, environment = "env-dev") => ({
  environment,
  locale,
  time: "2026-02-12T06:58:38.986Z",
  user: "u1",
  version: 1,
});

const data = (over: Partial<AuditExportData> = {}): AuditExportData => ({
  readable: true,
  modules: { contentTypes: true, globalFields: true, assets: true, entries: true },
  contentTypes: [],
  globalFields: [],
  assets: {},
  records: [],
  entryRecordCount: 0,
  variantRecords: [],
  variantsPresent: false,
  errors: {},
  exportedAt: "2026-08-05T09:20:27.553Z",
  ...over,
});

/** Convenience: builds input whose entryRecordCount agrees with its records. */
const withRecords = (records: AuditExportRecord[], over: Partial<AuditExportData> = {}) =>
  data({ records, entryRecordCount: records.length, ...over });

const check = (result: ReturnType<typeof runAuditChecks>, id: string) =>
  result.checks.find((c) => c.id === id)!;

const flaggedUids = (result: ReturnType<typeof runAuditChecks>, id: string) =>
  check(result, id).items.map((i) => i.uid).sort();

// ───────────────────────── unpublished entries ─────────────────────────

describe("v3 auditChecks — unpublished entries", () => {
  it("TC_AR_016 (positive): a record with a publish row for its own locale is not flagged", () => {
    const result = runAuditChecks(
      withRecords([rec("page", "e1", "de", { publish_details: [pub("de")] })])
    );

    expect(flaggedUids(result, "unpublishedEntries")).toEqual([]);
    expect(check(result, "unpublishedEntries").count).toBe(0);
  });

  /*
    Negative — taxonomy #1 (empty input): an empty publish list. The plainest form
    of "published nowhere", and the one the reference export produces for 55 of its
    records.
  */
  it("TC_AR_017 (negative): a record with an empty publish_details array is flagged", () => {
    const result = runAuditChecks(
      withRecords([rec("page", "e1", "de", { publish_details: [] })])
    );

    expect(flaggedUids(result, "unpublishedEntries")).toEqual(["e1"]);
  });

  it("TC_AR_020 (positive): a record published in its own locale and others is not flagged", () => {
    const result = runAuditChecks(
      withRecords([rec("page", "e1", "de", { publish_details: [pub("de"), pub("en")] })])
    );

    expect(flaggedUids(result, "unpublishedEntries")).toEqual([]);
  });

  /*
    Negative — taxonomy #1 (missing input): the required row — one matching the
    record's own locale — is absent, even though the list is not empty.

    This is FR-2.3 as corrected on 2026-08-05. The requirement previously read as
    its own inverse, forbidding exactly this flag; a non-empty list is not evidence
    of publication in the locale being assessed.
  */
  it("TC_AR_018 (negative): a record whose publish rows are all for other locales is still flagged", () => {
    const result = runAuditChecks(
      withRecords([rec("page", "e1", "de", { publish_details: [pub("en"), pub("fr")] })])
    );

    expect(flaggedUids(result, "unpublishedEntries")).toEqual(["e1"]);
  });

  it("TC_AR_021 (positive): a record published only to a non-production environment is not flagged", () => {
    const result = runAuditChecks(
      withRecords([
        rec("page", "e1", "en", { publish_details: [pub("en", "env-dev-only")] }),
      ])
    );

    // The environment is irrelevant to the verdict (feature.md A-2) — only whether
    // a row exists for this record's locale.
    expect(flaggedUids(result, "unpublishedEntries")).toEqual([]);
  });

  /*
    Negative — taxonomy #3 (boundary): three rows present, none matching. Guards an
    implementation that checks only the FIRST row, or that treats "has rows" as a
    proxy for "published" — both of which pass TC_AR_018's two-row case by accident
    and fail here.
  */
  it("TC_AR_019 (negative): three publish rows, none for the record's locale, still flags it", () => {
    const result = runAuditChecks(
      withRecords([
        rec("page", "e1", "es", { publish_details: [pub("en"), pub("de"), pub("fr")] }),
      ])
    );

    expect(flaggedUids(result, "unpublishedEntries")).toEqual(["e1"]);
  });

  it("TC_AR_023 (positive): a published record with _in_progress true is not flagged", () => {
    const result = runAuditChecks(
      withRecords([
        rec("page", "e1", "en", { publish_details: [pub("en")], _in_progress: true }),
      ])
    );

    // `_in_progress` means "has unpublished changes", not "never published"
    // (FR-2.4). Reading it as publish state would flag every edited live entry.
    expect(flaggedUids(result, "unpublishedEntries")).toEqual([]);
  });

  /*
    Negative — taxonomy #4 (forbidden state): `_in_progress: false` on a record
    published nowhere. The mirror of TC_AR_023: an implementation that substituted
    `_in_progress` for publish state would pass that case and wrongly clear this
    one.
  */
  it("TC_AR_024 (negative): an unpublished record with _in_progress false is still flagged", () => {
    const result = runAuditChecks(
      withRecords([rec("page", "e1", "en", { publish_details: [], _in_progress: false })])
    );

    expect(flaggedUids(result, "unpublishedEntries")).toEqual(["e1"]);
  });

  it("TC_AR_016b (positive): each flagged record carries its content type, locale and a status label", () => {
    const result = runAuditChecks(
      withRecords([rec("blog", "e9", "fr", { title: "Untitled draft", publish_details: [] })])
    );

    const [item] = check(result, "unpublishedEntries").items;
    expect(item).toMatchObject({
      uid: "e9",
      title: "Untitled draft",
      contentType: "blog",
      locale: "fr",
      category: "unpublishedEntries",
    });
    expect(item.status).toBeTruthy();
    // The key is locale-qualified, because the same uid exists per locale (FR-7.3).
    expect(item.key).toBe("entry:blog:e9:fr");
  });

  /*
    Negative — taxonomy #7 (conflict): an entry and an asset share the same uid
    string. Their keys must not collide, because the decision store is keyed on them
    — a collision means excluding the asset also excludes the entry, or vice versa,
    with nothing on screen to explain it (FR-7.3).
  */
  it("TC_AR_016 (negative): an entry and an asset with the same uid produce non-colliding keys", () => {
    const result = runAuditChecks(
      withRecords([rec("blog", "shared", "en", { publish_details: [] })], {
        assets: { shared: { uid: "shared", filename: "clash.png", is_dir: false } },
      })
    );

    const entryKey = check(result, "unpublishedEntries").items[0].key;
    const assetKey = check(result, "unusedAssets").items[0].key;

    expect(entryKey).toBe("entry:blog:shared:en");
    expect(assetKey).toBe("asset:shared");
    expect(entryKey).not.toBe(assetKey);
  });

  /*
    Negative — taxonomy #1 (missing input): no `publish_details` key at all, as
    every entry in an export predating the 2026-08-05 exporter fix. The check
    cannot run, so it must report `unavailable` — not a count of zero, which would
    render as a clean bill of health for a stack nobody looked at (FR-2.11, EC-5).
  */
  it("TC_AR_050 (negative): records with no publish_details key make the check unavailable, not zero", () => {
    const noKey = rec("page", "e1", "en");
    delete (noKey.entry as Record<string, unknown>).publish_details;
    const result = runAuditChecks(withRecords([noKey]));

    const c = check(result, "unpublishedEntries");
    expect(c.state).toBe("unavailable");
    expect(c.count).toBeUndefined();
    expect(c.items).toEqual([]);
  });
});

// ───────────────────────── unused assets ─────────────────────────

describe("v3 auditChecks — unused assets", () => {
  const oneAsset = { a1: { uid: "a1", filename: "hero.png", is_dir: false } };

  it("TC_AR_025 (positive): an asset referenced by a top-level file field is not flagged", () => {
    const result = runAuditChecks(
      withRecords([rec("page", "e1", "en", { banner: { uid: "a1", filename: "hero.png" } })], {
        assets: oneAsset,
      })
    );

    expect(flaggedUids(result, "unusedAssets")).toEqual([]);
  });

  it("TC_AR_026 (positive): an asset referenced inside a group field is not flagged", () => {
    const result = runAuditChecks(
      withRecords(
        [rec("page", "e1", "en", { seo: { og: { image: { uid: "a1" } } } })],
        { assets: oneAsset }
      )
    );

    expect(flaggedUids(result, "unusedAssets")).toEqual([]);
  });

  it("TC_AR_027 (positive): an asset referenced inside a modular block is not flagged", () => {
    const result = runAuditChecks(
      withRecords(
        [rec("page", "e1", "en", { blocks: [{ hero: { picture: { uid: "a1" } } }] })],
        { assets: oneAsset }
      )
    );

    expect(flaggedUids(result, "unusedAssets")).toEqual([]);
  });

  it("TC_AR_028 (positive): an asset embedded in a rich-text field is not flagged", () => {
    const result = runAuditChecks(
      withRecords(
        [
          rec("page", "e1", "en", {
            body: '<p>see <img src="https://images.contentstack.io/v3/assets/blt1/a1/hero.png"></p>',
          }),
        ],
        { assets: oneAsset }
      )
    );

    expect(flaggedUids(result, "unusedAssets")).toEqual([]);
  });

  it("TC_AR_029 (positive): an asset embedded in a JSON rich-text field is not flagged", () => {
    const result = runAuditChecks(
      withRecords(
        [
          rec("page", "e1", "en", {
            rte_json: {
              type: "doc",
              children: [
                { type: "reference", attrs: { "asset-uid": "a1", "display-type": "block" } },
              ],
            },
          }),
        ],
        { assets: oneAsset }
      )
    );

    expect(flaggedUids(result, "unusedAssets")).toEqual([]);
  });

  it("TC_AR_030 (positive): an asset whose uid appears in a plain text field is not flagged", () => {
    const result = runAuditChecks(
      withRecords(
        [
          rec("page", "e1", "en", {
            description: "Download it at https://images.contentstack.io/v3/assets/blt1/a1/hero.png",
          }),
        ],
        { assets: oneAsset }
      )
    );

    expect(flaggedUids(result, "unusedAssets")).toEqual([]);
  });

  /*
    Negative — taxonomy #2 (invalid shape): every file field on every record is
    `null`, which is exactly what the 2026-08-05 reference export contains — 140
    file-field slots across 16 content types, none populated.

    The scan must survive it and reach the right verdict. A walker that assumed a
    file field is an object would throw on the first record, failing the whole
    check on the most ordinary real-world input we have.
  */
  it("TC_AR_026 (negative): file fields that are all null do not crash the scan", () => {
    const result = runAuditChecks(
      withRecords(
        [
          rec("page", "e1", "en", {
            banner: null,
            seo: { og: { image: null } },
            blocks: [{ hero: { picture: null } }],
          }),
        ],
        { assets: oneAsset }
      )
    );

    expect(check(result, "unusedAssets").state).toBe("done");
    expect(flaggedUids(result, "unusedAssets")).toEqual(["a1"]);
  });

  /*
    Negative — taxonomy #2 (invalid shape): a uid that merely CONTAINS an asset's
    uid as a substring is not a reference.

    FR-2.5 requires matching asset URLs inside text, and the cheapest way to do
    that is a substring search — which then reports `a1` as referenced by the text
    "a1b2c3". Because FR-2.6 makes the scan bias toward "used", this error is
    silent: the asset simply never appears as unused, and nobody notices the check
    under-reporting.
  */
  it("TC_AR_030 (negative): a uid appearing only as a substring of another value is not a reference", () => {
    const result = runAuditChecks(
      withRecords(
        [
          rec("page", "e1", "en", {
            description: "internal ref a1b2c3d4 and tracking id xxa1",
            other: { uid: "a1b2c3d4" },
          }),
        ],
        { assets: oneAsset }
      )
    );

    expect(flaggedUids(result, "unusedAssets")).toEqual(["a1"]);
  });

  /*
    Negative — taxonomy #1 (missing input): a record references a uid that is not in
    the asset index — an asset deleted from the source after the entry was written.
    The unknown uid must be ignored rather than added to the flagged set or the
    totals, because the audit reports on assets the export contains.
  */
  it("TC_AR_025 (negative): a reference to a uid absent from the asset index is ignored", () => {
    const result = runAuditChecks(
      withRecords([rec("page", "e1", "en", { banner: { uid: "deleted-asset" } })], {
        assets: oneAsset,
      })
    );

    expect(flaggedUids(result, "unusedAssets")).toEqual(["a1"]);
    expect(result.totals.assets).toBe(1);
  });

  /*
    Negative — taxonomy #3 (boundary): deeply nested field values. The walker must
    reach a reference buried well below the depths the other cases exercise, since
    real schemas nest groups inside blocks inside groups.
  */
  it("TC_AR_027 (negative): a reference nested eight levels deep is still found", () => {
    let deep: any = { uid: "a1" };
    for (let i = 0; i < 8; i++) deep = { [`level${i}`]: [deep] };
    const result = runAuditChecks(
      withRecords([rec("page", "e1", "en", { root: deep })], { assets: oneAsset })
    );

    expect(flaggedUids(result, "unusedAssets")).toEqual([]);
  });

  /*
    Negative — taxonomy #2 (invalid shape): variant records supplied while
    `variantsPresent` is false. The flag is the authority for the disclosure copy,
    so it must not be inferred from the array being non-empty — otherwise a reader
    change could flip the card's caveat without anyone touching the card.
  */
  it("TC_AR_036 (negative): variantsInspected follows the flag, not the presence of records", () => {
    const result = runAuditChecks(
      withRecords([], {
        variantsPresent: false,
        variantRecords: [rec("page", "v1", "en")],
      })
    );

    expect(result.variantsInspected).toBe(false);
  });

  /*
    Negative — taxonomy #1 (missing input): nothing anywhere references the asset.
    The only condition under which an asset may be flagged (FR-2.5).
  */
  it("TC_AR_031 (negative): an asset referenced by nothing at all is flagged", () => {
    const result = runAuditChecks(
      withRecords([rec("page", "e1", "en", { title: "No images here" })], {
        assets: { ...oneAsset, a2: { uid: "a2", filename: "orphan.jpg", is_dir: false } },
      })
    );

    expect(flaggedUids(result, "unusedAssets")).toEqual(["a1", "a2"]);
  });

  it("TC_AR_035b (positive): an asset referenced only by a variant record is not flagged", () => {
    const result = runAuditChecks(
      withRecords([rec("page", "e1", "en", { title: "base has no image" })], {
        assets: oneAsset,
        variantsPresent: true,
        variantRecords: [rec("page", "e1-v", "en", { banner: { uid: "a1" } })],
      })
    );

    // 7 of the 10 referenced assets on the reference stack are variant-only; a scan
    // that ignored variants would tell the user to delete them (FR-2.12).
    expect(flaggedUids(result, "unusedAssets")).toEqual([]);
  });

  /*
    Negative — taxonomy #6 (dependency failure): the assets module failed to parse,
    so the reader recorded an error against it. The check must report `unavailable`
    rather than flagging every asset it cannot see — or, worse, reporting zero
    unused and reading clean.
  */
  it("TC_AR_032 (negative): an assets module the reader could not parse makes the check unavailable", () => {
    const result = runAuditChecks(
      withRecords([rec("page", "e1", "en")], {
        assets: {},
        errors: { assets: "invalid json" },
      })
    );

    const c = check(result, "unusedAssets");
    expect(c.state).toBe("unavailable");
    expect(c.count).toBeUndefined();
  });

  it("TC_AR_033 (positive): a folder asset is excluded from the asset total", () => {
    const result = runAuditChecks(
      withRecords([], {
        assets: {
          a1: { uid: "a1", filename: "hero.png", is_dir: false },
          f1: { uid: "f1", name: "Campaigns", is_dir: true },
        },
      })
    );

    // A folder is not migratable content, so it is not part of the denominator
    // (FR-2.9, FR-3.2).
    expect(result.totals.assets).toBe(1);
  });

  /*
    Negative — taxonomy #4 (forbidden state): an unreferenced folder asset must not
    be flagged as unused. It satisfies the flag condition literally — nothing
    references it — so this needs its own exclusion, and without it every asset
    folder in a CLI export would be offered up for deletion.
  */
  it("TC_AR_034 (negative): an unreferenced folder asset is not flagged as unused", () => {
    const result = runAuditChecks(
      withRecords([], {
        assets: { f1: { uid: "f1", name: "Campaigns", is_dir: true } },
      })
    );

    expect(flaggedUids(result, "unusedAssets")).toEqual([]);
    expect(check(result, "unusedAssets").count).toBe(0);
  });

  it("TC_AR_036b (positive): variantsInspected reflects whether variant data was present", () => {
    const withVariants = runAuditChecks(
      withRecords([], { variantsPresent: true, variantRecords: [] })
    );
    const without = runAuditChecks(withRecords([], { variantsPresent: false }));

    // The unused-assets card branches on this to decide whether to disclose that
    // variant content was not inspected (FR-2.12).
    expect(withVariants.variantsInspected).toBe(true);
    expect(without.variantsInspected).toBe(false);
  });
});

// ───────────────────────── empty content types ─────────────────────────

describe("v3 auditChecks — empty content types", () => {
  it("TC_AR_038 (positive): a content type with no records in any locale is flagged", () => {
    const result = runAuditChecks(
      withRecords([rec("blog", "b1", "en")], {
        contentTypes: [{ uid: "blog", title: "Blog" }, { uid: "flights", title: "Flights" }],
      })
    );

    expect(flaggedUids(result, "emptyContentTypes")).toEqual(["flights"]);
  });

  /*
    Negative — taxonomy #3 (boundary): records in one locale and none in another.
    Emptiness is assessed across all locales, so a single record anywhere clears the
    content type. A per-locale assessment would flag every content type that is not
    fully translated.
  */
  it("TC_AR_039 (negative): a content type with records in one locale only is not flagged", () => {
    const result = runAuditChecks(
      withRecords([rec("blog", "b1", "en")], {
        contentTypes: [{ uid: "blog", title: "Blog" }],
      })
    );

    expect(flaggedUids(result, "emptyContentTypes")).toEqual([]);
  });

  /*
    Negative — taxonomy #4 (forbidden state): a content type whose only records in
    the export were fallbacks, and were therefore dropped by the reader before this
    check ran. It must be flagged as empty — the dropped records must not leave
    behind any evidence that would clear it.
  */
  it("TC_AR_040 (negative): a content type whose records were all dropped as fallbacks is flagged empty", () => {
    // The reader has already removed them, so `records` simply has none for it.
    const result = runAuditChecks(
      withRecords([rec("blog", "b1", "en")], {
        contentTypes: [{ uid: "blog" }, { uid: "press_release" }],
      })
    );

    expect(flaggedUids(result, "emptyContentTypes")).toEqual(["press_release"]);
  });

  it("TC_AR_038b (positive): a flagged content type reports a status and no locale", () => {
    const result = runAuditChecks(
      withRecords([], { contentTypes: [{ uid: "flights", title: "Flights" }] })
    );

    const [item] = check(result, "emptyContentTypes").items;
    expect(item).toMatchObject({ uid: "flights", category: "emptyContentTypes" });
    // A content type has no locale and no parent content type (feature.md DM-3).
    expect(item.locale).toBeUndefined();
    expect(item.contentType).toBeUndefined();
  });
});

// ───────────────────────── unused global fields ─────────────────────────

describe("v3 auditChecks — unused global fields", () => {
  it("TC_AR_041 (positive): a global field no schema references is flagged", () => {
    const result = runAuditChecks(
      withRecords([], {
        globalFields: [{ uid: "seo" }, { uid: "landing_page_image_grid" }],
        contentTypes: [
          { uid: "page", schema: [{ uid: "seo_block", data_type: "global_field", reference_to: "seo" }] },
        ],
      })
    );

    expect(flaggedUids(result, "unusedGlobalFields")).toEqual(["landing_page_image_grid"]);
  });

  /*
    Negative — taxonomy #2 (invalid shape / nesting): the reference sits inside a
    nested group rather than at the schema's top level. A top-level-only scan would
    flag a global field that is genuinely in use.
  */
  it("TC_AR_042 (negative): a global field referenced from inside a nested group is not flagged", () => {
    const result = runAuditChecks(
      withRecords([], {
        globalFields: [{ uid: "seo" }],
        contentTypes: [
          {
            uid: "page",
            schema: [
              {
                uid: "meta",
                data_type: "group",
                schema: [{ uid: "seo_block", data_type: "global_field", reference_to: "seo" }],
              },
            ],
          },
        ],
      })
    );

    expect(flaggedUids(result, "unusedGlobalFields")).toEqual([]);
  });
});

// ───────────────────────── check states and totals ─────────────────────────

describe("v3 auditChecks — states, labels and totals", () => {
  /*
    ⚠️ Updated 2026-08-25 from four checks to FIVE. `unusedTaxonomies` was added by
    commit 0a7b1331 ("feat: add unused-taxonomies audit check, make it excludable"),
    which is the current product intent — but this suite predates it and was still
    asserting four, so both cases here failed.

    Not merely stale: `feature.md` still says "four checks" in five places and lists
    taxonomy auditing as an explicit NON-GOAL (§Non-goals: "Checks beyond the four. No
    taxonomy … auditing"), because Q-5 recorded that taxonomy data was absent from
    every export. The CLI switch changed that — a real CLI export does contain
    `taxonomies/` — which is presumably why the check became possible. The spec and the
    test-case matrix have not caught up; reported rather than edited here, since neither
    is this suite's to change.
  */
  it("TC_AR_043 (positive): exactly five checks are produced, with the specified labels", () => {
    const result = runAuditChecks(data());

    expect(result.checks.map((c) => c.label)).toEqual([
      "Unused assets — referenced by any entry?",
      "Unpublished entries — has publish details?",
      "Empty content types — any entries at all?",
      "Unused global fields — referenced by a schema?",
      "Unused taxonomies — any term referenced by an entry?",
    ]);
  });

  /*
    Negative — taxonomy #3 (boundary): the count is FIXED, and none of the checks may be
    omitted whatever the input. A check that vanished when its module was absent would
    silently shrink the analyzing state's "n of N" counter.

    The guard itself still matters; only the number changed. It previously read "a fifth
    check must never appear", which is why adding `unusedTaxonomies` broke it — the
    boundary was deliberate, not an oversight, so it is being moved knowingly rather
    than quietly relaxed.
  */
  it("TC_AR_043 (negative): all five checks are present even when every module is absent", () => {
    const result = runAuditChecks(
      data({
        modules: { contentTypes: false, globalFields: false, assets: false, entries: false },
      })
    );

    expect(result.checks).toHaveLength(5);
    expect(result.checks.every((c) => c.state === "notPresent")).toBe(true);
  });

  it("TC_AR_044 (positive): a check with its module present and complete data resolves done with a count", () => {
    const result = runAuditChecks(
      withRecords([rec("page", "e1", "en", { publish_details: [] })])
    );

    const c = check(result, "unpublishedEntries");
    expect(c.state).toBe("done");
    expect(c.count).toBe(1);
  });

  /*
    Negative — taxonomy #1 (missing input): the module is absent, so the check
    cannot run. `count` must be **absent** rather than 0 — a present-but-zero count
    is indistinguishable from "we looked and found nothing", which is the false
    clean bill of health FR-2.11 exists to prevent.
  */
  it("TC_AR_045 (negative): a check whose module is absent resolves notPresent with no count key", () => {
    const result = runAuditChecks(
      data({
        modules: { contentTypes: true, globalFields: true, assets: true, entries: false },
      })
    );

    const c = check(result, "unpublishedEntries");
    expect(c.state).toBe("notPresent");
    expect(c.count).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(c, "count")).toBe(false);
  });

  it("TC_AR_046 (positive): a module present but missing its required field resolves unavailable", () => {
    const noKey = rec("page", "e1", "en");
    delete (noKey.entry as Record<string, unknown>).publish_details;

    const c = check(runAuditChecks(withRecords([noKey])), "unpublishedEntries");

    // Distinct from notPresent: there IS entry data, it just cannot answer this
    // question (FR-2.10). The two states drive different copy.
    expect(c.state).toBe("unavailable");
    expect(c.count).toBeUndefined();
  });

  /*
    Negative — taxonomy #2 (invalid shape): `notPresent` and `unavailable` are
    different claims and must not collapse into one. An implementation that treated
    "cannot answer" as "not present" would tell the user their export lacks entries
    when it has them.
  */
  it("TC_AR_046 (negative): a missing module and unusable data resolve to different states", () => {
    const absent = runAuditChecks(
      data({ modules: { contentTypes: true, globalFields: true, assets: true, entries: false } })
    );
    const noKey = rec("page", "e1", "en");
    delete (noKey.entry as Record<string, unknown>).publish_details;
    const unusable = runAuditChecks(withRecords([noKey]));

    expect(check(absent, "unpublishedEntries").state).toBe("notPresent");
    expect(check(unusable, "unpublishedEntries").state).toBe("unavailable");
  });

  it("TC_AR_044b (positive): the denominator sums content types, global fields, assets and entry records", () => {
    const result = runAuditChecks(
      withRecords(
        [rec("a", "1", "en"), rec("a", "1", "de"), rec("b", "2", "en")],
        {
          contentTypes: [{ uid: "a" }, { uid: "b" }, { uid: "c" }, { uid: "d" }],
          globalFields: [{ uid: "g1" }, { uid: "g2" }],
          assets: {
            x1: { uid: "x1", is_dir: false },
            x2: { uid: "x2", is_dir: false },
          },
        }
      )
    );

    // 4 + 2 + 2 + 3 = 11, with each locale version of an entry counted separately
    // (FR-3.2, A-3).
    expect(result.totals).toMatchObject({
      contentTypes: 4,
      globalFields: 2,
      assets: 2,
      entryRecords: 3,
      denominator: 11,
    });
  });

  /*
    Negative — taxonomy #1 (missing input): a module that is absent contributes 0
    to the denominator rather than making it NaN or undefined. Fixture F3's case —
    an export with no entries at all still has a meaningful total.
  */
  it("TC_AR_045b (negative): an absent module contributes zero to the denominator, not NaN", () => {
    const result = runAuditChecks(
      data({
        modules: { contentTypes: true, globalFields: true, assets: true, entries: false },
        contentTypes: [{ uid: "a" }, { uid: "b" }, { uid: "c" }, { uid: "d" }],
        globalFields: [{ uid: "g1" }, { uid: "g2" }],
        assets: { x1: { uid: "x1", is_dir: false } },
      })
    );

    expect(result.totals.entryRecords).toBe(0);
    expect(result.totals.denominator).toBe(7);
    expect(Number.isNaN(result.totals.denominator)).toBe(false);
  });
});
