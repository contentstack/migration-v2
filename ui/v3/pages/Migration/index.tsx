import { FC } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';

import { V3_BASE } from '../../constants';
import SourcePanel from '../../components/source/SourcePanel';
import DestinationPanel from '../../components/destination/DestinationPanel';

/**
 * v3 Migration step — hosts the Content Map & Audit panels.
 *
 * Which panel is shown is driven by `?panel=` (default: source). The step
 * tracker and cross-step navigation are shared wizard chrome owned elsewhere
 * (cs-destination-selection/feature.md §5), and the real Source → Audit →
 * Destination ordering is still an open question there (Q-1 / Q-2), so this
 * deliberately does no step-number mapping of its own.
 */
const MigrationV3: FC = () => {
  const { projectId, stepId } = useParams();
  const [params] = useSearchParams();
  const panel = params.get('panel') === 'destination' ? 'destination' : 'source';

  const tab = (to: string, label: string, active: boolean) => (
    <Link
      to={to}
      style={{
        fontSize: 13,
        fontWeight: 700,
        padding: '5px 12px',
        borderRadius: 'var(--radius-pill)',
        textDecoration: 'none',
        color: active ? 'var(--text-on-brand)' : 'var(--text-muted)',
        background: active ? 'var(--brand-strong)' : 'var(--surface-sunken)',
      }}
    >
      {label}
    </Link>
  );

  const base = `${V3_BASE}/projects/${projectId}/migration/steps/${stepId}`;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        {tab(base, 'Source', panel === 'source')}
        {tab(`${base}?panel=destination`, 'Destination', panel === 'destination')}
        <Link to={`${V3_BASE}/projects`} style={{ marginLeft: 'auto', fontSize: 13 }}>
          ← Projects
        </Link>
      </div>

      {/*
        STOPGAP: `orgId` comes from `?orgId=` because the v3 route
        (`projects/:projectId/migration/steps/:stepId`) carries no org, and
        `pages/Projects` is still an explicit placeholder with no org concept.
        The Destination panel needs one for its org-scoped read/persist
        endpoints (trd.md API-1/API-2, `/v3/org/:orgId/project/:projectId/...`).

        Consequence while that is unresolved: without `?orgId=`, the panel skips
        its mount-time reads entirely — so resume (UC-5) and the source-readiness
        gate (FR-6.1) do not load, and Proceed stays disabled. It skips rather
        than firing a request that would 404 on the empty path segment. Replace
        this with a real org from the projects UI once that exists.
      */}
      {panel === 'destination' ? (
        <DestinationPanel orgId={params.get('orgId') ?? ''} projectId={projectId ?? ''} />
      ) : (
        <SourcePanel projectId={projectId ?? ''} />
      )}
    </div>
  );
};

export default MigrationV3;
