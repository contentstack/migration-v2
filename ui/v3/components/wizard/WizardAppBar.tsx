import { FC } from 'react';

import { WIZARD_STEPS } from './steps';

/**
 * Wizard app bar (feature.md FR-1.1–1.6): product mark and title, the current
 * position as "Step n of 7 · {title}", and the source indicator.
 *
 * The step title is omitted for the four steps whose title the design does not
 * specify (feature.md Q-4) — the position prefix still renders, rather than
 * inventing a title or falling back to the tracker label, which the spec
 * explicitly warns is not the same thing.
 */
const WizardAppBar: FC<{ activeIndex: number; sourceName?: string }> = ({
  activeIndex,
  sourceName,
}) => {
  const step = WIZARD_STEPS[activeIndex];
  const title = step?.appBarTitle;
  const hasSource = !!sourceName && sourceName.trim() !== '';

  return (
    <div
      data-testid="wizard-appbar"
      data-chrome-region="appbar"
      style={{ background: 'var(--surface-card)', borderBottom: '1px solid var(--border-subtle)' }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '13px 24px',
        }}
      >
        <div
          data-testid="wizard-product-mark"
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: 'var(--brand-strong)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </div>

        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-strong)' }}>
          Migrate to Contentstack
        </span>

        <span
          data-testid="wizard-step-position"
          style={{ fontSize: 12, color: 'var(--text-muted)' }}
        >
          {`Step ${activeIndex + 1} of ${WIZARD_STEPS.length}${title ? ` · ${title}` : ''}`}
        </span>

        <span
          data-testid="wizard-source-indicator"
          style={{
            marginLeft: 'auto',
            fontSize: 12,
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: hasSource ? 'var(--success)' : 'var(--text-subtle)',
              flex: 'none',
            }}
          />
          {hasSource ? (
            <>
              Source:{' '}
              <strong
                data-testid="wizard-source-name"
                style={{
                  color: 'var(--text-body)',
                  fontWeight: 700,
                  // Truncation is visual only — the full name stays in the DOM so
                  // it remains selectable and copyable (feature.md FR-1.6).
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minWidth: 0,
                }}
              >
                {sourceName}
              </strong>{' '}
              (Contentstack)
            </>
          ) : (
            <>
              Source: <strong style={{ color: 'var(--text-body)', fontWeight: 700 }}>Not selected</strong>
            </>
          )}
        </span>
      </div>
    </div>
  );
};

export default WizardAppBar;
