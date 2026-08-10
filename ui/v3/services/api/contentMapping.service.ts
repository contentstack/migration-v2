import apiClient from '../../auth/apiClient';
import { API_VERSION_V3 } from '../../constants';

/**
 * v3 Content mapping API service (cs-content-type-selection trd.md API-1, API-2).
 *
 * The inventory is fetched whole and never paged (TC-1): the client filters,
 * pages and selects locally, and the reference graph has to be in the browser for
 * the untick confirmation to resolve synchronously.
 */
const base = (projectId: string) =>
  `${API_VERSION_V3}/project/${projectId}/content-mapping`;

export const contentMappingApi = {
  /** API-1 — inventory, reference graph, destination indicator, saved selection. */
  getInventory: (projectId: string) => apiClient.get(`${base(projectId)}/inventory`),

  /** API-2 — replace the stored selection. */
  putSelection: (projectId: string, contentTypes: Record<string, unknown>) =>
    apiClient.put(`${base(projectId)}/selection`, { contentTypes }),
};
