import { CSSProperties, FC } from 'react';

import V3Select from '../source/V3Select';

/** Shared 4-column grid used by both the branch and language mapping rows:
 * source | dash | destination | row-action. */
export const MAP_GRID: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 14px 1fr 28px',
  gap: 10,
  alignItems: 'center',
};

const InfoIcon: FC<{ title: string }> = ({ title }) => (
  <span title={title} style={{ display: 'flex', color: 'var(--text-subtle)', cursor: 'help' }}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v5M12 8h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  </span>
);

/** Section heading + hint icon, then the source/destination column labels. */
export const MappingHeader: FC<{ title: string; hint: string }> = ({ title, hint }) => (
  <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-strong)' }}>{title}</div>
      <InfoIcon title={hint} />
    </div>
    <div style={MAP_GRID}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-strong)' }}>
        Source stack <span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>(source)</span>
      </div>
      <span />
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-strong)' }}>
        Contentstack{' '}
        <span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>(destination)</span>
      </div>
      <span />
    </div>
  </>
);

const LockIcon: FC = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flex: 'none', color: 'var(--text-subtle)' }}>
    <path d="M7 10V7a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

/**
 * The read-only left half of a mapping row — a value inherited from the Source
 * step that cannot be edited here (FR-9.3 / FR-4.1). Announced to assistive
 * tech as read-only rather than as an editable field (NFR-3).
 */
export const LockedValue: FC<{
  value: string;
  badge: string;
  badgeTitle: string;
  testId: string;
}> = ({ value, badge, badgeTitle, testId }) => (
  <div
    data-testid={testId}
    aria-readonly="true"
    style={{
      minWidth: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 40,
      padding: '0 12px',
      border: '1px solid var(--border-subtle)',
      background: 'var(--surface-sunken)',
      borderRadius: 'var(--radius-md)',
    }}
  >
    <LockIcon />
    <span
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--text-body)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}
    >
      {value}
    </span>
    <span
      title={badgeTitle}
      style={{
        marginLeft: 'auto',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '.05em',
        color: 'var(--text-subtle)',
        cursor: 'help',
      }}
    >
      {badge}
    </span>
  </div>
);

export const MapDash: FC = () => (
  <span style={{ textAlign: 'center', color: 'var(--text-subtle)', fontWeight: 700 }}>–</span>
);

/**
 * The editable right-hand half of a mapping row. Uses the shared themed
 * dropdown rather than a native `<select>` so the open option list is styled by
 * the app instead of the OS popup chrome (see V3Select).
 */
export const MapSelect: FC<{
  label: string;
  value: string;
  placeholder: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}> = ({ label, value, placeholder, options, onChange }) => (
  <div style={{ minWidth: 0 }}>
    <V3Select
      ariaLabel={label}
      value={value}
      placeholder={placeholder}
      options={options}
      onChange={onChange}
    />
  </div>
);
