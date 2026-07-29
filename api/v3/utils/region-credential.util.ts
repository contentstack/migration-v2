import { HTTP_CODES } from "../constants/http.js";
import { TokenPayload } from "../services/csManagement.service.js";

/** Thrown when a source-region other than the session's home region is
 * requested without having completed that region's login first. */
export class RegionAuthError extends Error {
  status: number;
  constructor(message = "Sign in to this region before continuing.") {
    super(message);
    this.status = HTTP_CODES.UNAUTHORIZED;
    this.name = "RegionAuthError";
  }
}

/**
 * Resolves which Contentstack credential to use for a Source-panel call.
 *
 * - No explicit region requested → use the session's home-region credential.
 * - Explicit region === the session's home region → use the session credential
 *   (already authenticated via the app login).
 * - Explicit region !== the session's home region → the caller must have
 *   completed a region-login for it and supply the resulting `regionUserId`;
 *   otherwise this throws RegionAuthError (401), which the v3 error middleware
 *   surfaces to the client so the UI can open the region-login modal.
 */
export const resolveRegionCredential = (
  home: TokenPayload | undefined,
  region: string | undefined,
  regionUserId: string | undefined
): TokenPayload => {
  if (!region || region === home?.region) {
    return home ?? {};
  }
  if (!regionUserId) {
    throw new RegionAuthError();
  }
  return { region, user_id: regionUserId, is_sso: false };
};
