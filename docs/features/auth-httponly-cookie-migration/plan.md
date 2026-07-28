# Migration Plan: localStorage JWT → httpOnly Cookie Auth

- **Status:** Draft / future work (do NOT start with the v3 build)
- **Author:** Ayush Sahu
- **Created:** 2026-07-28
- **Scope:** Auth transport only. Does not change *who* can log in or the JWT contents — only *how* the token is stored and transmitted.


## 1. Why (motivation)

The current scheme stores the JWT in `localStorage['app_token']` and sends it as a custom `app_token` header. This is portable and simple, but:

- **XSS-exposed:** any script on the page can read `localStorage` and exfiltrate the token. An httpOnly cookie is unreadable by JS.
- **Manual plumbing:** every request must remember to attach the header (v2 repeats this in ~every service).

An httpOnly + `Secure` + `SameSite` cookie removes the token from JS reach and is attached automatically by the browser.

## 2. Current state (baseline)

- **Login** writes the JWT to `localStorage['app_token']` (UI).
- **Every request** attaches `headers: { app_token: <jwt> }` (e.g. `ui/src/services/api/project.service.ts:8`).
- **API** validates via `const token = req.get("app_token"); jwt.verify(token, config.APP_TOKEN_KEY, …)` (`api/src/middlewares/auth.middleware.ts:20`) and attaches `req.body.token_payload`.
- **CORS** is wildcard: `cors({ origin: '*' })` (`api/src/server.ts:73`).
- **CSRF** is intentionally skipped — the code comment reasons "we've app_token for all the API calls, so we don't need CSRF token" (`api/src/server.ts:1`). **This assumption stops being true once we move to cookies** (see §5).

## 3. Target state

- Login sends `Set-Cookie: app_token=<jwt>; HttpOnly; Secure; SameSite=Lax; Path=/`.
- Browser auto-sends the cookie; UI uses `withCredentials: true`; no header, no localStorage.
- API reads the token from `req.cookies.app_token`.
- CORS allows explicit origin(s) with `credentials: true` (wildcard is illegal with credentialed cookies).
- CSRF protection is (re)introduced for state-changing requests.
- Auth *state* in the UI is derived from a session-check endpoint (the token is no longer JS-readable).

## 4. The three hard constraints (read before planning work)

1. **Wildcard CORS must go.** Browsers forbid credentialed cookies when `Access-Control-Allow-Origin: *`. We must replace `origin: '*'` with an explicit, configurable allow-list AND set `credentials: true`.
2. **Same-origin deployment is strongly preferred.** If the UI and API are served from the *same* origin (via a reverse proxy), `SameSite=Lax` "just works" and there are no third-party-cookie problems. If they stay cross-origin, we're forced into `SameSite=None; Secure`, which is subject to browsers' third-party-cookie deprecation and is fragile. **Recommendation: front both with one origin (reverse proxy) as part of this migration.**
3. **The token becomes invisible to JS.** An httpOnly cookie cannot be read by the UI, so `isAuthenticated` can no longer be computed from `localStorage`. The UI must learn its auth state from a server call (e.g. `GET /me`) or from a small non-httpOnly companion flag cookie.

## 5. CSRF (do not skip)

Once the browser auto-attaches the cookie, any site can trigger authenticated requests → CSRF risk that the current header scheme did not have. Mitigation (layered):
- Set `SameSite=Lax` (or `Strict` where UX allows) — blocks most cross-site sends.
- Add a CSRF token (double-submit cookie, or re-enable `csurf`) for all state-changing routes (POST/PUT/PATCH/DELETE).
- Keep `Secure` so the cookie is HTTPS-only.

## 6. Phased rollout

Each phase is independently shippable and backward-compatible until Phase 6.

### Phase 0 — Centralize auth (do this now, in v3)
- v3 **reads** the token in exactly one module (`ui/v3/auth/token.ts`) and attaches it in one axios interceptor (`ui/v3/auth/apiClient.ts`). No v3 feature/service code touches `localStorage` or headers directly — enforced by an ESLint `no-restricted-properties` rule scoped to `ui/v3/**`, with `token.ts` the sole exception.
- **v3 does NOT own the write.** The token is written by the shared **v2** login flow into `localStorage['app_token']`; v3 only consumes it. Phase 0 therefore shrinks v3's *own* Phase-4 surface to `token.ts` + `apiClient.ts` + the route guard, but it does **not** make Phase 4 v3-only — the login write lives in v2 and must change in lockstep (see Phase 4 and Q-4).
- **Why now:** it is the enabler and costs nothing today; it makes v3's part of Phase 4 a two-file change instead of a repo-wide edit.

### Phase 1 — Backend dual-read (non-breaking)
- Add `cookie-parser` to the API.
- Middleware reads the token from **either** source: `const token = req.cookies?.app_token ?? req.get("app_token");`
- Login endpoint **additionally** sets the httpOnly cookie (still returns the token in the body too).
- Result: old clients (header/localStorage) keep working unchanged; cookie path exists but isn't required yet.

### Phase 2 — Lock down CORS + origin
- Introduce `ALLOWED_ORIGINS` env var; `cors({ origin: allowedOrigins, credentials: true })`.
- Ideally introduce the reverse proxy so UI+API share an origin (enables `SameSite=Lax`).
- Verify existing header-based clients still pass (same-origin requests are unaffected).

### Phase 3 — CSRF protection
- Add CSRF tokens for state-changing routes; set `SameSite`.
- Update the server comment/assumption at `server.ts:1` (it will no longer be true).

### Phase 4 — Frontend switch (per app: v3 first, then v2)
- Set `withCredentials: true` on the axios instance; stop attaching the `app_token` header; stop writing `localStorage`.
- Replace `isAuthenticated` derivation: call `GET /me` (or read a companion flag cookie) instead of reading `localStorage['app_token']`.
- `PrivateRoute` guards via the session check, not storage.
- In v3, because auth is centralized (Phase 0), the switch touches only `apiClient.ts`, `token.ts`, and the route guard. **But the login WRITE lives in v2**, not v3 — so Phase 4 also edits v2's login flow (stop writing `localStorage['app_token']`, rely on the cookie set by the server) plus v2's own client and guard. v2 is migrated regardless (Q-4).

### Phase 5 — Logout
- Server clears the cookie: `Set-Cookie: app_token=; Max-Age=0; Path=/; HttpOnly`.
- Remove client-side `clearLocalStorage()` for the token.

### Phase 6 — Cleanup (breaking; only after all clients migrated)
- Remove the header fallback from the middleware.
- Remove all `getDataFromLocalStorage('app_token')` / header-injection code.
- Remove the token from the login response body.

## 7. Data / behavioral changes

- **Existing sessions:** users with only a localStorage token (no cookie) keep working through Phase 5 via the dual-read fallback; they receive a cookie on their next login. No forced logout until Phase 6. Optionally add a one-time "exchange" call that mints a cookie from a valid header token.
- **Auth state source of truth** moves from `localStorage` (Phase 0–3) to server session check (Phase 4+).

## 8. Risks & mitigations

- **R-1: Third-party-cookie deprecation** (if cross-origin) → deploy UI+API same-origin behind a proxy; use `SameSite=Lax`.
- **R-2: CSRF reintroduced** → §5 (SameSite + CSRF tokens). Highest-severity if forgotten.
- **R-3: Self-hosters must configure origins** → make `ALLOWED_ORIGINS` a documented env var with a sane default; fail loudly if unset in cookie mode.
- **R-4: Big-bang breakage** → the dual-read (Phase 1) + phased frontend switch (Phase 4) avoid a flag-day cutover; Phase 6 (removal) is last.
- **R-5: UI can't read auth state anymore** → add `GET /me` / companion flag cookie before Phase 4.

## 9. Rollback

- Phases 1–3 are additive; disable by feature flag / revert config (`origin: '*'`, stop setting cookie).
- Phase 4 (frontend) reverts by turning the interceptor back to header injection — trivial because auth is centralized.
- Do **not** run Phase 6 until confident; it is the only irreversible-without-redeploy step.

## 10. Open questions

- **Q-1:** Will UI and API share an origin (reverse proxy) or stay cross-origin? Determines `SameSite=Lax` vs `None; Secure`. — owner: Infra/Eng.
- **Q-2:** CSRF approach — `csurf` vs double-submit cookie? — owner: Eng.
- **Q-3:** Companion-flag-cookie vs `GET /me` for UI auth-state? — owner: Eng.
- **Q-4 (CLOSED):** v2 must be migrated too — it was never optional. v2 owns the shared login that writes `localStorage['app_token']`; the moment that login sets an httpOnly cookie instead of a JS-readable token (Phase 1/4), v2's own reads must switch in lockstep. There is no "cookies in v3 only" end state while v3 depends on v2's login. Consequence: Phase 4 spans both apps.

## 11. References

- `api/src/middlewares/auth.middleware.ts` — token validation (header today).
- `api/src/server.ts:1,73` — CSRF-skip comment and wildcard CORS (both change here).
- `ui/src/store/slice/authSlice.tsx` — current localStorage-derived auth state.
- `ui/src/services/api/*.service.ts` — current per-call header injection (the pattern v3 avoids).
