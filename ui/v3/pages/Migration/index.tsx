import { FC } from 'react';
import { useParams } from 'react-router';

import AuditPanel from '../../components/audit/AuditPanel';
import ContentMappingPanel from '../../components/contentMapping/ContentMappingPanel';
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
 * Stage 1 wiring (prd.md §9): Source, Audit and Destination have panels. The other
 * four steps render a placeholder — they are real steps in the tracker and the footer,
 * but their bodies belong to features not yet built.
 */
const MigrationV3: FC = () => {
  const { projectId, stepId } = useParams();
  const step = stepByRouteSegment(stepId);

  const panel = () => {
    if (step?.id === 'destination') return <DestinationPanel projectId={projectId ?? ''} />;
    if (step?.id === 'source') return <SourcePanel projectId={projectId ?? ''} />;
    if (step?.id === 'audit') return <AuditPanel projectId={projectId ?? ''} />;
    if (step?.id === 'content-mapping')
      return <ContentMappingPanel projectId={projectId ?? ''} />;
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        The {step?.trackerLabel ?? 'requested'} step is not built yet.
      </div>
    );
  };

  return <WizardChrome>{panel()}</WizardChrome>;
};

export default MigrationV3;
