import { describe, it, expect } from 'vitest';

/**
 * TDD — v3 wizard step list (the single data-driven definition of the seven
 * steps and their copy). Backs TC_MWC_040 (primary-action labels),
 * TC_MWC_041 (app-bar titles), TC_MWC_042 / TC_MWC_043 (footer status lines).
 * feature.md FR-2.1, FR-5.1, FR-5.2, FR-5.5.
 */
import {
  WIZARD_STEPS,
  stepByRouteSegment,
  statusLineFor,
} from '../../../../../v3/components/wizard/steps';

const byId = (id: string) => WIZARD_STEPS.find((s) => s.id === id)!;

describe('v3 wizard steps — order', () => {
  it('TC_MWC_040 (positive): each specified step carries its exact primary-action label', () => {
    expect(byId('source').actionLabel).toBe('Proceed to audit');
    // Corrected 2026-08-04 alongside feature.md FR-5.1: the previous string
    // named the step after Destination and so skipped one.
    expect(byId('audit').actionLabel).toBe('Continue to Destination');
    expect(byId('destination').actionLabel).toBe('Proceed to content mapping');
    /*
      Changed 2026-08-10 by cs-content-type-selection FR-8.4, which specifies this
      step's primary action as "Move to review" and is the newer spec for it. The
      string lives in this feature's step definition, so the change lands here —
      flagged in that feature's prd.md §9 and recorded in its tdd.md report. Not a
      relaxation: the assertion is still exact, against the superseding value.
    */
    expect(byId('content-mapping').actionLabel).toBe('Move to review');
    expect(byId('preview').actionLabel).toBe('Start migration');
  });

  // Negative — taxonomy #1 (missing input): the design specifies no label for Migrate
  // or Verify (feature.md Q-3). They must be left explicitly unset rather than given
  // an invented string, so the gap stays visible instead of shipping fabricated copy.
  it('TC_MWC_040 (negative): steps with no design copy have no invented action label', () => {
    expect(byId('migrate').actionLabel).toBeUndefined();
    expect(byId('verify').actionLabel).toBeUndefined();
  });

  it('TC_MWC_041 (positive): each specified step carries its exact app-bar title', () => {
    expect(byId('audit').appBarTitle).toBe('Audit report');
    expect(byId('content-mapping').appBarTitle).toBe('Content mapping');
    expect(byId('preview').appBarTitle).toBe('Preview & run');
  });

  // Negative — taxonomy #1 (missing input): four titles are undecided (feature.md Q-4)
  // and the spec warns they are NOT simply the tracker labels — so they must not be
  // defaulted to the tracker label, which would silently invent copy.
  it('TC_MWC_041 (negative): steps with no design title are unset, not defaulted to the tracker label', () => {
    for (const id of ['source', 'destination', 'migrate', 'verify']) {
      expect(byId(id).appBarTitle).toBeUndefined();
    }
  });

  it('TC_MWC_042 (positive): the Content mapping step carries its exact footer status line', () => {
    expect(statusLineFor(byId('content-mapping'), {})).toBe(
      'Select content types, then map fields or pick entries inside each type.'
    );
  });

  // Negative — taxonomy #1 (missing input): Migrate and Verify have no specified
  // status line (feature.md Q-3); the resolver must return undefined rather than
  // fabricate one or leak another step's text.
  it('TC_MWC_042 (negative): a step with no specified status line resolves to undefined', () => {
    expect(statusLineFor(byId('migrate'), {})).toBeUndefined();
    expect(statusLineFor(byId('verify'), {})).toBeUndefined();
  });

  it('TC_MWC_043 (positive): the Preview step carries its exact footer status line', () => {
    expect(statusLineFor(byId('preview'), {})).toBe(
      'Review the scope below, then run a test migration or start the real one.'
    );
  });

  // Negative — taxonomy #2 (invalid input): an unknown route segment must not resolve
  // to a step, otherwise the chrome would silently render the wrong step's copy.
  it('TC_MWC_043 (negative): an unknown route segment resolves to no step', () => {
    expect(stepByRouteSegment('not-a-real-step')).toBeUndefined();
    expect(WIZARD_STEPS.map((s) => s.trackerLabel)).toEqual([
      'Source',
      'Audit',
      'Destination',
      'Content mapping',
      'Preview',
      'Migrate',
      'Verify',
    ]);
  });
});
