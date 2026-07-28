import { FC } from 'react';
import { Link, useParams } from 'react-router';

import { V3_BASE } from '../../constants';

/**
 * v3 Migration steps — placeholder page. The Source panel (and the rest of the
 * migration wizard) will be built here.
 */
const MigrationV3: FC = () => {
  const { projectId, stepId } = useParams();

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>v3 · Migration</h1>
      <p>
        Project: <strong>{projectId}</strong> · Step: <strong>{stepId}</strong>
      </p>
      <p>Greenfield v3 migration flow (placeholder).</p>
      <Link to={`${V3_BASE}/projects`}>← Back to projects</Link>
    </div>
  );
};

export default MigrationV3;
