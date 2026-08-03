import { FC } from 'react';
import { useParams, useSearchParams } from 'react-router';

import DestinationPanel from '../../components/destination/DestinationPanel';
import SourcePanel from '../../components/source/SourcePanel';
import WizardChrome from '../../components/wizard/WizardChrome';
import { stepByRouteSegment } from '../../components/wizard/steps';

/**
 * v3 Migration step — renders the panel for the current step inside the shared
 * wizard chrome (migration-wizard-chrome feature.md UC-1).
 *
 * Which panel shows is driven by the `:stepId` route segment; the app bar, step
 * tracker, footer and every step transition are owned by `WizardChrome`, and
 * this page only chooses the body.
 *
 * Stage 1 wiring (prd.md §9): only Source and Destination have panels. The
 * other five steps render a placeholder — they are real steps in the tracker
 * and the footer, but their bodies belong to features not yet built.
 */
const MigrationV3: FC = () => {
  const { projectId, stepId } = useParams();
  const [params] = useSearchParams();
  const step = stepByRouteSegment(stepId);

  /*
    STOPGAP: `orgId` comes from `?orgId=` because the v3 route
    (`projects/:projectId/migration/steps/:stepId`) carries no org (chrome
    trd.md TQ-2, and the same note previously in this file). Without it the
    Destination panel skips its mount-time reads, so resume and the
    source-readiness gate do not load and Proceed stays disabled — it skips
    rather than firing a request that would 404 on an empty path segment.
  */
  const orgId = params.get('orgId') ?? '';

  const panel = () => {
    if (step?.id === 'destination')
      return <DestinationPanel orgId={orgId} projectId={projectId ?? ''} />;
    if (step?.id === 'source') return <SourcePanel projectId={projectId ?? ''} />;
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        The {step?.trackerLabel ?? 'requested'} step is not built yet.
      </div>
    );
  };

  return <WizardChrome>{panel()}</WizardChrome>;
};

export default MigrationV3;
