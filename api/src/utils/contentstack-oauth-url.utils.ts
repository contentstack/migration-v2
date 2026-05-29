/**
 * Contentstack OAuth docs use path-style authorize URLs, e.g.:
 * `{BASE_URL}/apps/{app_uid}/authorize?response_type=code&...`
 *
 * Hash-style URLs (`{BASE_URL}/#!/apps/{uid}/authorize?...`) are fragile when the user
 * is not logged in: the login redirect often drops the hash fragment, so after sign-in
 * Contentstack opens the default dashboard (e.g. stacks) instead of resuming authorization
 * and org selection. Normalizing to `/apps/.../authorize` preserves the full path across login.
 *
 * @see https://www.contentstack.com/docs/developers/developer-hub/contentstack-oauth/
 */
export function normalizeContentstackAuthorizeUrl(authUrl: string): string {
  if (!authUrl || typeof authUrl !== "string") {
    return authUrl;
  }
  return authUrl.replace(/\/#!\/apps\//, "/apps/");
}
