import type {
  AuditCategory,
  AuditCheckView,
  AuditDecisionsView,
  DecisionState,
} from '../store/slice/audit.slice';

/**
 * Client-side decision resolution and impact derivation (cs-audit-report TR-9, TR-14).
 *
 * ⚠️ **A deliberate mirror of `api/v3/services/auditDecisions.service.ts`.** The TRD's
 * TC-2 says the client re-derives impact "using the same functions the server uses"; in
 * a repository where `api/` and `ui/` are separate packages with no shared module, that
 * is not literally achievable, so this is a parallel implementation held to the same
 * tests on both sides. Recorded as a deviation rather than glossed over — if these two
 * ever disagree, the impact panel and the footer will disagree with the endpoint, and
 * the user has no way to know which to believe.
 *
 * The two invariants are the same as the server's:
 *  1. resolution is against the CURRENT findings, so a category state is a standing
 *     policy rather than a snapshot (FR-7.4);
 *  2. the excluded count comes from resolved per-item verdicts only, never by adding a
 *     category total to a per-item tally (FR-3.4).
 */
export const EXCLUDABLE_CATEGORIES: AuditCategory[] = [
  'unpublishedEntries',
  'unusedAssets',
  'unusedTaxonomies',
];

export const isExcludable = (category: AuditCategory): boolean =>
  EXCLUDABLE_CATEGORIES.includes(category);

const isKnownKeyShape = (key: string): boolean =>
  /^entry:[^:]+:[^:]+:[^:]+$/.test(key) || /^asset:.+$/.test(key) || /^taxonomy:.+$/.test(key);

/** The item-key prefix each excludable category owns — mirrors
 * api/v3/services/auditDecisions.service.ts's CATEGORY_KEY_PREFIX. */
const CATEGORY_KEY_PREFIX: Partial<Record<AuditCategory, string>> = {
  unusedAssets: 'asset:',
  unpublishedEntries: 'entry:',
  unusedTaxonomies: 'taxonomy:',
};

export interface AuditItemLike {
  key: string;
  category: AuditCategory;
}

/** Items grouped per category, from whichever source the caller has to hand. */
export interface CategoryItems {
  category: AuditCategory;
  state: AuditCheckView['state'];
  keys: string[];
}

/**
 * Whether one item resolves as excluded, given its category's state and any override.
 * The single rule the whole two-layer model reduces to.
 */
export const isItemExcluded = (
  key: string,
  category: AuditCategory,
  decisions: AuditDecisionsView
): boolean => {
  if (!isExcludable(category)) return false;
  const override = isKnownKeyShape(key) ? decisions.itemOverrides[key] : undefined;
  if (override) return override === 'exclude';
  return decisions.categories[category] === 'exclude';
};

/**
 * The excluded count, derived from the CHECK COUNTS rather than from a loaded page.
 *
 * The client holds one page of items, so it cannot enumerate the whole flagged set. It
 * can still count exactly: a category's contribution is its full flagged count when
 * excluded, adjusted by the overrides that point the other way. This is arithmetic over
 * counts, not a second source of truth — and it is why `FR-3.4`'s double-count is
 * impossible here: each category is counted once and overrides only move items between
 * the two sides.
 */
export const countExcluded = (
  checks: AuditCheckView[],
  decisions: AuditDecisionsView
): number => {
  let total = 0;
  for (const check of checks ?? []) {
    if (check.state !== 'done' || !isExcludable(check.id)) continue;
    const flagged = check.count ?? 0;
    const categoryExcluded = decisions.categories[check.id] === 'exclude';

    const overridesForCategory = Object.entries(decisions.itemOverrides).filter(
      ([key, state]) => {
        if (!isKnownKeyShape(key)) return false;
        const prefix = CATEGORY_KEY_PREFIX[check.id];
        const belongs = !!prefix && key.startsWith(prefix);
        return belongs && !!state;
      }
    );

    if (categoryExcluded) {
      const reIncluded = overridesForCategory.filter(([, s]) => s === 'include').length;
      total += Math.max(0, flagged - reIncluded);
    } else {
      total += overridesForCategory.filter(([, s]) => s === 'exclude').length;
    }
  }
  return total;
};

export interface AuditImpactView {
  denominator: number;
  excluded: number;
  migrating: number;
  /** 0–100, for the progress bar's `aria-valuenow`. */
  percent: number;
}

export const deriveImpact = (
  denominator: number,
  checks: AuditCheckView[],
  decisions: AuditDecisionsView
): AuditImpactView => {
  const excluded = countExcluded(checks, decisions);
  const migrating = Math.max(0, Math.min(denominator, denominator - excluded));
  // Guarded against a zero denominator so an empty export cannot render NaN%.
  const percent = denominator > 0 ? Math.round((migrating / denominator) * 100) : 0;
  return { denominator, excluded, migrating, percent };
};

/** Keys belonging to one category, by prefix — the client's only available signal. */
const belongsToCategory = (key: string, category: AuditCategory): boolean => {
  const prefix = CATEGORY_KEY_PREFIX[category];
  return !!prefix && key.startsWith(prefix);
};

/**
 * Sets a category's state and clears that category's overrides (FR-7.2a).
 *
 * Only this category's — a blanket clear would discard per-row choices in a category the
 * user never touched (TC_AR_117). Returns a new object; never mutates, because the panel
 * holds the persisted set and the working set side by side to know what is unsaved.
 */
export const toggleCategory = (
  decisions: AuditDecisionsView,
  category: AuditCategory,
  next: DecisionState
): AuditDecisionsView => {
  const itemOverrides = Object.fromEntries(
    Object.entries(decisions.itemOverrides).filter(
      ([key]) => !belongsToCategory(key, category)
    )
  );
  return {
    categories: { ...decisions.categories, [category]: next },
    itemOverrides,
  };
};

export const setItemOverride = (
  decisions: AuditDecisionsView,
  key: string,
  next: DecisionState
): AuditDecisionsView => ({
  categories: { ...decisions.categories },
  itemOverrides: { ...decisions.itemOverrides, [key]: next },
});

/**
 * Excludes every flagged item in both excludable categories (FR-6.12), clearing the
 * overrides that would otherwise defeat it — the button promises "every flagged item",
 * so a surviving `include` override would leave rows quietly included while the label
 * flipped to "Include everything" (TC_AR_055b).
 */
export const excludeAllFlagged = (
  checks: AuditCheckView[],
  decisions: AuditDecisionsView
): AuditDecisionsView => {
  let out = decisions;
  for (const category of EXCLUDABLE_CATEGORIES) {
    const check = (checks ?? []).find((c) => c.id === category);
    if (!check || check.state !== 'done' || (check.count ?? 0) === 0) continue;
    out = toggleCategory(out, category, 'exclude');
  }
  return out;
};

export const includeEverything = (): AuditDecisionsView => ({
  categories: {},
  itemOverrides: {},
});

/** True when anything at all is currently excluded — drives the bulk button's label. */
export const hasAnyExclusion = (
  checks: AuditCheckView[],
  decisions: AuditDecisionsView
): boolean => countExcluded(checks, decisions) > 0;
