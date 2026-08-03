import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FC, ReactNode } from 'react';

/**
 * TDD — v3 WizardFooter. Backs TC_MWC_016 (composition), TC_MWC_018 / 019 (Back),
 * TC_MWC_020–024 (status lines incl. the Audit step's three variants),
 * TC_MWC_025 / 027 / 028 (the gated primary action), TC_MWC_035 / 036
 * (disabled-state explanation copy).
 * feature.md FR-3.1–3.6, FR-4.1–4.3, FR-5.1–5.4, AC-3.1, AC-3.3, AC-3.4,
 * AC-4.1, AC-4.2, AC-6.1–6.7, EC-2.
 */
import WizardFooter from '../../../../../v3/components/wizard/WizardFooter';
import {
  StepGateProvider,
  useRegisterStepGate,
  StepGate,
} from '../../../../../v3/components/wizard/StepGateContext';
import { WIZARD_STEPS } from '../../../../../v3/components/wizard/steps';

const stepIndexOf = (id: string) => WIZARD_STEPS.findIndex((s) => s.id === id);
const mockBack = vi.fn();
const mockAdvanced = vi.fn();

/** Registers a gate on mount, the way a real step panel does. */
const GateSeeder: FC<{ gate: StepGate; children?: ReactNode }> = ({ gate, children }) => {
  useRegisterStepGate(gate);
  return <>{children}</>;
};

const renderFooter = (opts: {
  stepId?: string;
  gate?: StepGate;
  stepContext?: Record<string, unknown>;
} = {}) => {
  const activeIndex = stepIndexOf(opts.stepId ?? 'destination');
  return render(
    <StepGateProvider onAdvanced={mockAdvanced}>
      {opts.gate ? <GateSeeder gate={opts.gate} /> : null}
      <WizardFooter
        activeIndex={activeIndex}
        isFirst={activeIndex === 0}
        onBack={mockBack}
        stepContext={opts.stepContext ?? {}}
      />
    </StepGateProvider>
  );
};

const action = () => screen.getByTestId('wizard-primary-action');
const backBtn = () => screen.getByRole('button', { name: 'Back' });

beforeEach(() => {
  mockBack.mockClear();
  mockAdvanced.mockClear();
});

describe('v3 WizardFooter — composition and Back', () => {
  it('TC_MWC_016 (positive): renders Back, a status line and the primary action in that order', () => {
    renderFooter({ gate: { satisfied: true } });
    const parts = screen.getByTestId('wizard-footer').querySelectorAll('[data-footer-part]');
    expect(Array.from(parts).map((p) => p.getAttribute('data-footer-part'))).toEqual([
      'back',
      'status',
      'action',
    ]);
  });

  // Negative — taxonomy #1 (missing input): a step with no specified status line still
  // renders Back and the action; the status slot is simply empty rather than the
  // footer collapsing or borrowing another step's text.
  it('TC_MWC_016 (negative): a step with no status line still renders Back and the action', () => {
    renderFooter({ stepId: 'migrate', gate: { satisfied: true } });
    expect(backBtn()).toBeInTheDocument();
    expect(action()).toBeInTheDocument();
    expect(screen.getByTestId('wizard-footer-status')).toHaveTextContent('');
  });

  it('TC_MWC_018 (positive): Back is present and disabled on the first step', () => {
    renderFooter({ stepId: 'source', gate: { satisfied: true } });
    expect(backBtn()).toBeInTheDocument();
    expect(backBtn()).toBeDisabled();
  });

  // Negative — taxonomy #4 (forbidden state): clicking the disabled Back must not
  // request navigation.
  it('TC_MWC_018 (negative): clicking Back on the first step requests no navigation', async () => {
    renderFooter({ stepId: 'source', gate: { satisfied: true } });
    await userEvent.click(backBtn());
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('TC_MWC_019 (positive): Back on a later step requests backward navigation', async () => {
    renderFooter({ stepId: 'destination', gate: { satisfied: true } });
    expect(backBtn()).not.toBeDisabled();
    await userEvent.click(backBtn());
    expect(mockBack).toHaveBeenCalledOnce();
  });

  // Negative — taxonomy #4 (forbidden state): Back must not trigger the advance path.
  it('TC_MWC_019 (negative): Back does not trigger the advance path', async () => {
    const advance = vi.fn().mockResolvedValue(true);
    renderFooter({ stepId: 'destination', gate: { satisfied: true, advance } });
    await userEvent.click(backBtn());
    expect(advance).not.toHaveBeenCalled();
    expect(mockAdvanced).not.toHaveBeenCalled();
  });
});

describe('v3 WizardFooter — status lines', () => {
  it('TC_MWC_020 (positive): the Source step shows its exact status line', () => {
    renderFooter({ stepId: 'source', gate: { satisfied: true } });
    expect(screen.getByTestId('wizard-footer-status')).toHaveTextContent(
      'Configure your source stack, then proceed to the audit.'
    );
  });

  // Negative — taxonomy #4 (forbidden state): the Source line must not appear on
  // another step — status lines are per-step, not a shared default.
  it('TC_MWC_020 (negative): the Source status line does not appear on the Destination step', () => {
    renderFooter({ stepId: 'destination', gate: { satisfied: true } });
    expect(screen.getByTestId('wizard-footer-status')).not.toHaveTextContent(
      'Configure your source stack, then proceed to the audit.'
    );
  });

  it('TC_MWC_021 (positive): the Destination step shows its exact status line', () => {
    renderFooter({ stepId: 'destination', gate: { satisfied: true } });
    expect(screen.getByTestId('wizard-footer-status')).toHaveTextContent(
      'Configure the destination stack, then proceed to content mapping.'
    );
  });

  it('TC_MWC_021 (negative): the Destination status line does not appear on the Source step', () => {
    renderFooter({ stepId: 'source', gate: { satisfied: true } });
    expect(screen.getByTestId('wizard-footer-status')).not.toHaveTextContent(
      'Configure the destination stack, then proceed to content mapping.'
    );
  });

  it('TC_MWC_022 (positive): the Audit step shows the generating line while the audit is not ready', () => {
    renderFooter({ stepId: 'audit', gate: { satisfied: false }, stepContext: { auditReady: false } });
    expect(screen.getByTestId('wizard-footer-status')).toHaveTextContent(
      'Generating audit — you can continue once it finishes'
    );
  });

  // Negative — taxonomy #4 (forbidden state): once ready, the generating line must be
  // gone — a stale "Generating…" would misreport a finished audit.
  it('TC_MWC_022 (negative): a ready audit no longer shows the generating line', () => {
    renderFooter({
      stepId: 'audit',
      gate: { satisfied: true },
      stepContext: { auditReady: true, excludedCount: 0, migratingCount: 480 },
    });
    expect(screen.getByTestId('wizard-footer-status')).not.toHaveTextContent('Generating audit');
  });

  it('TC_MWC_023 (positive): a ready audit with nothing excluded shows the nothing-excluded line', () => {
    renderFooter({
      stepId: 'audit',
      gate: { satisfied: true },
      stepContext: { auditReady: true, excludedCount: 0, migratingCount: 480 },
    });
    expect(screen.getByTestId('wizard-footer-status')).toHaveTextContent(
      'Audit complete — nothing excluded'
    );
  });

  // Negative — taxonomy #3 (boundary): one excluded item is not "nothing excluded" —
  // the zero case must not swallow small non-zero counts.
  it('TC_MWC_023 (negative): a single excluded item does not report "nothing excluded"', () => {
    renderFooter({
      stepId: 'audit',
      gate: { satisfied: true },
      stepContext: { auditReady: true, excludedCount: 1, migratingCount: 479 },
    });
    const status = screen.getByTestId('wizard-footer-status');
    expect(status).not.toHaveTextContent('nothing excluded');
    expect(status).toHaveTextContent('Audit complete — 1 excluded, 479 will migrate');
  });

  it('TC_MWC_024 (positive): a ready audit with exclusions reports both counts', () => {
    renderFooter({
      stepId: 'audit',
      gate: { satisfied: true },
      stepContext: { auditReady: true, excludedCount: 12, migratingCount: 480 },
    });
    expect(screen.getByTestId('wizard-footer-status')).toHaveTextContent(
      'Audit complete — 12 excluded, 480 will migrate'
    );
  });

  // Negative — taxonomy #2 (invalid shape): with the counts absent the line must not
  // render "undefined excluded"; it falls back to the not-ready wording.
  it('TC_MWC_024 (negative): missing audit counts never render "undefined" in the status line', () => {
    renderFooter({ stepId: 'audit', gate: { satisfied: false }, stepContext: {} });
    expect(screen.getByTestId('wizard-footer-status')).not.toHaveTextContent('undefined');
  });
});

describe('v3 WizardFooter — the gated primary action', () => {
  it('TC_MWC_025 (positive): a satisfied gate renders the action enabled with the step label', () => {
    renderFooter({ stepId: 'destination', gate: { satisfied: true } });
    expect(action()).toBeEnabled();
    expect(action()).toHaveTextContent('Proceed to content mapping');
  });

  // Negative — taxonomy #4 (forbidden state): the label is per step, so the same
  // satisfied gate on a different step must not show Destination's label.
  it('TC_MWC_025 (negative): the same satisfied gate on another step shows that step’s label', () => {
    renderFooter({ stepId: 'source', gate: { satisfied: true } });
    expect(action()).toHaveTextContent('Proceed to audit');
    expect(action()).not.toHaveTextContent('Proceed to content mapping');
  });

  it('TC_MWC_027 (positive): an unsatisfied gate renders the action disabled', () => {
    renderFooter({ stepId: 'destination', gate: { satisfied: false } });
    expect(action()).toBeDisabled();
  });

  // Negative — taxonomy #4 (forbidden state, contrast): flipping only the gate flips
  // only the enabled state, proving the disable is the gate and not the step.
  it('TC_MWC_027 (negative): the same step with a satisfied gate renders the action enabled', () => {
    renderFooter({ stepId: 'destination', gate: { satisfied: true } });
    expect(action()).toBeEnabled();
  });

  it('TC_MWC_028 (positive): clicking the disabled action starts no advance work', async () => {
    const advance = vi.fn().mockResolvedValue(true);
    renderFooter({ stepId: 'destination', gate: { satisfied: false, advance } });
    await userEvent.click(action());
    expect(advance).not.toHaveBeenCalled();
    expect(mockAdvanced).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #4 (forbidden state, contrast): the same click with the gate
  // satisfied does reach the advance work.
  it('TC_MWC_028 (negative): the same click with a satisfied gate does start the advance work', async () => {
    const advance = vi.fn().mockResolvedValue(true);
    renderFooter({ stepId: 'destination', gate: { satisfied: true, advance } });
    await userEvent.click(action());
    expect(advance).toHaveBeenCalledOnce();
  });

  it('TC_MWC_035 (positive): the Source step’s disabled action carries its exact explanation', () => {
    renderFooter({ stepId: 'source', gate: { satisfied: false } });
    expect(action()).toHaveAttribute('title', 'Review your source, then proceed to the audit');
  });

  // Negative — taxonomy #4 (forbidden state): an enabled action carries no
  // explanation — a lingering "what's missing" tooltip on a usable control is wrong.
  it('TC_MWC_035 (negative): an enabled action carries no missing-requirement explanation', () => {
    renderFooter({ stepId: 'source', gate: { satisfied: true } });
    expect(action()).not.toHaveAttribute('title', 'Review your source, then proceed to the audit');
  });

  it('TC_MWC_036 (positive): the Audit step’s disabled action carries its exact explanation', () => {
    renderFooter({ stepId: 'audit', gate: { satisfied: false }, stepContext: { auditReady: false } });
    expect(action()).toHaveAttribute('title', 'Finish the audit to continue');
  });

  // Negative — taxonomy #1 (missing input): a panel-supplied reason takes precedence
  // over the step's generic explanation, so the user sees the specific cause.
  it('TC_MWC_036 (negative): a panel-supplied blocked reason overrides the step’s generic explanation', () => {
    renderFooter({
      stepId: 'audit',
      gate: { satisfied: false, blockedReason: 'Prepare the source first to continue.' },
      stepContext: { auditReady: false },
    });
    expect(action()).toHaveAttribute('title', 'Prepare the source first to continue.');
  });
});
