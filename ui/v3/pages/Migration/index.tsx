import { FC } from 'react';
import { Link, useParams } from 'react-router';

import { V3_BASE } from '../../constants';
import SourcePanel from '../../components/source/SourcePanel';

/**
 * v3 Migration step — hosts the Content Map & Audit Source panel.
 */
const MigrationV3: FC = () => {
  const { projectId, stepId } = useParams();

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 18 }}>v3 · Content Map &amp; Audit</h1>
        <span style={{ fontSize: 12, color: '#6b7280' }}>
          Project {projectId} · Step {stepId}
        </span>
        <Link to={`${V3_BASE}/projects`} style={{ marginLeft: 'auto', fontSize: 13 }}>
          ← Projects
        </Link>
      </div>
      <div style={{ marginTop: 16 }}>
        <SourcePanel projectId={projectId ?? ''} />
      </div>
    </div>
  );
};

export default MigrationV3;
