/**
 * The seven migration wizard steps — the single data-driven definition of the
 * flow (feature.md FR-2.1, FR-5.1–5.5).
 *
 * Adding a step is an entry here, not a code change. Copy the design does not
 * specify is left `undefined` on purpose rather than guessed: `actionLabel` and
 * `statusLine` for Migrate/Verify (feature.md Q-3), and `appBarTitle` for four
 * steps (Q-4, which also warns those titles are NOT simply the tracker labels).
 */

/** Per-step state the chrome passes to copy resolvers and completeness tests. */
export interface StepContext {
  /** Audit step: whether the audit has finished generating. */
  auditReady?: boolean;
  excludedCount?: number;
  migratingCount?: number;
  /** Source step: whether the persisted source is ready (a succeeded export). */
  sourceReady?: boolean;
  /** Destination step: whether a destination selection has been persisted. */
  destinationPersisted?: boolean;
}

export interface WizardStep {
  id: string;
  routeSegment: string;
  trackerLabel: string;
  /** Shown in the app bar as "Step n of 7 · {appBarTitle}". Undecided for four steps. */
  appBarTitle?: string;
  /** The footer's primary-action label. Undecided for Migrate and Verify. */
  actionLabel?: string;
  /** Footer status line — a string, or a function of the step's own state. */
  statusLine?: string | ((ctx: StepContext) => string | undefined);
  /** Generic "what's missing" explanation when the gate is unsatisfied. */
  blockedExplanation?: string;
  /**
   * Whether this step counts as complete. Confirmed rule: derive it where the
   * step actually persists something, and fall back to positional for steps
   * that do not persist anything yet (feature.md FR-2.2 / trd.md TC-2).
   * `undefined` here means "no completeness test — use the positional fallback".
   */
  isComplete?: (ctx: StepContext) => boolean;
}

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'source',
    routeSegment: 'source',
    trackerLabel: 'Source',
    actionLabel: 'Proceed to audit',
    statusLine: 'Configure your source stack, then proceed to the audit.',
    blockedExplanation: 'Review your source, then proceed to the audit',
    isComplete: (ctx) => !!ctx.sourceReady,
  },
  {
    id: 'audit',
    routeSegment: 'audit',
    trackerLabel: 'Audit',
    appBarTitle: 'Audit report',
    actionLabel: 'Continue to Destination',
    blockedExplanation: 'Finish the audit to continue',
    statusLine: (ctx) => {
      if (!ctx.auditReady) return 'Generating audit — you can continue once it finishes';
      if (!ctx.excludedCount) return 'Audit complete — nothing excluded';
      return `Audit complete — ${ctx.excludedCount.toLocaleString('en-US')} excluded, ${(
        ctx.migratingCount ?? 0
      ).toLocaleString('en-US')} will migrate`;
    },
  },
  {
    id: 'destination',
    routeSegment: 'destination',
    trackerLabel: 'Destination',
    actionLabel: 'Proceed to content mapping',
    statusLine: 'Configure the destination stack, then proceed to content mapping.',
    isComplete: (ctx) => !!ctx.destinationPersisted,
  },
  {
    id: 'content-mapping',
    routeSegment: 'content-mapping',
    trackerLabel: 'Content mapping',
    appBarTitle: 'Content mapping',
    actionLabel: 'Move to review',
    statusLine: 'Select content types, then map fields or pick entries inside each type.',
  },
  {
    id: 'preview',
    routeSegment: 'preview',
    trackerLabel: 'Preview',
    appBarTitle: 'Preview & run',
    actionLabel: 'Start migration',
    statusLine: 'Review the scope below, then run a test migration or start the real one.',
  },
  // Migrate and Verify: the design specifies no copy for these (Q-3, Q-4).
  { id: 'migrate', routeSegment: 'migrate', trackerLabel: 'Migrate' },
  { id: 'verify', routeSegment: 'verify', trackerLabel: 'Verify' },
];

export const stepByRouteSegment = (segment: string | undefined): WizardStep | undefined =>
  WIZARD_STEPS.find((s) => s.routeSegment === segment);

/** Resolves a step's footer status line, or undefined when none is specified. */
export const statusLineFor = (
  step: WizardStep | undefined,
  ctx: StepContext
): string | undefined => {
  if (!step?.statusLine) return undefined;
  return typeof step.statusLine === 'function' ? step.statusLine(ctx) : step.statusLine;
};

/**
 * Derived-with-positional-fallback completion (confirmed decision). A step that
 * defines `isComplete` is judged on its own persisted state; one that does not —
 * because it persists nothing yet — falls back to "earlier than the current step",
 * which is what feature.md FR-2.2 and the design both describe.
 */
export const isStepComplete = (
  index: number,
  activeIndex: number,
  ctx: StepContext
): boolean => {
  const step = WIZARD_STEPS[index];
  if (!step || index >= activeIndex) return false;
  return step.isComplete ? step.isComplete(ctx) : true;
};
