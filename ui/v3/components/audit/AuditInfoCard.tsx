import { CSSProperties, FC } from 'react';

import type { AuditCategory, AuditCheckState } from '../../store/slice/audit.slice';

/**
 * A "Just so you know" card — one of the two categories that always migrate
 * (cs-audit-report FR-5.1 … FR-5.4, A-4).
 *
 * Exposes NO control of any kind. FR-5.2 states that as a prohibition rather than a
 * default, so the absence of a switch, a checkbox and a button is the contract.
 *
 * The pill is chosen on the check's STATE, never on `count === 0`. That branch is the
 * natural implementation and it is wrong: `count` is absent for a check that did not run,
 * so `undefined === 0` is false, the branch falls through, and a reassuring "All clean"
 * appears on a check nobody performed — G-3's exact failure mode (FR-2.11).
 */
const card: CSSProperties = {
  background: 'var(--surface-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-lg)',
  padding: '13px 15px',
  display: 'flex',
  alignItems: 'center',
  gap: 12,
};

const iconTile = (state: AuditCheckState, clean: boolean): CSSProperties => ({
  width: 34,
  height: 34,
  borderRadius: 9,
  flex: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 15,
  background:
    state !== 'done'
      ? 'var(--warning-surface)'
      : clean
      ? 'var(--success-surface)'
      : 'var(--surface-sunken)',
  color:
    state !== 'done' ? 'var(--warning)' : clean ? 'var(--success)' : 'var(--text-body)',
});

/** Pill colouring mirrors its meaning: reassurance is green, a caveat is amber. */
const pillStyle = (state: AuditCheckState, clean: boolean): CSSProperties => ({
  fontSize: 10.5,
  fontWeight: 700,
  borderRadius: 'var(--radius-pill)',
  padding: '3px 10px',
  whiteSpace: 'nowrap',
  flex: 'none',
  background:
    state !== 'done'
      ? 'var(--warning-surface)'
      : clean
      ? 'var(--success-surface)'
      : 'var(--surface-inset)',
  color:
    state !== 'done' ? 'var(--warning)' : clean ? 'var(--success)' : 'var(--text-body)',
});

const AuditInfoCard: FC<{
  id: AuditCategory;
  title: string;
  state: AuditCheckState;
  count?: number;
  guidance: string;
}> = ({ id, title, state, count, guidance }) => {
  const clean = state === 'done' && count === 0;
  const pill =
    state === 'notPresent'
      ? 'Not present'
      : state === 'unavailable'
      ? 'Unavailable'
      : clean
      ? 'All clean'
      : 'Keeping';

  return (
    <div style={card} role="group" aria-label={title} data-category={id}>
      <span style={iconTile(state, clean)} aria-hidden="true">
        {state !== 'done' ? '!' : clean ? '✓' : '📁'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text-strong)' }}>
          {title}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {state === 'done' ? guidance : 'This check could not run against your export.'}
        </p>
      </div>
      <span style={pillStyle(state, clean)}>{pill}</span>
    </div>
  );
};

export default AuditInfoCard;
