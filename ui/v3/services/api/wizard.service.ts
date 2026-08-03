import apiClient from '../../auth/apiClient';
import { API_VERSION_V3 } from '../../constants';

/**
 * v3 wizard-chrome API service (trd.md §8).
 *
 * The chrome owns no endpoints of its own — it reads the two persisted step
 * documents it needs for the app bar's source indicator and the tracker's
 * completion marks. Both are owned by their respective features; they are
 * called from here rather than through those features' service modules so the
 * chrome does not take a dependency on a sibling panel it merely frames.
 */
const projectBase = (orgId: string, projectId: string) =>
  `${API_VERSION_V3}/org/${orgId}/project/${projectId}`;

export const wizardApi = {
  /** The persisted `source` document — app-bar name (TR-3), Source completion (TR-8). */
  getSource: (orgId: string, projectId: string) =>
    apiClient.get(`${projectBase(orgId, projectId)}/source`),

  /** The persisted `destination` document — Destination completion (TR-8). */
  getDestination: (orgId: string, projectId: string) =>
    apiClient.get(`${projectBase(orgId, projectId)}/destination`),
};
