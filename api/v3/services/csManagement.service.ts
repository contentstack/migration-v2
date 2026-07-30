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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A real export against a live stack can fire many CS Management API calls
 * in quick succession and hit Contentstack's rate limit (HTTP 429). Retried
 * with exponential backoff — everything else fails immediately, unchanged. */
const RATE_LIMIT_STATUS = 429;
const rateLimitMaxRetries = () => Number(process.env.V3_RATE_LIMIT_MAX_RETRIES ?? 5);
const rateLimitBaseDelayMs = () => Number(process.env.V3_RATE_LIMIT_BASE_DELAY_MS ?? 500);

const csGet = async (url: string, headers: Record<string, string>): Promise<any> => {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await axios.get(url, { headers, timeout: 60_000 });
      return res.data;
    } catch (e: any) {
      const status = e?.response?.status ?? HTTP_CODES.SERVER_ERROR;
      if (status === RATE_LIMIT_STATUS && attempt < rateLimitMaxRetries()) {
        const retryAfter = Number(e?.response?.headers?.["retry-after"]);
        const delay = retryAfter > 0 ? retryAfter * 1000 : rateLimitBaseDelayMs() * 2 ** attempt;
        await sleep(delay);
        continue;
      }
      const message =
        e?.response?.data?.error_message ?? e?.message ?? "Contentstack API error";
      throw new CsError(status, message);
    }
  }
};

/** POST counterpart of `csGet`, with the same 429 backoff and error mapping. */
const csPost = async (
  url: string,
  body: unknown,
  headers: Record<string, string>
): Promise<any> => {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await axios.post(url, body, { headers, timeout: 60_000 });
      return res.data;
    } catch (e: any) {
      const status = e?.response?.status ?? HTTP_CODES.SERVER_ERROR;
      if (status === RATE_LIMIT_STATUS && attempt < rateLimitMaxRetries()) {
        const retryAfter = Number(e?.response?.headers?.["retry-after"]);
        const delay = retryAfter > 0 ? retryAfter * 1000 : rateLimitBaseDelayMs() * 2 ** attempt;
        await sleep(delay);
        continue;
      }
      const message =
        e?.response?.data?.error_message ?? e?.message ?? "Contentstack API error";
      throw new CsError(status, message);
    }
  }
};

/** Deterministic thousands separators regardless of the host's default locale. */
const fmt = (n: number): string => n.toLocaleString("en-US");

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

  /** How many real items to fetch/report per module for the live export log. */
  moduleLogSampleSize: 6,

  /**
   * Per-module counts for a stack (stack-mode modules + graph counts, FR-5.4).
   * `entries` is summed per content type; individual count failures degrade to 0.
   *
   * `onItem`, if supplied, is fired with a REAL sampled item name (global
   * field, asset, or entry) as soon as its owning call resolves — used to
   * render actual per-item lines in the live export log ("Exporting asset:
   * hero.png") instead of only stage summaries. Purely additive: omitting it
   * changes nothing about the returned counts.
   */
  getStackModuleCounts: async (
    tp: TokenPayload | undefined,
    stackApiKey: string,
    branch?: string,
    contentTypes?: any[],
    onItem?: (
      event:
        | { type: "globalField"; name: string }
        | { type: "asset"; name: string }
        | { type: "entry"; name: string; ctTitle: string }
    ) => void,
    /** When provided (export "Specific module" scope), only these module keys
     * are fetched/counted — everything else is skipped entirely (no network
     * call) and reported as 0. `undefined` (whole-stack, or the module-listing
     * caller that must show real totals for every module up front) fetches
     * and counts everything, unchanged from prior behavior. */
    selectedModules?: string[]
  ): Promise<Record<string, number>> => {
    const region = tp?.region as string;
    const host = hostFor(region);
    const headers = stackHeaders(await authHeaders(tp), stackApiKey, branch);
    const sampleSize = csManagement.moduleLogSampleSize;
    const wants = (key: string) => !selectedModules || selectedModules.includes(key);

    const cts =
      contentTypes ??
      (await csGet(`${host}/content_types`, headers))?.content_types ??
      [];

    const [globalFields, assets] = await Promise.all([
      !wants("globalFields")
        ? Promise.resolve(0)
        : csGet(`${host}/global_fields`, headers)
            .then((d) => {
              const list = d?.global_fields ?? [];
              list.forEach((gf: any) => onItem?.({ type: "globalField", name: gf?.title ?? gf?.uid }));
              return list.length;
            })
            .catch(() => 0),
      !wants("assets")
        ? Promise.resolve(0)
        : csGet(`${host}/assets?include_count=true&limit=${sampleSize}`, headers)
            .then((d) => {
              (d?.assets ?? []).forEach((a: any) =>
                onItem?.({ type: "asset", name: a?.filename ?? a?.title ?? a?.uid })
              );
              return Number(d?.count ?? 0);
            })
            .catch(() => 0),
    ]);

    // Dispatched in parallel: for a stack with many content types, counting
    // them one-at-a-time made this endpoint take many seconds (each entries
    // call waiting on the previous), which made "Specific module" feel hung.
    // Each content type's onItem calls fire as soon as ITS OWN call resolves
    // (not after Promise.all as a whole), so items stream in as discovered.
    const entries = !wants("entries")
      ? 0
      : (
          await Promise.all(
            cts
              .filter((ct: any) => ct?.uid)
              .map((ct: any) =>
                csGet(`${host}/content_types/${ct.uid}/entries?include_count=true&limit=${sampleSize}`, headers)
                  .then((d) => {
                    (d?.entries ?? []).forEach((entry: any) =>
                      onItem?.({
                        type: "entry",
                        name: entry?.title ?? entry?.uid,
                        ctTitle: ct.title ?? ct.uid,
                      })
                    );
                    return Number(d?.count ?? 0);
                  })
                  .catch(() => 0)
              )
          )
        ).reduce((sum, c) => sum + c, 0);

    return { contentTypes: cts.length, globalFields, assets, entries };
  },

  /** Page size for the real full-data export fetchers below (distinct from
   * `moduleLogSampleSize`, which only samples a few items for the live log). */
  exportPageSize: 100,

  /** Every real global field definition in the stack (used by the genuine
   * export-to-disk bundle, not the sampled preview). */
  getAllGlobalFields: async (
    tp: TokenPayload | undefined,
    stackApiKey: string,
    branch?: string
  ): Promise<any[]> => {
    const region = tp?.region as string;
    const headers = stackHeaders(await authHeaders(tp), stackApiKey, branch);
    const data = await csGet(`${hostFor(region)}/global_fields`, headers);
    return data?.global_fields ?? [];
  },

  /** Every real asset in the stack, paged until exhausted (used by the
   * genuine export-to-disk bundle, not the sampled preview). */
  getAllAssets: async (
    tp: TokenPayload | undefined,
    stackApiKey: string,
    branch?: string
  ): Promise<any[]> => {
    const region = tp?.region as string;
    const host = hostFor(region);
    const headers = stackHeaders(await authHeaders(tp), stackApiKey, branch);
    const limit = csManagement.exportPageSize;
    const all: any[] = [];
    let skip = 0;
    // Safety cap on pages, not just the `count` field, in case a stack ever
    // reports an inflated/incorrect count — avoids a runaway fetch loop.
    for (let page = 0; page < 500; page++) {
      const data = await csGet(`${host}/assets?include_count=true&skip=${skip}&limit=${limit}`, headers);
      const batch = data?.assets ?? [];
      all.push(...batch);
      const total = Number(data?.count ?? all.length);
      skip += limit;
      if (batch.length === 0 || skip >= total) break;
    }
    return all;
  },

  /** Every real entry of one content type, paged until exhausted (used by the
   * genuine export-to-disk bundle, not the sampled preview). */
  getAllEntries: async (
    tp: TokenPayload | undefined,
    stackApiKey: string,
    branch: string | undefined,
    ctUid: string,
    locale = "en-us"
  ): Promise<any[]> => {
    const region = tp?.region as string;
    const host = hostFor(region);
    const headers = stackHeaders(await authHeaders(tp), stackApiKey, branch);
    const limit = csManagement.exportPageSize;
    const all: any[] = [];
    let skip = 0;
    for (let page = 0; page < 500; page++) {
      const data = await csGet(
        `${host}/content_types/${ctUid}/entries?locale=${locale}&include_count=true&skip=${skip}&limit=${limit}`,
        headers
      );
      const batch = data?.entries ?? [];
      all.push(...batch);
      const total = Number(data?.count ?? all.length);
      skip += limit;
      if (batch.length === 0 || skip >= total) break;
    }
    return all;
  },

  // ---- Destination panel (trd.md TR-11, TR-13, TR-14) ----

  /**
   * Creates a new stack in an organization (API-4 / FR-1.5). Contentstack itself
   * rejects a name that collides with an existing stack in the org; that 400 is
   * surfaced verbatim so the UI can show "already exists" (EC-3). Non-idempotent
   * — callers MUST NOT retry blindly (TRR-5).
   */
  createStack: async (
    tp: TokenPayload | undefined,
    orgId: string,
    name: string,
    description?: string
  ): Promise<{ apiKey: string; name: string; description?: string }> => {
    const region = tp?.region as string;
    const headers = { ...(await authHeaders(tp)), organization_uid: orgId };
    const data = await csPost(
      `${hostFor(region)}/stacks`,
      { stack: { name, ...(description ? { description } : {}) } },
      headers
    );
    const stack = data?.stack;
    if (!stack?.api_key) {
      throw new CsError(HTTP_CODES.SERVER_ERROR, "Unexpected response from Contentstack.");
    }
    return {
      apiKey: stack.api_key,
      name: stack.name,
      ...(stack.description ? { description: stack.description } : {}),
    };
  },

  /** Modules a migration import must be able to read AND write. */
  managementTokenModules: [
    "content_type",
    "entry",
    "asset",
    "global_field",
    "environment",
    "locale",
  ],

  /**
   * Creates a read+write management token on the destination stack (API-3 /
   * FR-3.3). Contentstack returns the secret exactly once, at creation. A
   * duplicate token name on the same stack surfaces as a 400 so the UI can show
   * "already exists" (EC-13). Non-idempotent (TRR-6).
   */
  createManagementToken: async (
    tp: TokenPayload | undefined,
    stackApiKey: string,
    name: string
  ): Promise<{ uid: string; name: string; secret: string }> => {
    const region = tp?.region as string;
    const headers = { ...(await authHeaders(tp)), api_key: stackApiKey };
    const scope = csManagement.managementTokenModules.map((module) => ({
      module,
      acl: { read: true, write: true },
    }));
    const data = await csPost(
      `${hostFor(region)}/stacks/management_tokens`,
      { token: { name, scope } },
      headers
    );
    const token = data?.token;
    if (!token?.uid || !token?.token) {
      throw new CsError(HTTP_CODES.SERVER_ERROR, "Unexpected response from Contentstack.");
    }
    return { uid: token.uid, name: token.name ?? name, secret: token.token };
  },

  /**
   * Existing content statistics for the destination stack, for the "Stack
   * contents" card (API-5 / FR-10.2–10.4). `isEmpty` is driven by the content-type
   * count — a stack with no content types has nothing that could be overwritten.
   * Individual count failures degrade to 0 rather than failing the whole card.
   */
  getStackStats: async (
    tp: TokenPayload | undefined,
    stackApiKey: string
  ): Promise<{ isEmpty: boolean; stats: { label: string; value: string }[] }> => {
    const region = tp?.region as string;
    const host = hostFor(region);
    const headers = { ...(await authHeaders(tp)), api_key: stackApiKey };

    const cts = (await csGet(`${host}/content_types`, headers))?.content_types ?? [];

    const [globalFields, assets, locales, branches] = await Promise.all([
      csGet(`${host}/global_fields`, headers)
        .then((d) => (d?.global_fields ?? []).length)
        .catch(() => 0),
      csGet(`${host}/assets?include_count=true&limit=1`, headers)
        .then((d) => Number(d?.count ?? 0))
        .catch(() => 0),
      csGet(`${host}/locales`, headers)
        .then((d) => (d?.locales ?? []).length)
        .catch(() => 0),
      csGet(`${host}/stacks/branches`, headers)
        .then((d) => (d?.branches ?? []).length)
        .catch(() => 0),
    ]);

    const entries = (
      await Promise.all(
        cts
          .filter((ct: any) => ct?.uid)
          .map((ct: any) =>
            csGet(
              `${host}/content_types/${ct.uid}/entries?include_count=true&limit=1`,
              headers
            )
              .then((d) => Number(d?.count ?? 0))
              .catch(() => 0)
          )
      )
    ).reduce((sum: number, c: number) => sum + c, 0);

    return {
      isEmpty: cts.length === 0,
      stats: [
        { label: "Content types", value: fmt(cts.length) },
        { label: "Global fields", value: fmt(globalFields) },
        { label: "Entries", value: fmt(entries) },
        { label: "Assets", value: fmt(assets) },
        { label: "Locales", value: fmt(locales) },
        { label: "Branches", value: fmt(branches) },
      ],
    };
  },

  /** Locales configured on a stack — feeds the destination locale dropdowns. */
  listLocales: async (
    tp: TokenPayload | undefined,
    stackApiKey: string
  ): Promise<{ code: string; name?: string }[]> => {
    const region = tp?.region as string;
    const headers = { ...(await authHeaders(tp)), api_key: stackApiKey };
    const data = await csGet(`${hostFor(region)}/locales`, headers);
    return (data?.locales ?? []).map((l: any) => ({ code: l?.code, name: l?.name }));
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
