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

/** Adds stack-scoping headers (api_key, branch) to an auth header set. */
const stackHeaders = (
  auth: Record<string, string>,
  stackApiKey: string,
  branch?: string
): Record<string, string> => ({
  ...auth,
  api_key: stackApiKey,
  ...(branch ? { branch } : {}),
});

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

  /** All content-type schemas in a stack (for the stack-mode graph build). */
  getContentTypes: async (
    tp: TokenPayload | undefined,
    stackApiKey: string,
    branch?: string
  ) => {
    const region = tp?.region as string;
    const headers = stackHeaders(await authHeaders(tp), stackApiKey, branch);
    const data = await csGet(
      `${hostFor(region)}/content_types?include_global_field_schema=true`,
      headers
    );
    return data?.content_types ?? [];
  },

  /**
   * Per-module counts for a stack (stack-mode modules + graph counts, FR-5.4).
   * `entries` is summed per content type; individual count failures degrade to 0.
   */
  getStackModuleCounts: async (
    tp: TokenPayload | undefined,
    stackApiKey: string,
    branch?: string,
    contentTypes?: any[]
  ): Promise<Record<string, number>> => {
    const region = tp?.region as string;
    const host = hostFor(region);
    const headers = stackHeaders(await authHeaders(tp), stackApiKey, branch);

    const cts =
      contentTypes ??
      (await csGet(`${host}/content_types`, headers))?.content_types ??
      [];

    const [globalFields, assets] = await Promise.all([
      csGet(`${host}/global_fields`, headers)
        .then((d) => (d?.global_fields ?? []).length)
        .catch(() => 0),
      csGet(`${host}/assets?include_count=true&limit=1`, headers)
        .then((d) => Number(d?.count ?? 0))
        .catch(() => 0),
    ]);

    let entries = 0;
    for (const ct of cts) {
      const uid = ct?.uid;
      if (!uid) continue;
      entries += await csGet(
        `${host}/content_types/${uid}/entries?include_count=true&limit=1`,
        headers
      )
        .then((d) => Number(d?.count ?? 0))
        .catch(() => 0);
    }

    return { contentTypes: cts.length, globalFields, assets, entries };
  },

  /**
   * Real Contentstack login for a region (cross-region source authentication).
   * Calls CS's `/user-session` — the SAME endpoint v2's login uses — directly
   * (standalone; not via v2 code). Returns the region-specific `userId` (CS
   * `uid`, which differs per region for the same email) and the authtoken;
   * the caller persists the authtoken via `auth.store.saveAuthtoken`.
   */
  regionLogin: async (
    region: string,
    email: string,
    password: string
  ): Promise<{ userId: string; email: string; authtoken: string }> => {
    const host = hostFor(region);
    let data: any;
    try {
      const res = await axios.post(
        `${host}/user-session?include_orgs_roles=true`,
        { user: { email, password } },
        { headers: { "Content-Type": "application/json" }, timeout: 60_000 }
      );
      data = res.data;
    } catch (e: any) {
      const status = e?.response?.status ?? HTTP_CODES.SERVER_ERROR;
      const message =
        e?.response?.data?.error_message ??
        e?.response?.data?.errors?.email?.[0] ??
        e?.message ??
        "Contentstack login failed.";
      throw new CsError(status, message);
    }
    const user = data?.user;
    if (!user?.uid || !user?.authtoken) {
      throw new CsError(HTTP_CODES.SERVER_ERROR, "Unexpected response from Contentstack.");
    }
    return { userId: user.uid, email: user.email, authtoken: user.authtoken };
  },
};
