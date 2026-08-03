import { FC } from 'react';

import { StepContext, statusLineFor, WIZARD_STEPS } from './steps';
import { useStepGate } from './StepGateContext';

/**
 * The persistent wizard footer (feature.md FR-3.1–3.6, FR-4.1–4.3).
 *
 * Three parts in a fixed order — Back, the step's status line, the gated
 * primary action. The footer owns none of the advance logic: it reads the gate
 * and calls the shared orchestrator, so it can never disagree with an in-panel
 * advance control (FR-4.5).
 */
const WizardFooter: FC<{
  activeIndex: number;
  isFirst: boolean;
  onBack: () => void;
  stepContext: StepContext;
}> = ({ activeIndex, isFirst, onBack, stepContext }) => {
  const step = WIZARD_STEPS[activeIndex];
  const { gate, runAdvance, advancing } = useStepGate();

  const status = statusLineFor(step, stepContext);
  const disabled = !gate.satisfied || advancing;
  // A panel-supplied reason is more specific than the step's generic copy, so it
  // wins. An enabled action carries no explanation at all (AC-6.7).
  const explanation = gate.satisfied
    ? undefined
    : (gate.blockedReason ?? step?.blockedExplanation);

  return (
    <div
      data-testid="wizard-footer"
      data-chrome-region="footer"
      style={{
        position: 'sticky',
        bottom: 0,
        background: 'var(--surface-card)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <button
          type="button"
          data-footer-part="back"
          className="v3-btn"
          disabled={isFirst}
          onClick={onBack}
          style={{
            background: 'var(--surface-card)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-body)',
            fontSize: 13,
            fontWeight: 700,
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            cursor: isFirst ? 'not-allowed' : 'pointer',
            opacity: isFirst ? 0.5 : 1,
          }}
        >
          Back
        </button>

        <span
          data-footer-part="status"
          data-testid="wizard-footer-status"
          style={{ fontSize: 12.5, color: 'var(--text-muted)', flex: 1, minWidth: 0 }}
        >
          {status}
        </span>

        <button
          type="button"
          data-footer-part="action"
          data-testid="wizard-primary-action"
          disabled={disabled}
          title={explanation}
          onClick={() => runAdvance()}
          style={{
            background: disabled ? 'var(--surface-sunken)' : 'var(--brand-strong)',
            border: '1px solid transparent',
            color: disabled ? 'var(--text-subtle)' : 'var(--text-on-brand)',
            fontSize: 13,
            fontWeight: 700,
            padding: '8px 18px',
            borderRadius: 'var(--radius-md)',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {/*
            Migrate and Verify have no action label in the design (feature.md
            Q-3). "Continue" is a neutral placeholder so the control is never
            unlabelled — flagged in the report, not treated as final copy.
          */}
          {advancing ? 'Working…' : (step?.actionLabel ?? 'Continue')}
        </button>
      </div>
    </div>
  );
};

export default WizardFooter;
