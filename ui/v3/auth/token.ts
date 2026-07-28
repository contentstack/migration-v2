/**
 * v3 auth token module.
 *
 * This module owns every READ of the auth token in v3. `getToken` / `clearToken`
 * / `hasToken` are the only sanctioned way for v3 code to touch it, and an
 * ESLint rule (`no-restricted-properties` on `localStorage`, scoped to
 * `ui/v3/**`) makes this the single file permitted to reach `localStorage`
 * directly.
 *
 * It does NOT own the write. The token is written by the shared (v2) login flow
 * into `localStorage['app_token']`; v3 only consumes it. When we switch to
 * httpOnly cookies (docs/features/auth-httponly-cookie-migration/plan.md), the
 * write in v2's login has to move too — it lives outside v3, so that phase is
 * not contained to v3.
 *
 * Call `getToken()` at REQUEST time — it is invoked from the apiClient request
 * interceptor — and never cache its result in React context or Redux. If another
 * tab logs out and clears the key, the next request then sends no token and
 * correctly receives a 401; a cached copy would keep sending a dead token.
 *
 * Mechanism today: a JWT string in localStorage, sent as the `app_token`
 * header. No behavior change vs. v2 — same key, same header value.
 */

/** The localStorage key the shared (v2) login flow writes the JWT to. */
const TOKEN_KEY = 'app_token';

/**
 * Returns the current auth token, or null if it is absent, blank, or storage is
 * unavailable. `localStorage.getItem` returns `''` for a present-but-empty key;
 * we treat empty / whitespace-only as "no token" so callers never send an empty
 * `app_token` header. The stored value is returned verbatim when non-blank.
 */
export const getToken = (): string | null => {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (raw === null || raw.trim() === '') {
      return null;
    }
    return raw;
  } catch {
    // localStorage can throw in private mode / sandboxed iframes.
    return null;
  }
};

/** Removes only the auth token key — never touches other v2/v3 state. */
export const clearToken = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // no-op: storage unavailable
  }
};

/** True when a non-blank auth token is present. The one place v3 derives "logged in". */
export const hasToken = (): boolean => getToken() !== null;
