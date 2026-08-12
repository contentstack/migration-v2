import { configHandler } from "@contentstack/cli-utilities";
import { getContentstackEndpoint } from "@contentstack/utils";

import { csApiHost } from "../config/cs.js";

/**
 * v3 region + credential injection for the Contentstack CLI.
 *
 * Implements `docs/plans/source-export-revamp.md` Impact 4 and Impact 4b (R-9).
 *
 * Mirrors v2's `src/utils/config-handler.util.ts` but standalone — v3 imports
 * nothing from `api/src` (plan C-1).
 *
 * **Why injection rather than flags.** The CLI is authenticated by writing into
 * its own config store, never by passing a token on the command line. That is
 * what keeps the credential out of argv, out of a process listing, and out of the
 * log the operator reads.
 *
 * **Why the region is verified.** `cs.ts` resolves a STAGING host whenever
 * `NODE_ENV` is not `production`, while the CLI's region map contains production
 * hosts only. A naive `setRegion("NA")` would therefore point the CLI at a
 * different Contentstack than the UI listed stacks from — and because the same
 * api key exists in both instances, the export would SUCCEED and quietly return
 * the wrong stack's content. There is no way to spot that from the screen, so the
 * only safe response is to refuse.
 */

export class CliRegionMismatchError extends Error {
  status = 409;
  constructor(message: string) {
    super(message);
    this.name = "CliRegionMismatchError";
  }
}

export interface CliAuthInput {
  authtoken?: string;
  accessToken?: string;
  refreshToken?: string;
  email?: string;
  userUid?: string;
  organizationUid?: string;
  updatedAt?: string;
}

/** Our region codes use `_`; the CLI's use `-`. Otherwise identical. */
export const cliRegionName = (region: string): string => region.replace(/_/g, "-");

/** Strips the `/v3` segment and any trailing slash so two hosts can be compared. */
const normaliseHost = (host: string): string =>
  host.replace(/\/v3\/?$/, "").replace(/\/+$/, "").toLowerCase();

/**
 * The region record the CLI stores, built from the SAME source the CLI itself
 * uses — `@contentstack/utils`' endpoint map.
 *
 * ⚠️ Deliberately NOT `regionHandler` from `@contentstack/cli-config`. That
 * package is an oclif PLUGIN: its package.json declares no `main`, `module` or
 * `exports`, so importing it is unresolvable and broke every test that loaded the
 * export service transitively. Reading the endpoint map directly is both
 * importable and one layer closer to the truth — `region-handler.js` does exactly
 * this call internally, then writes the result to `configHandler`, which is all
 * `setRegion` ever did.
 */
const cliRegionObject = (name: string): Record<string, unknown> | null => {
  try {
    const endpoints = getContentstackEndpoint(name) as any;
    // Some inputs resolve to a bare string rather than an endpoint set; that is
    // not something we can build a region from.
    if (!endpoints || typeof endpoints === "string") return null;
    return {
      name,
      cma: endpoints.contentManagement,
      cda: endpoints.contentDelivery,
      uiHost: endpoints.application,
      developerHubUrl: endpoints.developerHub,
      launchHubUrl: endpoints.launch,
      personalizeUrl: endpoints.personalizeManagement,
    };
  } catch {
    // An unrecognised region throws; the caller turns that into a refusal.
    return null;
  }
};

/**
 * Points the CLI at a region, but only after verifying it resolves the SAME
 * Contentstack this app is using.
 *
 * `ourHost` defaults to whatever `cs.ts` resolves for the region, which is the
 * value every other v3 call already uses — so the comparison is against real
 * behaviour, not a second copy of the configuration.
 *
 * Resolve → verify → write, in that order. Writing first and then throwing would
 * leave a wrong region in the CLI's shared config for the NEXT export to pick up,
 * turning one refused export into a silently misdirected one.
 */
export const applyCliRegion = (region: string, ourHost?: string): void => {
  const name = cliRegionName(region);
  const resolved = cliRegionObject(name);

  if (!resolved?.cma) {
    throw new CliRegionMismatchError(
      `The Contentstack CLI does not recognise the region "${name}" (from "${region}").`
    );
  }

  const ours = ourHost ?? csApiHost(region);
  if (!ours) {
    throw new CliRegionMismatchError(`No Management API host is configured for region "${region}".`);
  }

  if (normaliseHost(resolved.cma as string) !== normaliseHost(ours)) {
    // Both hosts are named: "region mismatch" alone leaves the reader guessing
    // which side is wrong, whereas the two hostnames make the cause obvious and
    // point at NODE_ENV as the fix.
    throw new CliRegionMismatchError(
      `Refusing to export: the Contentstack CLI would use "${resolved.cma}" but this app is ` +
        `configured for "${ours}". Exporting would return content from a different ` +
        `Contentstack instance than the one you selected a stack from.`
    );
  }

  // Verified — now it is safe to write.
  configHandler.set("region", resolved);
};

/**
 * Writes the caller's credential into the CLI's config store.
 *
 * OAuth wins when both are present: the export decides how to authenticate from
 * `authorisationType === 'OAUTH'` (`export-config-handler.js:64`), so writing
 * BASIC alongside an OAuth token would have it authenticate with a credential it
 * is not actually using.
 */
export const applyCliAuth = (auth: CliAuthInput): void => {
  if (auth.accessToken) {
    configHandler.set("oauthAccessToken", auth.accessToken);
    if (auth.refreshToken) configHandler.set("oauthRefreshToken", auth.refreshToken);
    // `updated_at` in preference to `created_at`, so the CLI does not immediately
    // refresh a token that is already fresh — same reasoning as v2's setOAuthConfig.
    configHandler.set("oauthDateTime", auth.updatedAt ?? new Date().toISOString());
    if (auth.email) configHandler.set("email", auth.email);
    if (auth.userUid) configHandler.set("userUid", auth.userUid);
    if (auth.organizationUid) configHandler.set("oauthOrgUid", auth.organizationUid);
    configHandler.set("authorisationType", "OAUTH");
    return;
  }

  if (auth.authtoken) {
    configHandler.set("authtoken", auth.authtoken);
    if (auth.email) configHandler.set("email", auth.email);
    configHandler.set("authorisationType", "BASIC");
    return;
  }

  // Refuse rather than proceed. With no credential written, the CLI would fall
  // back to whatever token a PREVIOUS export left in the shared store and export
  // as the wrong user.
  throw new Error("No Contentstack credential available for the CLI export.");
};
