import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * TDD — v3 WizardStepTracker. Backs TC_MWC_008 (step list), TC_MWC_009–011
 * (complete / active / upcoming states), TC_MWC_013–015 (interactivity).
 * feature.md FR-2.1–2.7, AC-1.2–1.5, AC-5.1–5.3, EC-4.
 *
 * Completion is supplied to the tracker as a predicate, per the confirmed
 * "derived where a step has a completeness test, positional otherwise" rule —
 * so the tracker is tested for RENDERING, and the rule itself is tested where
 * it lives (see WizardChrome tests).
 */
import WizardStepTracker from '../../../../../v3/components/wizard/WizardStepTracker';
import { WIZARD_STEPS } from '../../../../../v3/components/wizard/steps';

const stepIndexOf = (id: string) => WIZARD_STEPS.findIndex((s) => s.id === id);
const mockSelect = vi.fn();

const renderTracker = (
  activeIndex = stepIndexOf('destination'),
  isComplete: (i: number) => boolean = (i) => i < activeIndex
) =>
  render(
    <WizardStepTracker activeIndex={activeIndex} isComplete={isComplete} onSelect={mockSelect} />
  );

const stepEl = (label: string) => screen.getByTestId(`wizard-step-${label}`);

beforeEach(() => mockSelect.mockClear());

describe('v3 WizardStepTracker — rendering', () => {
  it('TC_MWC_008 (positive): renders exactly the seven steps in the specified order', () => {
    renderTracker();
    expect(
      screen.getAllByTestId(/^wizard-step-/).map((el) => el.getAttribute('data-label'))
    ).toEqual([
      'Source',
      'Audit',
      'Destination',
      'Content mapping',
      'Preview',
      'Migrate',
      'Verify',
    ]);
  });

  // Negative — taxonomy #3 (boundary): exactly seven, never a truncated or padded
  // list — the "of 7" in the app bar and this tracker must agree.
  it('TC_MWC_008 (negative): renders no more and no fewer than seven steps', () => {
    renderTracker();
    expect(screen.getAllByTestId(/^wizard-step-/)).toHaveLength(7);
  });

  it('TC_MWC_009 (positive): on Destination, earlier steps are complete, it is active, later steps are upcoming', () => {
    renderTracker(stepIndexOf('destination'));
    expect(stepEl('Source')).toHaveAttribute('data-state', 'complete');
    expect(stepEl('Audit')).toHaveAttribute('data-state', 'complete');
    expect(stepEl('Destination')).toHaveAttribute('data-state', 'active');
    for (const l of ['Content mapping', 'Preview', 'Migrate', 'Verify']) {
      expect(stepEl(l)).toHaveAttribute('data-state', 'upcoming');
    }
  });

  // Negative — taxonomy #4 (forbidden state): a complete step shows a check INSTEAD OF
  // its number, and an upcoming step shows its number — swapping these is the defect
  // this guards (FR-2.2, FR-2.4).
  it('TC_MWC_009 (negative): complete steps show a check not a number, upcoming show a number not a check', () => {
    renderTracker(stepIndexOf('destination'));
    expect(stepEl('Source')).toHaveTextContent('✓');
    expect(stepEl('Source')).not.toHaveTextContent('1');
    expect(stepEl('Preview')).toHaveTextContent('5');
    expect(stepEl('Preview')).not.toHaveTextContent('✓');
  });

  it('TC_MWC_010 (positive): on the first step nothing is marked complete', () => {
    renderTracker(stepIndexOf('source'));
    expect(
      screen.getAllByTestId(/^wizard-step-/).filter((el) => el.getAttribute('data-state') === 'complete')
    ).toHaveLength(0);
    expect(stepEl('Source')).toHaveAttribute('data-state', 'active');
  });

  // Negative — taxonomy #4 (forbidden state): the first step is active, never marked
  // complete while the user is standing on it.
  it('TC_MWC_010 (negative): the current first step is not itself marked complete', () => {
    renderTracker(stepIndexOf('source'));
    expect(stepEl('Source')).not.toHaveAttribute('data-state', 'complete');
  });

  it('TC_MWC_011 (positive): on the last step all six earlier steps are complete', () => {
    renderTracker(stepIndexOf('verify'));
    expect(
      screen.getAllByTestId(/^wizard-step-/).filter((el) => el.getAttribute('data-state') === 'complete')
    ).toHaveLength(6);
  });

  // Negative — taxonomy #4 (forbidden state): on the last step nothing is upcoming,
  // and the last step itself is active rather than complete.
  it('TC_MWC_011 (negative): on the last step nothing is upcoming and the last step is active', () => {
    renderTracker(stepIndexOf('verify'));
    expect(
      screen.getAllByTestId(/^wizard-step-/).filter((el) => el.getAttribute('data-state') === 'upcoming')
    ).toHaveLength(0);
    expect(stepEl('Verify')).toHaveAttribute('data-state', 'active');
  });
});

describe('v3 WizardStepTracker — interactivity', () => {
  it('TC_MWC_013 (positive): clicking a completed step asks to navigate to it', async () => {
    renderTracker(stepIndexOf('destination'));
    await userEvent.click(stepEl('Source'));
    expect(mockSelect).toHaveBeenCalledWith(stepIndexOf('source'));
  });

  // Negative — taxonomy #4 (forbidden state): a step that is NOT complete (its
  // predicate says so) is not navigable even though it sits before the current one.
  it('TC_MWC_013 (negative): a step that is not complete is not navigable', async () => {
    // Only Source is complete; Audit is not, despite preceding Destination.
    renderTracker(stepIndexOf('destination'), (i) => i === stepIndexOf('source'));
    await userEvent.click(stepEl('Audit'));
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('TC_MWC_014 (positive): clicking an upcoming step does nothing', async () => {
    renderTracker(stepIndexOf('destination'));
    await userEvent.click(stepEl('Preview'));
    expect(mockSelect).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #4 (forbidden state): upcoming steps must not even be exposed
  // as interactive, so keyboard users cannot reach them either (FR-2.5).
  it('TC_MWC_014 (negative): upcoming steps are not exposed as interactive controls', () => {
    renderTracker(stepIndexOf('destination'));
    expect(stepEl('Preview')).toHaveAttribute('aria-disabled', 'true');
    expect(stepEl('Preview')).not.toHaveAttribute('tabindex', '0');
  });

  it('TC_MWC_015 (positive): clicking the current step does not request navigation', async () => {
    renderTracker(stepIndexOf('destination'));
    await userEvent.click(stepEl('Destination'));
    expect(mockSelect).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #4 (forbidden state, contrast): the current step is still
  // interactive per FR-2.5 — it just resolves to a no-op, unlike upcoming steps which
  // are disabled outright.
  it('TC_MWC_015 (negative): the current step is interactive, unlike an upcoming one', () => {
    renderTracker(stepIndexOf('destination'));
    expect(stepEl('Destination')).not.toHaveAttribute('aria-disabled', 'true');
    expect(stepEl('Preview')).toHaveAttribute('aria-disabled', 'true');
  });
});
