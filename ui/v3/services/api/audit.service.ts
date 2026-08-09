import apiClient from '../../auth/apiClient';
import { API_VERSION_V3 } from '../../constants';

/**
 * v3 Audit API service (cs-audit-report trd.md API-1 … API-5).
 *
 * Every call goes through the centralized apiClient, which attaches the app_token and
 * handles 401. Filtering, searching and pagination are query parameters rather than
 * client-side work: the client holds one page, so it cannot narrow the rest (FR-6.4).
 */
const base = (projectId: string) => `${API_VERSION_V3}/project/${projectId}/audit`;

export interface AuditItemsQuery {
  filter?: string;
  q?: string;
  page?: number;
}

export const auditApi = {
  /** API-1 — start (or force) a scan. */
  startScan: (projectId: string, body: { force?: boolean } = {}) =>
    apiClient.post(`${base(projectId)}/run`, body),

  /** API-2 — poll a scan's per-check progress. */
  getJob: (projectId: string, jobId: string) =>
    apiClient.get(`${base(projectId)}/run/${jobId}`),

  /** API-3 — the cached findings summary, the decisions and the derived impact. */
  getFindings: (projectId: string) => apiClient.get(base(projectId)),

  /** API-4 — one page of flagged items, filtered and searched server-side. */
  getItems: (projectId: string, params: AuditItemsQuery) =>
    apiClient.get(`${base(projectId)}/items`, { params }),

  /** API-5 — replace the stored decision set. */
  putDecisions: (projectId: string, decisions: unknown) =>
    apiClient.put(`${base(projectId)}/decisions`, decisions),
};
