import { CSSProperties, FC } from 'react';

import type { AuditImpactView } from '../../utils/auditDecisions';

/**
 * The live impact panel (cs-audit-report FR-3.1 … FR-3.7).
 *
 * Every figure is derived on each render from the working decision set — never stored —
 * so the four values cannot fall out of step with one another (FR-3.7).
 *
 * The progress bar carries `aria-valuenow`, not only a CSS width. The migrating
 * proportion is this panel's headline claim, and a bar whose only representation is width
 * is invisible to a screen reader (NFR-8).
 *
 * Styling uses the reference design's own values expressed through this project's tokens,
 * which are a byte-for-byte match of the design system's — so the violet gradient, the
 * radius and the brand shadow are the design's, as `var(--…)` rather than hardcoded hex.
 * Inline styles rather than classes because that is what the Source and Destination
 * panels already do (36 and 39 style objects respectively); a stylesheet here would be a
 * second convention.
 */
const wrap: CSSProperties = {
  background: 'linear-gradient(135deg, var(--violet-700), var(--violet-500))',
  borderRadius: 'var(--radius-xl)',
  padding: '20px 24px',
  color: '#fff',
  boxShadow: 'var(--shadow-brand)',
  marginBottom: 18,
  display: 'flex',
  alignItems: 'center',
  gap: 30,
  flexWrap: 'wrap',
};

const eyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '.07em',
  textTransform: 'uppercase',
  opacity: 0.82,
};

const AuditImpact: FC<{ impact: AuditImpactView }> = ({ impact }) => {
  const { denominator, excluded, migrating, percent } = impact;
  return (
    <section style={wrap} aria-label="Ready to migrate">
      <div style={{ flex: 'none' }}>
        <p style={eyebrow}>Ready to migrate</p>
        <p style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginTop: 6 }}>
          <span
            style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-.02em', lineHeight: 1 }}
          >
            {migrating}
          </span>
          {/*
            lineHeight 1 matters here. Both spans sit on a shared baseline, so the row's
            height is the tallest ascent plus the tallest descent — and this span
            inheriting the body's 1.5 added ~30px of dead space below the number inside a
            card whose padding is fixed at the design's 20/24.
          */}
          <span style={{ fontSize: 13, lineHeight: 1, opacity: 0.9 }}>
            of {denominator} items
          </span>
        </p>
      </div>
      <div style={{ flex: 1, minWidth: 230 }}>
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Proportion of items that will migrate"
          style={{
            height: 8,
            borderRadius: 5,
            background: 'rgba(255,255,255,.25)',
            overflow: 'hidden',
          }}
        >
          <span
            style={{
              display: 'block',
              width: `${percent}%`,
              height: '100%',
              background: '#fff',
              transition: 'width var(--dur-slow) var(--ease-standard)',
            }}
          />
        </div>
        <p style={{ fontSize: 12.5, marginTop: 9, opacity: 0.95 }}>
          {excluded === 0
            ? 'Nothing excluded yet — everything migrates unless you skip it.'
            : `${excluded} ${excluded === 1 ? 'item' : 'items'} excluded and will not be migrated.`}
        </p>
      </div>
    </section>
  );
};

export default AuditImpact;
