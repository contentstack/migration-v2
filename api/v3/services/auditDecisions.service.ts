import type {
  AuditCategory,
  AuditCheck,
  AuditTotals,
} from "./auditChecks.service.js";

/**
 * Decision resolution and impact derivation
 * (cs-audit-report trd.md TR-9, TR-14).
 *
 * Pure, and shared by both sides: the endpoints resolve with these functions and the
 * client re-derives the impact numbers locally as the user toggles, so the two can
 * never disagree.
 *
 * Two invariants run through everything here:
 *
 * 1. **Resolution is against the CURRENT findings, never a snapshot.** That is what
 *    makes a category state a standing policy — excluding "unused assets" when 4 were
 *    flagged excludes all 9 after a re-export finds 9 (FR-7.4).
 * 2. **The excluded count comes from resolved per-item verdicts only.** Never by adding
 *    a category total to a per-item tally, which is how the reference prototype reports
 *    63 excluded where 51 is correct (FR-3.4).
 */
export type DecisionState = "include" | "exclude";

/** The two categories a user may act on. Content types and global fields never. */
export const EXCLUDABLE_CATEGORIES: AuditCategory[] = [
  "unpublishedEntries",
  "unusedAssets",
];

export interface AuditDecisions {
  /** Category-level standing policy (FR-7.4). */
  categories: Partial<Record<AuditCategory, DecisionState>>;
  /** Per-item overrides, interpreted relative to the category state (FR-7.2). */
  itemOverrides: Record<string, DecisionState>;
  updatedAt?: string;
}

export interface AuditImpact {
  denominator: number;
  excluded: number;
  migrating: number;
}

const isExcludable = (category: AuditCategory): boolean =>
  EXCLUDABLE_CATEGORIES.includes(category);

/** A structurally valid override key. Anything else is ignored (TC_AR_112 negative). */
const isKnownKeyShape = (key: string): boolean =>
  /^entry:[^:]+:[^:]+:[^:]+$/.test(key) || /^asset:.+$/.test(key);

/**
 * The keys of every item currently resolved as excluded.
 *
 * Derived by walking the CURRENT flagged items — so an override naming an item that no
 * longer exists simply never matches, and one whose item returns becomes effective
 * again (FR-7.7, EC-8). Nothing is pruned from the decisions here: pruning on read
 * would destroy the user's choice the moment they viewed a re-exported project, and
 * silently, since the item is not on screen to notice missing.
 */
export const resolveExclusions = (
  checks: AuditCheck[],
  decisions: AuditDecisions
): Set<string> => {
  const excluded = new Set<string>();
  const categories = decisions?.categories ?? {};
  const overrides = decisions?.itemOverrides ?? {};

  for (const check of checks ?? []) {
    // A check that did not run carries no items, and a non-excludable category is
    // never actionable however the stored decisions were written (A-4, FR-5.2).
    if (check.state !== "done" || !isExcludable(check.id)) continue;

    const categoryExcluded = categories[check.id] === "exclude";
    for (const item of check.items ?? []) {
      const override = isKnownKeyShape(item.key) ? overrides[item.key] : undefined;
      const isExcluded = override ? override === "exclude" : categoryExcluded;
      if (isExcluded) excluded.add(item.key);
    }
  }
  return excluded;
};

export const deriveImpact = (
  totals: AuditTotals,
  checks: AuditCheck[],
  decisions: AuditDecisions
): AuditImpact => {
  const denominator = totals?.denominator ?? 0;
  // One count, from the resolved set — never a sum of category totals and overrides.
  const excluded = resolveExclusions(checks, decisions).size;
  const migrating = Math.max(0, Math.min(denominator, denominator - excluded));
  return { denominator, excluded, migrating };
};

const clone = (decisions: AuditDecisions): AuditDecisions => ({
  categories: { ...(decisions?.categories ?? {}) },
  itemOverrides: { ...(decisions?.itemOverrides ?? {}) },
  ...(decisions?.updatedAt ? { updatedAt: decisions.updatedAt } : {}),
});

/** Every override key belonging to one category, given the current findings. */
const keysInCategory = (checks: AuditCheck[], category: AuditCategory): Set<string> => {
  const check = (checks ?? []).find((c) => c.id === category);
  return new Set((check?.items ?? []).map((i) => i.key));
};

/**
 * Sets a category's state and clears that category's per-item overrides (FR-7.2a).
 *
 * Clearing is the resolved reading of feature.md Q-2: "exclude this whole category"
 * should mean exactly that, with no invisible exceptions carried over from a decision
 * the user made and then undid. Only THIS category's overrides go — a blanket clear
 * would discard per-row choices in a category the user never touched (TC_AR_117).
 *
 * Returns a new object; never mutates its input, because the client holds the persisted
 * set and the working set side by side to know whether anything is unsaved.
 */
export const toggleCategory = (
  decisions: AuditDecisions,
  category: AuditCategory,
  next: DecisionState,
  checks: AuditCheck[] = []
): AuditDecisions => {
  const out = clone(decisions);
  out.categories[category] = next;

  const owned = keysInCategory(checks, category);
  for (const key of Object.keys(out.itemOverrides)) {
    // With findings to hand, clear precisely. Without them, fall back to the key's own
    // prefix — an asset key can only belong to unusedAssets, an entry key only to
    // unpublishedEntries.
    const belongs = owned.size
      ? owned.has(key)
      : category === "unusedAssets"
      ? key.startsWith("asset:")
      : key.startsWith("entry:");
    if (belongs) delete out.itemOverrides[key];
  }
  return out;
};

/** Sets one item's override. Returns a new object; never mutates its input. */
export const setItemOverride = (
  decisions: AuditDecisions,
  key: string,
  next: DecisionState
): AuditDecisions => {
  const out = clone(decisions);
  out.itemOverrides[key] = next;
  return out;
};

/**
 * Excludes every flagged item in every excludable category (FR-6.12).
 *
 * Also clears the overrides those categories own. FR-6.12 promises the action covers
 * **every** flagged item, and setting only the category states would leave earlier
 * `include` overrides standing — so the button would flip its label to "Include
 * everything" while some rows remained quietly included, contradicting the impact panel
 * (TC_AR_055b).
 */
export const excludeAllFlagged = (
  checks: AuditCheck[],
  decisions: AuditDecisions
): AuditDecisions => {
  let out = clone(decisions);
  for (const category of EXCLUDABLE_CATEGORIES) {
    const check = (checks ?? []).find((c) => c.id === category);
    if (!check || check.state !== "done" || (check.items ?? []).length === 0) continue;
    out = toggleCategory(out, category, "exclude", checks);
  }
  return out;
};

/** Clears every category state and every override (FR-6.13). */
export const includeEverything = (): AuditDecisions => ({
  categories: {},
  itemOverrides: {},
});
