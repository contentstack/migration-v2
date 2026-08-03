import { FC, KeyboardEvent } from 'react';

import { WIZARD_STEPS } from './steps';

type StepState = 'complete' | 'active' | 'upcoming';

/**
 * The seven-step tracker (feature.md FR-2.1–2.7).
 *
 * Completion is injected as a predicate rather than computed here: the rule is
 * "derived where the step has a completeness test, positional otherwise", and
 * it belongs with the chrome that knows each step's persisted state. The
 * tracker only renders what it is told.
 */
const WizardStepTracker: FC<{
  activeIndex: number;
  isComplete: (index: number) => boolean;
  onSelect: (index: number) => void;
}> = ({ activeIndex, isComplete, onSelect }) => {
  const stateOf = (i: number): StepState => {
    if (i === activeIndex) return 'active';
    return isComplete(i) ? 'complete' : 'upcoming';
  };

  return (
    <div
      data-testid="wizard-tracker"
      data-chrome-region="tracker"
      style={{ background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}
    >
      <ol
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          listStyle: 'none',
        }}
      >
        {WIZARD_STEPS.map((step, i) => {
          const state = stateOf(i);
          const navigable = state !== 'upcoming';
          const activate = () => {
            // The current step is interactive but resolves to a no-op (FR-2.5):
            // re-selecting where you already are must not re-navigate.
            if (state === 'complete') onSelect(i);
          };

          return (
            <li key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                data-testid={`wizard-step-${step.trackerLabel}`}
                data-label={step.trackerLabel}
                data-state={state}
                role="button"
                aria-current={state === 'active' ? 'step' : undefined}
                aria-disabled={state === 'upcoming' ? 'true' : undefined}
                tabIndex={navigable ? 0 : -1}
                onClick={navigable ? activate : undefined}
                onKeyDown={
                  navigable
                    ? (e: KeyboardEvent<HTMLSpanElement>) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          activate();
                        }
                      }
                    : undefined
                }
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  padding: '5px 11px 5px 6px',
                  borderRadius: 'var(--radius-pill)',
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  cursor: state === 'complete' ? 'pointer' : 'default',
                  background: state === 'active' ? 'var(--brand-surface)' : 'transparent',
                  color:
                    state === 'active'
                      ? 'var(--brand-strong)'
                      : state === 'complete'
                        ? 'var(--text-body)'
                        : 'var(--text-subtle)',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 800,
                    flex: 'none',
                    background:
                      state === 'complete'
                        ? 'var(--success)'
                        : state === 'active'
                          ? 'var(--brand-strong)'
                          : 'var(--surface-sunken)',
                    color:
                      state === 'upcoming' ? 'var(--text-subtle)' : 'var(--text-on-brand)',
                  }}
                >
                  {/* A complete step shows a check INSTEAD OF its number (FR-2.2). */}
                  {state === 'complete' ? '✓' : i + 1}
                </span>
                {step.trackerLabel}
              </span>

              {i < WIZARD_STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  style={{ width: 14, height: 1, background: 'var(--border-subtle)' }}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default WizardStepTracker;
