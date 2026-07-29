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

export const sourceApi = {
  getRegions: () => apiClient.get(`${base}/regions`),
  getOrgs: () => apiClient.get(`${base}/orgs`),
  getStacks: (orgId: string) => apiClient.get(`${base}/stacks`, { params: { orgId } }),
  getBranches: (stackApiKey: string) =>
    apiClient.get(`${base}/branches`, { params: { stackApiKey } }),

  getFileModules: (sourceId: string) =>
    apiClient.get(`${base}/modules`, { params: { sourceId } }),
  getStackModules: (stackApiKey: string, branch?: string) =>
    apiClient.get(`${base}/modules`, { params: { stackApiKey, branch } }),

  uploadBundle: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return apiClient.post(`${base}/upload`, fd);
  },

  startExport: (body: StartExportBody) => apiClient.post(`${base}/export`, body),
  getExportStatus: (jobId: string) => apiClient.get(`${base}/export/${jobId}`),
  getGraph: (projectId: string) => apiClient.get(`${base}/${projectId}/graph`),

  persistSource: (orgId: string, projectId: string, source: unknown) =>
    apiClient.put(`${API_VERSION_V3}/org/${orgId}/project/${projectId}/source`, source),
  getSource: (orgId: string, projectId: string) =>
    apiClient.get(`${API_VERSION_V3}/org/${orgId}/project/${projectId}/source`),
};
