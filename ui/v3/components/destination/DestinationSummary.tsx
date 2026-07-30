import { FC, ReactNode } from 'react';

import { useV3Selector } from '../../store/hooks';
import { destStackLabel } from '../../store/slice/destination.slice';

/**
 * Live-updating "Destination summary" sidebar card (FR-7.1).
 *
 * NOTE: the stack row's label reads "New stack" verbatim from the design even
 * though an EXISTING stack can now be selected too — whether that copy should
 * change is an open design question (feature.md Q-14 / prd.md PQ-7), so it is
 * left as-designed rather than silently reworded here.
 */
const Row: FC<{ icon: ReactNode; label: string; children: ReactNode }> = ({
  icon,
  label,
  children,
}) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
    <span style={{ flex: 'none', color: 'var(--brand-strong)', marginTop: 1 }}>{icon}</span>
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: 'var(--text-subtle)',
          textTransform: 'uppercase',
          letterSpacing: '.04em',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  </div>
);

const value = (v: string, set: boolean, testId: string, wrap = false) => (
  <div
    data-testid={testId}
    style={{
      fontSize: 13,
      fontWeight: 700,
      color: set ? 'var(--text-strong)' : 'var(--text-subtle)',
      ...(wrap ? { wordBreak: 'break-word' as const } : {}),
    }}
  >
    {v}
  </div>
);

const DestinationSummary: FC = () => {
  const d = useV3Selector((s) => s.destination);

  const regionLabel = d.regions.find((r) => r.value === d.region)?.label || d.region;
  const orgLabel = d.orgs.find((o) => o.value === d.org)?.label || d.org;
  const stackLabel = destStackLabel(d);

  const authSummary =
    d.importAuth.method === 'management'
      ? 'Management token'
      : d.importAuth.method === 'authToken'
        ? 'authToken'
        : 'Not selected';

  // Master row (always 1) + however many additional rows are configured. The
  // exact formula is an open question (feature.md Q-16); this mirrors the design.
  const localeCount = d.additionalLanguageMappings.length + 1;
  const localeLabel = `${localeCount} locale${localeCount === 1 ? '' : 's'} mapped`;

  return (
    <div
      style={{
        background: 'linear-gradient(160deg, var(--brand-subtle), transparent 72%)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: '.07em',
          textTransform: 'uppercase',
          color: 'var(--brand-strong)',
        }}
      >
        Destination summary
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Row
          label="Region"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
              <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          }
        >
          {value(regionLabel || 'Not selected', !!d.region, 'summary-region')}
        </Row>
        <Row
          label="Organization"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          }
        >
          {value(orgLabel || 'Not selected', !!d.org, 'summary-org')}
        </Row>
        <Row
          label="New stack"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M12 3 21 7.5 12 12 3 7.5 12 3ZM3 12l9 4.5L21 12M3 16.5 12 21l9-4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        >
          {value(stackLabel || 'Not selected', !!stackLabel, 'summary-stack', true)}
        </Row>
        <Row
          label="Import auth"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M7 10V7a5 5 0 0 1 10 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          }
        >
          {value(authSummary, !!d.importAuth.method, 'summary-auth')}
        </Row>
        <Row
          label="Locales mapped"
          icon={
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M4 5h16M4 5c0 6 3 9 8 9s8-3 8-9M9 19h6M12 14v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        >
          {value(localeLabel, true, 'summary-locales')}
        </Row>
      </div>
    </div>
  );
};

export default DestinationSummary;
