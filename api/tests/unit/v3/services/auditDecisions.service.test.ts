import { describe, it, expect } from "vitest";

/**
 * TDD — cs-audit-report, Phase 1 tranche 2a: decision resolution and impact.
 *
 * Backs TC_AR_052–058 and TC_AR_106–118, 122–123
 * (feature.md FR-3.2 … FR-3.4, FR-7.1 … FR-7.4, FR-7.7, FR-7.2a; trd.md TR-9, TR-14).
 *
 * Pure functions, no mocks. These live server-side but are consumed by BOTH sides:
 * the client re-derives the impact numbers locally as the user toggles, using the
 * same functions the endpoints use, so the two can never disagree
 * ([trd.md §4](../trd.md) data flow step 6).
 *
 * Every quantitative case uses fixture **F1** from feature.md §11 — 4 content
 * types, 2 global fields, 10 assets, 20 entry records, denominator 36, with 6
 * unpublished records, 4 unused assets, 1 empty content type and 1 unused global
 * field flagged. Real-stack numbers are deliberately not used: the current
 * exporter's known defects would bake two wrong figures into the suite.
 */
import {
  resolveExclusions,
  deriveImpact,
  toggleCategory,
  setItemOverride,
  excludeAllFlagged,
  includeEverything,
  AuditDecisions,
} from "../../../../v3/services/auditDecisions.service.js";
import type {
  AuditCheck,
  AuditFlaggedItem,
  AuditTotals,
} from "../../../../v3/services/auditChecks.service.js";

const entryItem = (n: number): AuditFlaggedItem => ({
  key: `entry:blog:e${n}:en`,
  category: "unpublishedEntries",
  type: "Entry",
  title: `Draft ${n}`,
  uid: `e${n}`,
  contentType: "blog",
  locale: "en",
  status: "Never published",
});

const assetItem = (n: number): AuditFlaggedItem => ({
  key: `asset:a${n}`,
  category: "unusedAssets",
  type: "Asset",
  title: `orphan-${n}.png`,
  uid: `a${n}`,
  status: "Unused",
});

const ctItem = (uid: string): AuditFlaggedItem => ({
  key: `contentType:${uid}`,
  category: "emptyContentTypes",
  type: "Content type",
  title: uid,
  uid,
  status: "0 entries",
});

const gfItem = (uid: string): AuditFlaggedItem => ({
  key: `globalField:${uid}`,
  category: "unusedGlobalFields",
  type: "Global field",
  title: uid,
  uid,
  status: "Unreferenced",
});

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/** Fixture F1's four checks. */
const F1_CHECKS = (over: { unpublished?: number; assets?: number } = {}): AuditCheck[] => {
  const nUnpub = over.unpublished ?? 6;
  const nAssets = over.assets ?? 4;
  return [
    {
      id: "unusedAssets",
      label: "Unused assets — referenced by any entry?",
      state: "done",
      count: nAssets,
      items: range(nAssets).map(assetItem),
    },
    {
      id: "unpublishedEntries",
      label: "Unpublished entries — has publish details?",
      state: "done",
      count: nUnpub,
      items: range(nUnpub).map(entryItem),
    },
    {
      id: "emptyContentTypes",
      label: "Empty content types — any entries at all?",
      state: "done",
      count: 1,
      items: [ctItem("flights")],
    },
    {
      id: "unusedGlobalFields",
      label: "Unused global fields — referenced by a schema?",
      state: "done",
      count: 1,
      items: [gfItem("landing_page_image_grid")],
    },
  ];
};

/** Fixture F1's totals: 4 + 2 + 10 + 20 = 36. */
const F1_TOTALS: AuditTotals = {
  contentTypes: 4,
  globalFields: 2,
  assets: 10,
  entryRecords: 20,
  denominator: 36,
};

/** Fixture F3's totals: entries module absent — 4 + 2 + 10 = 16. */
const F3_TOTALS: AuditTotals = {
  contentTypes: 4,
  globalFields: 2,
  assets: 10,
  entryRecords: 0,
  denominator: 16,
};

const NONE: AuditDecisions = { categories: {}, itemOverrides: {} };

// ───────────────────────── the denominator ─────────────────────────

describe("v3 auditDecisions — denominator", () => {
  it("TC_AR_052 (positive): fixture F1's denominator is 36", () => {
    expect(deriveImpact(F1_TOTALS, F1_CHECKS(), NONE).denominator).toBe(36);
  });

  it("TC_AR_053 (positive): fixture F3, whose entries module is absent, has a denominator of 16", () => {
    expect(deriveImpact(F3_TOTALS, F1_CHECKS(), NONE).denominator).toBe(16);
  });

  /*
    Negative — taxonomy #3 (boundary): the migrating count may never fall below
    zero, nor exceed the denominator, whatever the decisions say. An impact panel
    reading "-4 of 36" or "41 of 36" is worse than a wrong-but-plausible number,
    because it destroys confidence in the whole page.
  */
  it("TC_AR_053 (negative): migrating stays within 0..denominator even with more overrides than items", () => {
    const overrides: Record<string, "include" | "exclude"> = {};
    // 50 exclude overrides against a fixture holding 10 excludable items, half of
    // them naming items that do not exist.
    for (let i = 1; i <= 50; i++) overrides[`entry:blog:e${i}:en`] = "exclude";
    const impact = deriveImpact(F1_TOTALS, F1_CHECKS(), { categories: {}, itemOverrides: overrides });

    expect(impact.migrating).toBeGreaterThanOrEqual(0);
    expect(impact.migrating).toBeLessThanOrEqual(36);
    // Only the 6 that actually exist can be excluded.
    expect(impact.excluded).toBe(6);
  });
});

// ───────────────────────── the migrating count ─────────────────────────

describe("v3 auditDecisions — migrating count", () => {
  it("TC_AR_054 (positive): excluding the unpublished-entries category leaves 30 of 36", () => {
    const impact = deriveImpact(F1_TOTALS, F1_CHECKS(), {
      categories: { unpublishedEntries: "exclude" },
      itemOverrides: {},
    });

    expect(impact).toMatchObject({ denominator: 36, excluded: 6, migrating: 30 });
  });

  it("TC_AR_055 (positive): excluding everything flagged leaves 26 of 36", () => {
    const checks = F1_CHECKS();
    const impact = deriveImpact(F1_TOTALS, checks, excludeAllFlagged(checks, NONE));

    // 6 unpublished + 4 unused assets = 10 excludable. The empty content type and
    // the unused global field are never excludable (A-4), so 36 - 10 = 26.
    expect(impact).toMatchObject({ excluded: 10, migrating: 26 });
  });

  it("TC_AR_056 (positive): excluding a single entry record leaves 35 of 36", () => {
    const impact = deriveImpact(
      F1_TOTALS,
      F1_CHECKS(),
      setItemOverride(NONE, "entry:blog:e1:en", "exclude")
    );

    expect(impact).toMatchObject({ excluded: 1, migrating: 35 });
  });

  /*
    Negative — taxonomy #7 (conflict): an item is BOTH inside an excluded category
    and carries its own `exclude` override.

    This is FR-3.4's bug seen from the other side. The reference prototype adds the
    category total to a per-item tally and reports 63 excluded where 51 is correct;
    the same double-count appears here if the resolver counts the category's items
    and then counts the overrides separately. The item must be counted once.
  */
  it("TC_AR_057 (negative): an item both in an excluded category and overridden to exclude counts once", () => {
    const impact = deriveImpact(F1_TOTALS, F1_CHECKS(), {
      categories: { unpublishedEntries: "exclude" },
      itemOverrides: { "entry:blog:e1:en": "exclude", "entry:blog:e2:en": "exclude" },
    });

    // Still exactly the 6 records in the category — not 6 + 2.
    expect(impact.excluded).toBe(6);
    expect(impact.migrating).toBe(30);
  });

  /*
    Negative — taxonomy #4 (forbidden state): an `include` override inside an
    excluded category reduces the excluded count. The count must come from the
    resolved per-item verdicts, never from the category's total.
  */
  it("TC_AR_058 (negative): re-including one row inside an excluded category yields 5 excluded, not 7", () => {
    const impact = deriveImpact(F1_TOTALS, F1_CHECKS(), {
      categories: { unpublishedEntries: "exclude" },
      itemOverrides: { "entry:blog:e1:en": "include" },
    });

    expect(impact.excluded).toBe(5);
    expect(impact.migrating).toBe(31);
  });
});

// ───────────────────────── default state ─────────────────────────

describe("v3 auditDecisions — default state", () => {
  it("TC_AR_106 (positive): with no decisions, nothing is excluded and everything migrates", () => {
    const excluded = resolveExclusions(F1_CHECKS(), NONE);
    const impact = deriveImpact(F1_TOTALS, F1_CHECKS(), NONE);

    expect(excluded.size).toBe(0);
    expect(impact).toMatchObject({ excluded: 0, migrating: 36 });
  });

  /*
    Negative — taxonomy #4 (forbidden state): a category state naming a
    NON-excludable category must be ignored.

    Content types and global fields always migrate (A-4, FR-5.2). The UI offers no
    control for them, so such a state can only arrive from a hand-edited record or
    a future bug — and honouring it would silently drop a content type the user was
    told was being kept.
  */
  it("TC_AR_107 (negative): a category state for a non-excludable category is ignored", () => {
    const excluded = resolveExclusions(F1_CHECKS(), {
      categories: { emptyContentTypes: "exclude", unusedGlobalFields: "exclude" } as any,
      itemOverrides: {},
    });

    expect(excluded.size).toBe(0);
    expect(deriveImpact(F1_TOTALS, F1_CHECKS(), {
      categories: { emptyContentTypes: "exclude" } as any,
      itemOverrides: {},
    }).migrating).toBe(36);
  });
});

// ───────────────────────── the two-layer model ─────────────────────────

describe("v3 auditDecisions — category state plus overrides", () => {
  it("TC_AR_108 (positive): an override is interpreted relative to its category's state", () => {
    const checks = F1_CHECKS();

    // Category included, one item excluded → that one item only.
    const a = resolveExclusions(checks, {
      categories: { unpublishedEntries: "include" },
      itemOverrides: { "entry:blog:e1:en": "exclude" },
    });
    expect([...a]).toEqual(["entry:blog:e1:en"]);

    // Category excluded, same item included → the other five only.
    const b = resolveExclusions(checks, {
      categories: { unpublishedEntries: "exclude" },
      itemOverrides: { "entry:blog:e1:en": "include" },
    });
    expect([...b].sort()).toEqual([
      "entry:blog:e2:en",
      "entry:blog:e3:en",
      "entry:blog:e4:en",
      "entry:blog:e5:en",
      "entry:blog:e6:en",
    ]);
  });

  /*
    Negative — taxonomy #4 (forbidden state): an override keyed to a
    non-excludable item must be ignored, even though its key is well formed.
    Same protection as TC_AR_107 at item granularity.
  */
  it("TC_AR_108 (negative): an override on a non-excludable item is ignored", () => {
    const excluded = resolveExclusions(F1_CHECKS(), {
      categories: {},
      itemOverrides: {
        "contentType:flights": "exclude",
        "globalField:landing_page_image_grid": "exclude",
      },
    });

    expect(excluded.size).toBe(0);
  });
});

// ───────────────────────── item keys ─────────────────────────

describe("v3 auditDecisions — item keys", () => {
  it("TC_AR_112 (positive): an excluded entry record is keyed by content type, uid and locale", () => {
    const next = setItemOverride(NONE, "entry:blog:e1:en", "exclude");

    expect(next.itemOverrides).toEqual({ "entry:blog:e1:en": "exclude" });
    expect(resolveExclusions(F1_CHECKS(), next).has("entry:blog:e1:en")).toBe(true);
  });

  it("TC_AR_113 (positive): an excluded asset is keyed by asset uid alone", () => {
    const next = setItemOverride(NONE, "asset:a1", "exclude");

    expect(next.itemOverrides).toEqual({ "asset:a1": "exclude" });
    expect(resolveExclusions(F1_CHECKS(), next).has("asset:a1")).toBe(true);
  });

  /*
    Negative — taxonomy #7 (conflict): an entry uid and an asset uid are the same
    string. Excluding the asset must not exclude the entry. The prefix is what
    makes the two key spaces disjoint (FR-7.3).
  */
  it("TC_AR_114 (negative): excluding an asset does not exclude an entry sharing its uid", () => {
    const clash: AuditCheck[] = [
      {
        id: "unusedAssets",
        label: "Unused assets — referenced by any entry?",
        state: "done",
        count: 1,
        items: [{ ...assetItem(1), key: "asset:shared", uid: "shared" }],
      },
      {
        id: "unpublishedEntries",
        label: "Unpublished entries — has publish details?",
        state: "done",
        count: 1,
        items: [{ ...entryItem(1), key: "entry:blog:shared:en", uid: "shared" }],
      },
    ];

    const excluded = resolveExclusions(clash, setItemOverride(NONE, "asset:shared", "exclude"));

    expect([...excluded]).toEqual(["asset:shared"]);
    expect(excluded.has("entry:blog:shared:en")).toBe(false);
  });

  /*
    Negative — taxonomy #2 (invalid shape): a malformed or unrecognised key in the
    stored decisions must be ignored rather than throwing. The store is a JSON file
    an operator can edit, and one bad key must not make the audit unrenderable.
  */
  it("TC_AR_112 (negative): malformed and unknown keys in stored decisions are ignored, not thrown on", () => {
    const excluded = resolveExclusions(F1_CHECKS(), {
      categories: { notACategory: "exclude" } as any,
      itemOverrides: {
        "": "exclude",
        "entry:": "exclude",
        "nonsense": "exclude",
        "asset:a1": "exclude",
      } as any,
    });

    // The one valid key still works; the rest are ignored.
    expect([...excluded]).toEqual(["asset:a1"]);
  });
});

// ───────────────────────── override clearing (FR-7.2a) ─────────────────────────

describe("v3 auditDecisions — a category toggle clears that category's overrides", () => {
  it("TC_AR_115 (positive): toggling a category back to included clears its overrides", () => {
    let d = toggleCategory(NONE, "unusedAssets", "exclude");
    d = setItemOverride(d, "asset:a1", "include");
    expect(d.itemOverrides["asset:a1"]).toBe("include");

    d = toggleCategory(d, "unusedAssets", "include");

    expect(d.itemOverrides["asset:a1"]).toBeUndefined();
    expect(resolveExclusions(F1_CHECKS(), d).size).toBe(0);
  });

  it("TC_AR_116 (positive): excluding the category again excludes every item, with no surviving exception", () => {
    let d = toggleCategory(NONE, "unusedAssets", "exclude");
    d = setItemOverride(d, "asset:a1", "include");
    d = toggleCategory(d, "unusedAssets", "include");
    d = toggleCategory(d, "unusedAssets", "exclude");

    const excluded = resolveExclusions(F1_CHECKS(), d);

    // All 4 assets — the earlier exception does not reappear (FR-7.2a, EC-9).
    expect([...excluded].sort()).toEqual(["asset:a1", "asset:a2", "asset:a3", "asset:a4"]);
  });

  /*
    Negative — taxonomy #4 (forbidden state): toggling one category must not touch
    another's overrides. A blanket "clear all overrides" would satisfy TC_AR_115
    and TC_AR_116 while silently discarding the user's per-row choices in a
    category they never touched.
  */
  it("TC_AR_117 (negative): toggling one category leaves another category's overrides intact", () => {
    let d = toggleCategory(NONE, "unpublishedEntries", "exclude");
    d = setItemOverride(d, "entry:blog:e1:en", "include");
    d = setItemOverride(d, "entry:blog:e2:en", "include");

    d = toggleCategory(d, "unusedAssets", "exclude");
    d = toggleCategory(d, "unusedAssets", "include");

    expect(d.itemOverrides["entry:blog:e1:en"]).toBe("include");
    expect(d.itemOverrides["entry:blog:e2:en"]).toBe("include");
    expect(d.categories.unpublishedEntries).toBe("exclude");
  });

  it("TC_AR_115b (positive): 'Include everything' clears every category state and every override", () => {
    let d = toggleCategory(NONE, "unpublishedEntries", "exclude");
    d = setItemOverride(d, "asset:a1", "exclude");
    d = setItemOverride(d, "asset:a2", "exclude");

    const cleared = includeEverything();

    expect(cleared.categories).toEqual({});
    expect(cleared.itemOverrides).toEqual({});
    expect(deriveImpact(F1_TOTALS, F1_CHECKS(), cleared).migrating).toBe(36);
    // The prior value is untouched — these helpers return new objects rather than
    // mutating, so the client can hold both for comparison.
    expect(d.itemOverrides["asset:a1"]).toBe("exclude");
  });

  /*
    Negative — taxonomy #2 (invalid shape): the helpers must not mutate the
    decisions they are given. The client keeps the persisted set and a working set
    side by side to know whether anything is unsaved; in-place mutation would make
    those two the same object and the comparison always false.
  */
  it("TC_AR_116 (negative): toggleCategory and setItemOverride do not mutate their input", () => {
    const original: AuditDecisions = {
      categories: { unpublishedEntries: "exclude" },
      itemOverrides: { "entry:blog:e1:en": "include" },
    };
    const snapshot = JSON.stringify(original);

    toggleCategory(original, "unpublishedEntries", "include");
    setItemOverride(original, "asset:a1", "exclude");
    excludeAllFlagged(F1_CHECKS(), original);

    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

// ───────────────────────── standing policy ─────────────────────────

describe("v3 auditDecisions — a category state is a standing policy", () => {
  it("TC_AR_118 (positive): a category excluded when 4 items were flagged excludes all 9 after a re-export", () => {
    const d = toggleCategory(NONE, "unusedAssets", "exclude");

    const before = resolveExclusions(F1_CHECKS({ assets: 4 }), d);
    const after = resolveExclusions(F1_CHECKS({ assets: 9 }), d);

    expect(before.size).toBe(4);
    // The switch is a standing policy, not a snapshot of the items seen (FR-7.4).
    expect(after.size).toBe(9);
  });

  /*
    Negative — taxonomy #1 (missing input): after a re-export the flagged set can
    also SHRINK. A resolver that cached the item list at decision time, rather than
    resolving against the current findings, would keep excluding items that no
    longer exist and report a count higher than the category now holds.
  */
  it("TC_AR_118 (negative): a shrinking flagged set reduces the excluded count to match", () => {
    const d = toggleCategory(NONE, "unusedAssets", "exclude");

    const after = resolveExclusions(F1_CHECKS({ assets: 2 }), d);

    expect(after.size).toBe(2);
    expect([...after].sort()).toEqual(["asset:a1", "asset:a2"]);
  });
});

// ───────────────────────── stale overrides ─────────────────────────

describe("v3 auditDecisions — stale overrides", () => {
  /*
    Negative — taxonomy #1 (missing input): an override naming an item absent from
    the current findings, because the source was re-exported and the item deleted
    (EC-8). It must be ignored during resolution, and must not throw.
  */
  it("TC_AR_122 (negative): an override for an item that no longer exists is ignored", () => {
    const excluded = resolveExclusions(F1_CHECKS(), {
      categories: {},
      itemOverrides: {
        "entry:blog:deleted-entry:en": "exclude",
        "asset:deleted-asset": "exclude",
        "asset:a1": "exclude",
      },
    });

    expect([...excluded]).toEqual(["asset:a1"]);
    expect(deriveImpact(F1_TOTALS, F1_CHECKS(), {
      categories: {},
      itemOverrides: { "entry:blog:deleted-entry:en": "exclude" },
    }).excluded).toBe(0);
  });

  /*
    Negative — taxonomy #4 (forbidden state): resolving must not DELETE the stale
    override from the decisions it was handed (FR-7.7). Pruning on read would
    destroy the user's choice the moment they viewed a re-exported project — and
    silently, since the item is not on screen to notice missing.
  */
  it("TC_AR_123 (negative): resolving a stale override does not remove it from the decisions", () => {
    const decisions: AuditDecisions = {
      categories: {},
      itemOverrides: { "asset:gone": "exclude", "asset:a1": "exclude" },
    };

    resolveExclusions(F1_CHECKS(), decisions);
    deriveImpact(F1_TOTALS, F1_CHECKS(), decisions);

    expect(decisions.itemOverrides["asset:gone"]).toBe("exclude");
  });

  it("TC_AR_122b (positive): a stale override becomes effective again if its item returns", () => {
    const decisions: AuditDecisions = {
      categories: {},
      itemOverrides: { "asset:a9": "exclude" },
    };

    expect(resolveExclusions(F1_CHECKS({ assets: 4 }), decisions).size).toBe(0);
    // A later export flags a9 again — the retained override applies.
    expect(resolveExclusions(F1_CHECKS({ assets: 9 }), decisions).has("asset:a9")).toBe(true);
  });
});

// ───────────────────────── unrun checks ─────────────────────────

describe("v3 auditDecisions — checks that did not run", () => {
  it("TC_AR_055b (positive): 'Exclude all flagged' covers only the excludable categories", () => {
    const checks = F1_CHECKS();
    const d = excludeAllFlagged(checks, NONE);

    expect(d.categories).toEqual({
      unpublishedEntries: "exclude",
      unusedAssets: "exclude",
    });
    expect(d.categories).not.toHaveProperty("emptyContentTypes");
    expect(d.categories).not.toHaveProperty("unusedGlobalFields");
  });

  /*
    Negative — taxonomy #4 (forbidden state): "Exclude all flagged" must override
    surviving `include` overrides, not leave them standing.

    FR-6.12 promises the button acts on **every** flagged item. If it only sets the
    two category states and leaves earlier per-item `include` overrides in place,
    the user clicks "Exclude all flagged", the button flips to "Include everything"
    — and three rows are still quietly included, with the impact panel disagreeing
    with the label they just pressed.
  */
  it("TC_AR_055b (negative): 'Exclude all flagged' also clears include overrides that would defeat it", () => {
    const checks = F1_CHECKS();
    let d = toggleCategory(NONE, "unpublishedEntries", "exclude");
    d = setItemOverride(d, "entry:blog:e1:en", "include");
    d = setItemOverride(d, "entry:blog:e2:en", "include");

    const all = excludeAllFlagged(checks, d);

    // All 10 excludable items, with no survivors.
    expect(resolveExclusions(checks, all).size).toBe(10);
    expect(deriveImpact(F1_TOTALS, checks, all).migrating).toBe(26);
  });

  /*
    Negative — taxonomy #2 (invalid shape): an explicit `include` category state
    must resolve identically to no state at all.

    Two representations of the same intent exist — `{}` before the user touches
    anything, and `{unusedAssets: 'include'}` after they exclude and re-include.
    AC-2.3 requires toggling back to restore the *exact* pre-audit state, so if
    these two resolve differently the page cannot honour that.
  */
  it("TC_AR_106 (negative): an explicit include category state resolves identically to no state at all", () => {
    const checks = F1_CHECKS();
    const explicit: AuditDecisions = {
      categories: { unpublishedEntries: "include", unusedAssets: "include" },
      itemOverrides: {},
    };

    expect(resolveExclusions(checks, explicit).size).toBe(resolveExclusions(checks, NONE).size);
    expect(deriveImpact(F1_TOTALS, checks, explicit)).toEqual(
      deriveImpact(F1_TOTALS, checks, NONE)
    );
  });

  /*
    Negative — taxonomy #6 (dependency failure): a check that resolved
    `notPresent` or `unavailable` carries no items and no count. Resolution and
    impact must treat it as contributing nothing — not as zero exclusions from a
    known-empty set, and above all without reading its absent `count` as a number.
  */
  it("TC_AR_055 (negative): an unavailable or notPresent check contributes no exclusions and no NaN", () => {
    const checks: AuditCheck[] = [
      {
        id: "unusedAssets",
        label: "Unused assets — referenced by any entry?",
        state: "unavailable",
        items: [],
      },
      {
        id: "unpublishedEntries",
        label: "Unpublished entries — has publish details?",
        state: "notPresent",
        items: [],
      },
    ];

    const d = excludeAllFlagged(checks, NONE);
    const impact = deriveImpact(F3_TOTALS, checks, d);

    expect(resolveExclusions(checks, d).size).toBe(0);
    expect(impact.excluded).toBe(0);
    expect(impact.migrating).toBe(16);
    expect(Number.isNaN(impact.migrating)).toBe(false);
  });
});
