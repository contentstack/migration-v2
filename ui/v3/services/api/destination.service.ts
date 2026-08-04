import apiClient from '../../auth/apiClient';
import { API_VERSION_V3 } from '../../constants';

/**
 * v3 Destination API service. Every call goes through the centralized apiClient
 * (attaches app_token, handles 401).
 *
 * Region / organization / existing-stack / branch listing deliberately calls the
 * Source feature's already-built `/v3/source/*` endpoints rather than
 * duplicating them (trd.md TC-1 / TR-2) — that data is identical Contentstack
 * account data regardless of which panel asks for it. Only the genuinely new
 * capabilities (create stack, create management token, stack stats, destination
 * persistence) live under `/v3/destination`.
 */
const sourceBase = `${API_VERSION_V3}/source`;
const destBase = `${API_VERSION_V3}/destination`;

/** Cross-region credential — set once a region-login has completed for a region
 * other than the session's home region. */
export interface RegionCredential {
  region?: string;
  regionUserId?: string;
}

const regionParams = (rc?: RegionCredential) => ({
  region: rc?.region,
  regionUserId: rc?.regionUserId,
});

export interface CreateStackBody {
  orgId: string;
  name: string;
  description?: string;
  /** Fixed at creation — a stack's master locale cannot be changed later. */
  masterLocale?: string;
}

export interface CreateManagementTokenBody {
  /**
   * Which project the token belongs to. Required: the server encrypts and stores
   * the token secret against this project rather than returning it, so it has to
   * be told where it goes. The response carries only `{ uid, name }` — the secret
   * never reaches this client at all.
   */
  projectId: string;
  stackApiKey: string;
  name: string;
  /** Optional; the server stamps a default so the customer can see its origin. */
  description?: string;
  /**
   * Branch names to scope the token to. Omitted or empty → no branch scope entry
   * at all, which is what a stack with no branches needs: naming a branch that
   * does not exist fails the whole request.
   */
  branches?: string[];
}

export const destinationApi = {
  // ---- reused from cs-source-selection (TR-2) ----
  getRegions: () => apiClient.get(`${sourceBase}/regions`),
  regionLogin: (region: string, email: string, password: string) =>
    apiClient.post(`${sourceBase}/region-login`, { region, email, password }),
  getOrgs: (rc?: RegionCredential) =>
    apiClient.get(`${sourceBase}/orgs`, { params: regionParams(rc) }),
  getStacks: (orgId: string, rc?: RegionCredential) =>
    apiClient.get(`${sourceBase}/stacks`, { params: { orgId, ...regionParams(rc) } }),
  getBranches: (stackApiKey: string, rc?: RegionCredential) =>
    apiClient.get(`${sourceBase}/branches`, { params: { stackApiKey, ...regionParams(rc) } }),
  getSource: (projectId: string) =>
    apiClient.get(`${API_VERSION_V3}/project/${projectId}/source`),

  // ---- new to this feature ----
  getLocales: (stackApiKey: string, rc?: RegionCredential) =>
    apiClient.get(`${destBase}/locales`, { params: { stackApiKey, ...regionParams(rc) } }),

  /** Every locale Contentstack supports — for the create-stack master-locale
   * picker. Not stack-scoped: the stack being created doesn't exist yet. */
  getContentstackLocales: (rc?: RegionCredential) =>
    apiClient.get(`${destBase}/contentstack-locales`, { params: regionParams(rc) }),

  // Both mutating calls carry the cross-region credential in the BODY (rather
  // than as a separate argument), so a destination region unlocked via
  // region-login is resolved server-side by resolveRegionCredential.
  createStack: (body: CreateStackBody & RegionCredential) =>
    apiClient.post(`${destBase}/stacks`, body),

  createManagementToken: (body: CreateManagementTokenBody & RegionCredential) =>
    apiClient.post(`${destBase}/management-tokens`, body),

  getStackStats: (apiKey: string, rc?: RegionCredential) =>
    apiClient.get(`${destBase}/stacks/${apiKey}/stats`, { params: regionParams(rc) }),

  persistDestination: (projectId: string, destination: unknown) =>
    apiClient.put(
      `${API_VERSION_V3}/project/${projectId}/destination`,
      destination
    ),
  getDestination: (projectId: string) =>
    apiClient.get(`${API_VERSION_V3}/project/${projectId}/destination`),
};
