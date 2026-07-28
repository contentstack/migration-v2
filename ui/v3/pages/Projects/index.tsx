import { FC } from 'react';
import { Link } from 'react-router';

import { V3_BASE } from '../../constants';

/**
 * v3 Projects — placeholder page. Real projects UI replaces this.
 * Demonstrates that /v3 routing + the v3 auth guard work end-to-end.
 */
const ProjectsV3: FC = () => {
  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>v3 · Projects</h1>
      <p>Greenfield v3 projects page (placeholder).</p>
      {/* Nav must always use the V3_BASE prefix, never a bare /projects. */}
      <Link to={`${V3_BASE}/projects/demo-project/migration/steps/1`}>
        Open demo project → migration step 1
      </Link>
    </div>
  );
};

export default ProjectsV3;
