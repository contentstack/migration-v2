import apiClient from '../../auth/apiClient';
import { API_VERSION_V3 } from '../../constants';

/**
 * v3 Source API service. Every call goes through the centralized apiClient
 * (attaches app_token, handles 401). Paths are built from API_VERSION_V3.
 */
const base = `${API_VERSION_V3}/source`;

export interface StartExportBody {
  orgId: string;
  projectId: string;
  mode: 'stack' | 'file';
  stack?: Record<string, unknown>;
  file?: Record<string, unknown>;
}

/** Optional cross-region credential — set once a region-login has completed for a
 * region other than the session's home region (see RegionLoginModal / thunks). */
export interface RegionCredential {
  region?: string;
  regionUserId?: string;
}

const regionParams = (rc?: RegionCredential) => ({
  region: rc?.region,
  regionUserId: rc?.regionUserId,
});

export const sourceApi = {
  getRegions: () => apiClient.get(`${base}/regions`),
  regionLogin: (region: string, email: string, password: string) =>
    apiClient.post(`${base}/region-login`, { region, email, password }),

  getOrgs: (rc?: RegionCredential) =>
    apiClient.get(`${base}/orgs`, { params: regionParams(rc) }),
  getStacks: (orgId: string, rc?: RegionCredential) =>
    apiClient.get(`${base}/stacks`, { params: { orgId, ...regionParams(rc) } }),
  getBranches: (stackApiKey: string, rc?: RegionCredential) =>
    apiClient.get(`${base}/branches`, { params: { stackApiKey, ...regionParams(rc) } }),

  getFileModules: (sourceId: string) =>
    apiClient.get(`${base}/modules`, { params: { sourceId } }),
  getStackModules: (stackApiKey: string, branch?: string, rc?: RegionCredential) =>
    apiClient.get(`${base}/modules`, { params: { stackApiKey, branch, ...regionParams(rc) } }),

  uploadBundle: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiClient.post(`${base}/upload`, fd);
  },

  startExport: (body: StartExportBody) => apiClient.post(`${base}/export`, body),
  getExportStatus: (jobId: string) => apiClient.get(`${base}/export/${jobId}`),
  getGraph: (projectId: string) => apiClient.get(`${base}/${projectId}/graph`),

  persistSource: (projectId: string, source: unknown) =>
    apiClient.put(`${API_VERSION_V3}/project/${projectId}/source`, source),
  getSource: (projectId: string) =>
    apiClient.get(`${API_VERSION_V3}/project/${projectId}/source`),
};
