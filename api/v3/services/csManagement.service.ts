import axios from "axios";

import { csApiHost, CS_REGIONS } from "../config/cs.js";
import { getAccessToken, getAuthtoken } from "../models/auth.store.js";
import { HTTP_CODES } from "../constants/http.js";

/**
 * v3 Contentstack Management API client — standalone (no import from api/src).
 * Resolves the caller's CS credential from the shared auth store and calls the
 * region's Management API. Supports non-SSO (authtoken) and SSO (Bearer).
 */
export class CsError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "CsError";
  }
}

export interface TokenPayload {
  region?: string;
  user_id?: string;
  is_sso?: boolean;
}

const authHeaders = async (
  tp: TokenPayload | undefined
): Promise<Record<string, string>> => {
  const region = tp?.region;
  const userId = tp?.user_id;
  if (!region || !userId) {
    throw new CsError(HTTP_CODES.UNAUTHORIZED, "Missing region/user in token.");
  }

  if (tp?.is_sso) {
    const token = await getAccessToken(region, userId);
    if (!token) {
      throw new CsError(HTTP_CODES.UNAUTHORIZED, "No SSO access token found for this user.");
    }
    return { authorization: `Bearer ${token}` };
  }

  const token = await getAuthtoken(region, userId);
  if (!token) {
    throw new CsError(HTTP_CODES.UNAUTHORIZED, "No authtoken found for this user.");
  }
  return { authtoken: token };
};

const hostFor = (region: string): string => {
  const host = csApiHost(region);
  if (!host) throw new CsError(HTTP_CODES.BAD_REQUEST, `Unknown region: ${region}`);
  return host;
};

const csGet = async (url: string, headers: Record<string, string>): Promise<any> => {
  try {
    const res = await axios.get(url, { headers, timeout: 60_000 });
    return res.data;
  } catch (e: any) {
    const status = e?.response?.status ?? HTTP_CODES.SERVER_ERROR;
    const message =
      e?.response?.data?.error_message ?? e?.message ?? "Contentstack API error";
    throw new CsError(status, message);
  }
};

export const csManagement = {
  /** Static list of regions configured for the current environment. */
  regions: () => CS_REGIONS.map((code) => ({ value: code, label: code })),

  /** Organizations the user belongs to (API-4 / FR-5.3). */
  listOrgs: async (tp: TokenPayload | undefined) => {
    const region = tp?.region as string;
    const headers = await authHeaders(tp);
    const data = await csGet(`${hostFor(region)}/user?include_orgs_roles=true`, headers);
    return (data?.user?.organizations ?? []).map((o: any) => ({
      uid: o?.uid,
      name: o?.name,
    }));
  },

  /** Stacks in an organization (API-4 / FR-5.3). */
  listStacks: async (tp: TokenPayload | undefined, orgId: string) => {
    const region = tp?.region as string;
    const headers = { ...(await authHeaders(tp)), organization_uid: orgId };
    const data = await csGet(`${hostFor(region)}/stacks`, headers);
    return (data?.stacks ?? []).map((s: any) => ({
      apiKey: s?.api_key,
      name: s?.name,
    }));
  },

  /** Branches in a stack (API-4 / FR-5.3). Default branch is `main`. */
  listBranches: async (tp: TokenPayload | undefined, stackApiKey: string) => {
    const region = tp?.region as string;
    const headers = { ...(await authHeaders(tp)), api_key: stackApiKey };
    const data = await csGet(`${hostFor(region)}/stacks/branches`, headers);
    return (data?.branches ?? []).map((b: any) => ({ uid: b?.uid }));
  },
};
