import apiClient from '../../auth/apiClient';
import { API_VERSION_V3 } from '../../constants';

/**
 * v3 user API service (cs-project-dashboard API-3, TR-6).
 *
 * One read, used only for the projects page avatar. Deliberately its own endpoint
 * rather than a field on the organizations listing: nothing on that page needs an
 * organization list, and a caller asking for a name should not be handed one
 * (trd.md TC-8).
 */
export const userApi = {
  getUser: () => apiClient.get(`${API_VERSION_V3}/user`),
};
