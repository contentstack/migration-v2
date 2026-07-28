import { FC } from 'react';
import { Link, useParams } from 'react-router';

import { V3_BASE } from '../../constants';

/**
 * v3 Settings — placeholder page.
 */
const SettingsV3: FC = () => {
  const { projectId } = useParams();

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>v3 · Settings</h1>
      <p>
        Project: <strong>{projectId}</strong>
      </p>
      <p>Greenfield v3 settings page (placeholder).</p>
      <Link to={`${V3_BASE}/projects`}>← Back to projects</Link>
    </div>
  );
};

export default SettingsV3;
