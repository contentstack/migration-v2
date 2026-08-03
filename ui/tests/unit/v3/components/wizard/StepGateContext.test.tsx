import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FC, ReactNode } from 'react';

/**
 * TDD — v3 StepGateContext: the contract by which a step panel publishes its
 * gate and its advance work, and the orchestration the chrome performs around
 * it. Backs TC_MWC_026 (advance succeeds → advance), TC_MWC_029 / 030 (failure
 * and rejection block the advance), TC_MWC_031 (re-entrancy), TC_MWC_032 (no
 * registration ⇒ satisfied), TC_MWC_033 (satisfied with no advance work),
 * TC_MWC_037 / 038 (a footer action and an in-panel action share one gate and
 * one action), TC_MWC_039 (the gate cannot be bypassed).
 * feature.md FR-4.4–4.6, FR-6.4, FR-6.5, AC-3.2, AC-3.5–3.7, EC-3, EC-11.
 */
import {
  StepGateProvider,
  useRegisterStepGate,
  useStepGate,
  StepGate,
} from '../../../../../v3/components/wizard/StepGateContext';

const mockAdvanced = vi.fn();

const GateSeeder: FC<{ gate: StepGate }> = ({ gate }) => {
  useRegisterStepGate(gate);
  return null;
};

/** Stands in for any control that advances — the footer's action or a panel's own. */
const AdvanceButton: FC<{ label: string }> = ({ label }) => {
  const { gate, runAdvance, advancing } = useStepGate();
  return (
    <button
      type="button"
      data-testid={label}
      disabled={!gate.satisfied || advancing}
      onClick={() => runAdvance()}
    >
      {label}
    </button>
  );
};

const renderGate = (gate: StepGate | null, extra?: ReactNode) =>
  render(
    <StepGateProvider onAdvanced={mockAdvanced}>
      {gate ? <GateSeeder gate={gate} /> : null}
      <AdvanceButton label="footer-action" />
      {extra}
    </StepGateProvider>
  );

beforeEach(() => mockAdvanced.mockClear());

describe('v3 StepGateContext — advancing', () => {
  it('TC_MWC_026 (positive): a successful advance reports that the wizard may move on', async () => {
    const advance = vi.fn().mockResolvedValue(true);
    renderGate({ satisfied: true, advance });

    await userEvent.click(screen.getByTestId('footer-action'));

    expect(advance).toHaveBeenCalledOnce();
    expect(mockAdvanced).toHaveBeenCalledOnce();
  });

  // Negative — taxonomy #6 (dependency failure): the panel's work resolving false must
  // not advance the wizard (AC-3.5, EC-3).
  it('TC_MWC_026 (negative): advance work resolving false does not move the wizard on', async () => {
    const advance = vi.fn().mockResolvedValue(false);
    renderGate({ satisfied: true, advance });

    await userEvent.click(screen.getByTestId('footer-action'));

    expect(advance).toHaveBeenCalledOnce();
    expect(mockAdvanced).not.toHaveBeenCalled();
  });

  it('TC_MWC_029 (positive): failing advance work leaves the wizard on the current step', async () => {
    const advance = vi.fn().mockResolvedValue(false);
    renderGate({ satisfied: true, advance });

    await userEvent.click(screen.getByTestId('footer-action'));

    expect(mockAdvanced).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #6 (dependency failure, contrast): the same path succeeding
  // does advance, so the block above is the failure and not a broken advance path.
  it('TC_MWC_029 (negative): the same path succeeding does move the wizard on', async () => {
    const advance = vi.fn().mockResolvedValue(true);
    renderGate({ satisfied: true, advance });

    await userEvent.click(screen.getByTestId('footer-action'));

    expect(mockAdvanced).toHaveBeenCalledOnce();
  });

  it('TC_MWC_030 (positive): advance work that rejects is treated as failure, not a crash', async () => {
    const advance = vi.fn().mockRejectedValue(new Error('token creation failed'));
    renderGate({ satisfied: true, advance });

    await userEvent.click(screen.getByTestId('footer-action'));

    expect(mockAdvanced).not.toHaveBeenCalled();
    // The control recovers rather than being left permanently mid-flight.
    expect(screen.getByTestId('footer-action')).toBeEnabled();
  });

  // Negative — taxonomy #6 (dependency failure): a rejection must not be swallowed
  // into a *successful* advance — the wizard must never move on after an error.
  it('TC_MWC_030 (negative): a rejection never results in the wizard moving on', async () => {
    const advance = vi.fn().mockRejectedValue(new Error('boom'));
    renderGate({ satisfied: true, advance });

    await userEvent.click(screen.getByTestId('footer-action'));

    expect(advance).toHaveBeenCalledOnce();
    expect(mockAdvanced).not.toHaveBeenCalled();
  });

  it('TC_MWC_031 (positive): a second click while advance work is in flight does not re-run it', async () => {
    let release: (v: boolean) => void = () => {};
    const advance = vi.fn(() => new Promise<boolean>((res) => { release = res; }));
    renderGate({ satisfied: true, advance });

    await userEvent.click(screen.getByTestId('footer-action'));
    await userEvent.click(screen.getByTestId('footer-action'));

    expect(advance).toHaveBeenCalledOnce();
    release(true);
  });

  // Negative — taxonomy #4 (forbidden state): once the work settles the control is
  // usable again — the guard must not latch permanently.
  it('TC_MWC_031 (negative): the guard clears once the advance work settles', async () => {
    const advance = vi.fn().mockResolvedValue(false);
    renderGate({ satisfied: true, advance });

    await userEvent.click(screen.getByTestId('footer-action'));
    expect(screen.getByTestId('footer-action')).toBeEnabled();

    await userEvent.click(screen.getByTestId('footer-action'));
    expect(advance).toHaveBeenCalledTimes(2);
  });
});

describe('v3 StepGateContext — registration', () => {
  it('TC_MWC_032 (positive): with no gate registered the step is treated as satisfied', () => {
    renderGate(null);
    expect(screen.getByTestId('footer-action')).toBeEnabled();
  });

  // Negative — taxonomy #4 (forbidden state): an explicitly unsatisfied registration
  // is respected, so the default is a genuine default and not a hardcoded true.
  it('TC_MWC_032 (negative): an explicitly unsatisfied registration is respected', () => {
    renderGate({ satisfied: false });
    expect(screen.getByTestId('footer-action')).toBeDisabled();
  });

  it('TC_MWC_033 (positive): a satisfied gate with no advance work still moves the wizard on', async () => {
    renderGate({ satisfied: true });

    await userEvent.click(screen.getByTestId('footer-action'));

    expect(mockAdvanced).toHaveBeenCalledOnce();
  });

  // Negative — taxonomy #4 (forbidden state): when advance work IS supplied it must be
  // run, not skipped — so the no-work shortcut cannot bypass a panel's real work.
  it('TC_MWC_033 (negative): supplied advance work is never skipped', async () => {
    const advance = vi.fn().mockResolvedValue(true);
    renderGate({ satisfied: true, advance });

    await userEvent.click(screen.getByTestId('footer-action'));

    expect(advance).toHaveBeenCalledOnce();
  });
});

describe('v3 StepGateContext — one gate shared by every advance control', () => {
  it('TC_MWC_037 (positive): a footer action and an in-panel action share one gate state', () => {
    renderGate({ satisfied: false }, <AdvanceButton label="panel-action" />);

    expect(screen.getByTestId('footer-action')).toBeDisabled();
    expect(screen.getByTestId('panel-action')).toBeDisabled();
  });

  // Negative — taxonomy #4 (forbidden state): they must agree when satisfied too —
  // the two controls can never show different enabled states (FR-4.5).
  it('TC_MWC_037 (negative): both controls are enabled together when the gate is satisfied', () => {
    renderGate({ satisfied: true }, <AdvanceButton label="panel-action" />);

    expect(screen.getByTestId('footer-action')).toBeEnabled();
    expect(screen.getByTestId('panel-action')).toBeEnabled();
  });

  it('TC_MWC_038 (positive): triggering the in-panel action runs the same advance work', async () => {
    const advance = vi.fn().mockResolvedValue(true);
    renderGate({ satisfied: true, advance }, <AdvanceButton label="panel-action" />);

    await userEvent.click(screen.getByTestId('panel-action'));

    expect(advance).toHaveBeenCalledOnce();
    expect(mockAdvanced).toHaveBeenCalledOnce();
  });

  // Negative — taxonomy #4 (forbidden state): the re-entrancy guard is shared, so
  // using one control then the other cannot run the work twice.
  it('TC_MWC_038 (negative): the two controls cannot run the advance work twice concurrently', async () => {
    let release: (v: boolean) => void = () => {};
    const advance = vi.fn(() => new Promise<boolean>((res) => { release = res; }));
    renderGate({ satisfied: true, advance }, <AdvanceButton label="panel-action" />);

    await userEvent.click(screen.getByTestId('footer-action'));
    await userEvent.click(screen.getByTestId('panel-action'));

    expect(advance).toHaveBeenCalledOnce();
    release(true);
  });

  it('TC_MWC_039 (positive): an unsatisfied gate cannot be advanced past by any control', async () => {
    const advance = vi.fn().mockResolvedValue(true);
    renderGate({ satisfied: false, advance }, <AdvanceButton label="panel-action" />);

    await userEvent.click(screen.getByTestId('footer-action'));
    await userEvent.click(screen.getByTestId('panel-action'));

    expect(advance).not.toHaveBeenCalled();
    expect(mockAdvanced).not.toHaveBeenCalled();
  });

  // Negative — taxonomy #5 (permission denial): calling the orchestrator directly,
  // bypassing the disabled controls, is still refused — the guard is in the
  // orchestration, not merely in the button's disabled attribute.
  it('TC_MWC_039 (negative): invoking the advance orchestrator directly is still refused', async () => {
    const advance = vi.fn().mockResolvedValue(true);
    const Direct: FC = () => {
      const { runAdvance } = useStepGate();
      return <button type="button" data-testid="direct" onClick={() => runAdvance()}>direct</button>;
    };
    renderGate({ satisfied: false, advance }, <Direct />);

    await userEvent.click(screen.getByTestId('direct'));

    expect(advance).not.toHaveBeenCalled();
    expect(mockAdvanced).not.toHaveBeenCalled();
  });
});
