import apiClient from '../../auth/apiClient';
import { API_VERSION_V3 } from '../../constants';

/**
 * v3 project API service (cs-project-dashboard trd.md API-1, API-2, TR-18).
 *
 * Goes through the shared apiClient so that token attachment and the
 * 401-clears-and-redirects behaviour are inherited rather than reimplemented —
 * that is what makes AC-7.3 hold without this feature containing any auth logic.
 */
const projectBase = `${API_VERSION_V3}/project`;

export interface CreateProjectBody {
  name: string;
  /** Optional; sent as an empty string when the user left it blank. */
  description?: string;
}

export const projectApi = {
  /** The caller's projects. No organization parameter of any kind (FR-3.1). */
  getProjects: () => apiClient.get(projectBase),

  /**
   * Creates a project. Only the name and the description are sent — the id, owner,
   * region and timestamps are server-assigned (FR-7.8).
   */
  createProject: (body: CreateProjectBody) => apiClient.post(projectBase, body),
};
