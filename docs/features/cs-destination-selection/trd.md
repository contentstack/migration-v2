# TRD: Contentstack Destination Selection (Content Map & Audit — Destination panel)

- **Slug:** `cs-destination-selection`
- **Related:** [feature.md](./feature.md) · [prd.md](./prd.md)
- **Status:** Draft
- **Tech lead:** Chirag Chavan
- **Engineers:** TBD
- **Created:** 2026-07-22
- **Last updated:** 2026-07-30

## 1. Overview

The Destination panel extends the v3 stack established by `cs-source-selection`: a `ui/v3` React surface (its own store slice, own service layer) and new `api/v3` endpoints for destination persistence. Per confirmed decision, it **reuses Source's already-built `/v3/source/regions`, `/v3/source/orgs`, and `/v3/source/stacks` endpoints** for its Region/Organization/existing-Stack dropdowns rather than duplicating them — this is v3-internal reuse between sibling features, not a violation of the v2-isolation rule (nothing here imports from `api/src`/`ui/src`). Creating a *new* stack, **creating a read/write management token on the destination stack**, branch mapping (now a single locked-source-branch row, not a repeatable list), language mapping (now a mandatory locked-master-locale row plus optional additional rows), fetching the destination stack's existing content stats (the "Stack contents" card), and persistence are all new, standalone code — none of these have a Source equivalent to reuse.

See [prd.md §1](./prd.md) and [feature.md §1](./feature.md).

## 2. Scope

- **In scope:** `ui/v3` Destination panel components + state; `api/v3` controllers/services/models for destination persistence, new-stack creation, management-token creation, and destination-stack content stats; reuse (not duplication) of Source's region/org/stack listing endpoints; the locked-source branch/master-locale mapping model; the persisted `destination` document shape.
- **Out of scope:** Source panel itself (`cs-source-selection`, already shipped separately); the Audit step; Content Mapping; running the actual migration; the step tracker; the shared login flow (reused as-is); the Phase 1–6 cookie migration ([../auth-httponly-cookie-migration/plan.md](../auth-httponly-cookie-migration/plan.md)).

## 3. Requirements traceability

| Spec ID | Tech ID(s) | Notes |
|---------|------------|-------|
| FR-1.1 / 1.2 | TR-2 | Reuses Source's region/org endpoints — no new backend |
| FR-1.3 (existing-stack list) | TR-2 | Reuses Source's stack-listing endpoint too |
| FR-1.3 ("Create a new stack" option) / 1.4 / 1.5 / 1.6 | TR-11 | New create-stack modal + new endpoint |
| FR-1.7 | TR-1 | Gating in the destination slice |
| FR-2.1–2.4 | TR-3 | Region re-authentication modal |
| FR-3.1 / 3.4 / 3.6 | TR-4 | Persistent method cards, immediate switching |
| FR-3.2 | TR-4 | Management-token-name field |
| FR-3.3 | TR-13 | New: create management token via API |
| FR-3.5 | TR-4 | Dismissible apps warning |
| FR-3.7 | TR-15 | New/shared: per-user/per-region Contentstack credential lookup |
| FR-9.1–9.3 | TR-12 | Single locked-source-branch + chosen-destination-branch row |
| FR-4.1 | TR-6 | Mandatory locked-master-locale row |
| FR-4.2–4.4 | TR-6 | Additional repeatable rows + summary count |
| FR-5.1 | TR-7 | Region-mismatch banner |
| FR-6.1–6.3 | TR-8 | Proceed gating |
| FR-7.1 | TR-1 | Covered by the same state that drives the form |
| FR-8.1 | TR-1, TR-9 | Standalone `/v3`, own model |
| FR-8.2 | TR-9 | Persistence endpoints |
| FR-8.3 | TR-10 | Reads Source's existing persisted-source endpoint (now also branch + master locale) |
| FR-10.1–10.4 | TR-14 | "Stack contents" card + new stats-fetch endpoint |

### Technical requirements

- **TR-1:** `ui/v3` Destination component + `destination.slice.ts` holding region/org/stack/importAuth/branchMapping/masterLocaleMapping/additionalLanguageMappings state, plus the live-updating summary and Proceed-gating derivation (FR-1.7, 7.1).
- **TR-2:** Destination's Region/Organization/existing-Stack dropdowns call Source's existing `GET /v3/source/regions`, `GET /v3/source/orgs?region=`, and `GET /v3/source/stacks?orgId=` — no new listing endpoints are built for Destination (FR-1.1, 1.2, 1.3's existing-stack half).
- **TR-3:** Region-switch login modal (Email/Password, gated Log in, revert-on-cancel) triggered when the Destination Region changes to an unauthenticated region (FR-2.1–2.4).
- **TR-4:** Import-authentication persistent method cards; selecting Management token reveals the token-name field plus a dismissible apps-cannot-install warning; selecting authToken reveals nothing; switching methods immediately discards the other method's entered name (FR-3.1, 3.2, 3.4, 3.5, 3.6).
- **TR-6:** Language mapping: a mandatory master-locale row (locked source master locale + chosen destination locale) plus zero or more additional repeatable rows (source-locale + destination-locale selects, add/remove without a minimum) (FR-4.1–4.4).
- **TR-7:** Region-mismatch banner computed by comparing `destRegion` to the persisted source's region (FR-5.1).
- **TR-8:** Proceed-gating logic combining local field completeness with the persisted source's readiness, re-evaluated live while the panel is open, not just on initial load (FR-6.1–6.3, EC-6). Clicking Proceed also orchestrates, for the Management-token method, calling API-3 (TR-13) before API-1 — a failure (including a name collision) blocks the persist-and-advance step — see §4 data flow.
- **TR-9:** New `api/v3` endpoints to persist and read back the `destination` selection on the v3 project document (FR-8.2).
- **TR-10:** Reuses Source's existing `GET /v3/org/:orgId/project/:projectId/source` endpoint to read the persisted source's readiness, region, **selected branch, and master locale** (FR-8.3) — no new backend read path, but this feature now depends on more fields from that same document than before.
- **TR-11:** "Create a new stack" modal (Stack name required, Stack description optional, Cancel/"Create stack" actions) + a **new** `api/v3` endpoint that creates the stack via the Contentstack Management API and returns its identity — this is new capability, not reused from Source (FR-1.3's create option, 1.4–1.6).
- **TR-12:** Branch mapping: a single row pairing the source branch (read-only, locked, from the persisted source via TR-10) with a selectable destination-branch dropdown — no add/remove controls (FR-9.1–9.3).
- **TR-13 (new):** A **new** `api/v3` endpoint that creates a management token (read/write scope) on the destination stack via the Contentstack Management API, given the entered name; invoked by the client when the user clicks "Proceed to content mapping" (resolved, feature.md Q-15), before the destination-persistence call (API-1); returns the token's identity/UID and its one-time secret. On a name collision, the endpoint returns 400 and the client shows an error without persisting or advancing (FR-3.3).
- **TR-14 (new):** "Stack contents" card: fetches the destination stack's existing content statistics via a **new** `api/v3` endpoint and renders either the empty-state message or a stat-tile grid (FR-10.1–10.4).
- **TR-15 (new):** A per-user/per-region Contentstack session-credential store: whenever a region-switch login (this feature's or Source's) succeeds, capture the resulting Contentstack `authtoken`/SSO `access_token` keyed by `(user_id, region)`, so a later step needing to authenticate as authToken against a given region can look it up instead of asking the user to sign in again. Mirrors v2's `getAuthtoken(region, user_id)`/`getAccessToken(region, user_id)` pattern conceptually, but MUST be a fresh, standalone v3 implementation (no import from `api/src`). **Ownership (built here vs. by `cs-source-selection` vs. as new shared v3 infrastructure) is unresolved — see TQ-19.** (FR-3.7)

## 4. Architecture

- **Components touched:** none in `api/src` or `ui/src` beyond what Source already added; v2 is untouched. Within `v3`, this feature calls Source's existing `source.controller.ts` listing handlers and its persisted-source read endpoint directly — a new, intentional coupling between two v3 sibling features (TC-1).
- **New components:**
  - `ui/v3/pages/Migration` (Destination step) + `ui/v3/components/destination/*` — the panel UI (owner: FE).
  - `ui/v3/store/slice/destination.slice.ts` — v3 destination state (owner: FE).
  - `ui/v3/services/api/destination.service.ts` — calls via `ui/v3/auth/apiClient`; also calls Source's existing `source.service.ts`-style region/org functions directly rather than re-implementing them (owner: FE).
  - `api/v3/routes/destination.routes.ts`, `controllers/destination.controller.ts`, `services/destination.service.ts` (persistence; and credential validation if TQ-1 resolves to "validate now") (owner: BE).
  - Additive `destination` sub-document on the existing v3 project model (owner: BE) — no new model file, extends what Source's T-2 already created.
  - A per-user/per-region Contentstack credential store (TR-15) — new model + service, whose ownership (Destination-owned, Source-owned, or new shared v3 infrastructure) is unresolved (TQ-19); described here assuming it's built as part of this feature until that's resolved.
- **Data flow (happy path):**
  1. UI loads Destination panel → `GET /v3/source/regions` (Source's existing endpoint) populates the Region dropdown.
  2. User picks a region → if unauthenticated for it, the region-switch modal runs (TR-3) → on success, `GET /v3/source/orgs?region=` (Source's existing endpoint) populates Organization.
  3. User picks an Organization → `GET /v3/source/stacks?orgId=` (Source's existing endpoint) populates the Stack dropdown with existing stacks. Either: (a) user selects an existing stack, or (b) user selects "Create a new stack" → the create-stack modal opens → on confirm, `POST /v3/destination/stacks` (new, TR-11) creates it and it becomes the selected Stack.
  4. Once a Stack is selected, UI fetches its existing content stats via `GET /v3/destination/stacks/:apiKey/stats` (new, TR-14) to render the "Stack contents" card.
  5. User selects "Management token" and enters a name — the token itself is not created here; creation is deferred to step 8 — or selects "authToken" (no field).
  6. UI reads the persisted source's state via `GET /v3/org/:orgId/project/:projectId/source` (Source's existing endpoint, now also returning the source's selected branch and master locale) to render the locked branch-mapping row (TR-12) and the locked master-locale row (TR-6), and to drive the Proceed gate (readiness) and the region-mismatch banner (region comparison).
  7. User chooses the destination-branch and destination-locale values for the locked rows, and optionally adds additional language-mapping rows.
  8. User clicks Proceed → if "Management token" is the chosen method, the UI first calls `POST /v3/destination/management-tokens` (API-3, TR-13) to create the token. On a name collision (400) or other failure, an error is shown and the flow stops here — nothing is persisted. On success (or if "authToken" was chosen), `PUT /v3/org/:orgId/project/:projectId/destination` persists the destination selection (API-1) → UI advances to the next step.
- **Data flow (error path):** any list/persist/create/fetch failure returns a typed error; UI clears loading state, shows the mapped message (EC-2–EC-14), and preserves the user's in-progress fields for retry.
- **Concurrency / ordering constraints:** region → org strictly ordered (mirrors Source's TR-3). The source-readiness check driving Proceed must be re-evaluated live while the panel stays open (EC-6) — exact mechanism (poll vs. one-time fetch vs. shared event) is TQ-4, not resolved here.

## 5. Data model

- **DM-1:** **v3 Project `destination` sub-document** — additive, sibling to Source's existing `source` sub-document on the same v3 project document (storage location follows whatever Source's TQ-2 resolves to). Shape (proposal, pending Content-Mapping sign-off, feature.md Q-11):
  ```
  destination: {
    region, orgId,
    stack: { apiKey, name, wasCreated: boolean, description? },
    importAuth: {
      method: 'management' | 'authToken',
      managementToken?: { name, uid, secretRef? }   // secretRef shape pending TQ-2 (feature.md Q-5); absent entirely for 'authToken'
    },
    branchMapping: { srcBranch, destBranch },        // singular — not a list; srcBranch mirrors the source's persisted branch, read-only in the UI
    masterLocaleMapping: { srcLocale, destLocale },  // srcLocale mirrors the source's persisted master locale, read-only in the UI
    additionalLanguageMappings: [{ srcLocale, destLocale }]
  }
  ```
  `stack.wasCreated` distinguishes a stack created via TR-11 from one the user picked from the existing-stack list (TR-2) — the Destination summary / resume (UC-5) logic doesn't need to care which, but audit logs (NFR-6) SHOULD record it.
  `branchMapping.srcBranch` and `masterLocaleMapping.srcLocale` are stored redundantly with Source's own persisted values at the time of setting, rather than re-read live on every access — TRD default; re-derive live instead if that turns out to be safer against drift (TQ-14).
  Exact secret-handling shape for the generated management token's `secretRef` (persisted-encrypted vs. request-scoped-only) is unresolved — see TQ-2 (feature.md Q-5). Migration: additive optional field — no backfill (new projects only).
- **`Source` entity (feature.md §10, read-only dependency): no schema change.** This feature does not own, extend, or write to Source's persisted document — it only reads it (DEP-1), now including its `branch` and master-locale fields, not just region/readiness/locale-list as before.
- **`DestinationStackStats` (read model, new)** — not persisted; fetched fresh per view via TR-14. Exact fields TBD (feature.md Q-18).
- **DM-2 (new): `RegionCredential`** — per-user/per-region Contentstack session credential (TR-15). Proposed shape: `{ userId, region, kind: 'authtoken' | 'sso_access_token', credentialRef, obtainedAt }` — the actual credential value's storage (plaintext vs. encrypted, TQ-2-adjacent) needs the same security care as the management token secret. Whether this lives in its own collection, on the v3 project document, or elsewhere entirely depends on TQ-19 (which feature/layer owns it).

## 6. API contracts

All under `/v3`, all require the `app_token` header, same as `cs-source-selection`.

### API-1: `PUT /v3/org/:orgId/project/:projectId/destination`
- **Purpose:** persist the destination selection.
- **Auth:** valid `app_token`.
- **Request:** the `destination` sub-object (DM-1, minus any server-owned fields).
- **Response (200):** `{ destination }`
- **Error cases:** 400 invalid selection · 401 unauthorized.
- **Idempotency:** yes — full replace of the project's `destination` sub-document.
- **Realizes:** FR-8.2, TR-9.

### API-2: `GET /v3/org/:orgId/project/:projectId/destination`
- **Purpose:** read the persisted destination selection (UC-5 resume).
- **Response (200):** `{ destination }`
- **Error cases:** 404 no destination persisted yet · 401.
- **Realizes:** FR-8.2, TR-9.

### API-3: `POST /v3/destination/management-tokens`
- **Purpose:** create a read/write management token on the destination stack, using the user-entered name (the "Management token" import-authentication path).
- **Auth:** valid `app_token`.
- **Request:** `{ stackApiKey, name }`
- **Response (201):** `{ uid, name, secret }` — `secret` is returned exactly once by Contentstack at creation time; the caller MUST capture it then (see TQ-2 for whether/how it's persisted afterward).
- **Error cases:** 400 name already exists on this stack (EC-13, resolved: return an error, no auto-suffix — the remaining open question, TQ-13, is narrowed to whether Contentstack rejects the duplicate natively or this endpoint must pre-check) · 401 unauthorized · 403 caller lacks permission to manage tokens on this stack · 502 Contentstack error.
- **Idempotency:** no — each call creates a new token, invoked by the client when the user clicks "Proceed to content mapping" (resolved, feature.md Q-15), before the destination-persistence call (API-1). Retry-safety after a timeout remains open — see TQ-9.
- **Realizes:** FR-3.3, TR-13.

### API-4 (new): `POST /v3/destination/stacks`
- **Purpose:** create a new stack in the given organization (the "Create a new stack" flow, TR-11) via the Contentstack Management API.
- **Auth:** valid `app_token`.
- **Request:** `{ orgId, name, description? }`
- **Response (201):** `{ apiKey, name, description? }` — the created stack's identity, used to set `destination.stack`.
- **Error cases:** 400 name already exists or invalid (EC-3, resolved: return an error, no auto-suffix — the remaining open question, TQ-12, is narrowed to whether Contentstack rejects the duplicate natively or this endpoint must pre-check) · 401 unauthorized · 502 Contentstack error.
- **Idempotency:** no — each call creates a new stack; the UI MUST NOT retry a failed create silently (a network timeout after Contentstack actually created the stack would otherwise risk a duplicate on naive retry — see TQ-9).
- **Realizes:** FR-1.4, FR-1.5, TR-11.

### API-5 (new): `GET /v3/destination/stacks/:apiKey/stats`
- **Purpose:** fetch the destination stack's existing content statistics for the "Stack contents" card (UC-9).
- **Auth:** valid `app_token`.
- **Response (200):** `{ isEmpty: boolean, stats?: [{ label, value }] }` — exact stat set TBD (feature.md Q-18).
- **Error cases:** 401 · 404 stack not found · 502 Contentstack error (EC-14).
- **Realizes:** FR-10.1–10.4, TR-14.

### Reused endpoints (NOT re-implemented here — owned by `cs-source-selection`)
- `GET /v3/source/regions` → `{ regions:[{uid,name}] }`
- `GET /v3/source/orgs?region=` → `{ orgs:[{uid,name}] }`
- `GET /v3/source/stacks?orgId=` → `{ stacks:[{apiKey,name}] }` — reused for the Stack dropdown's existing-stack list (FR-1.3).
- `GET /v3/org/:orgId/project/:projectId/source` → the persisted `source` document (readiness/`lastExport.status`, region, **selected branch**, **master locale**, locales) — **this feature's read of the source's branch, master locale, and locale list assumes they are present on that document; if `cs-source-selection`'s schema doesn't expose all of these, that's a gap to close jointly (see TRR-1). The branch field is already in Source's proposed schema; master locale is not yet confirmed there.**

### Events
None new. No long-running job exists on the Destination side; persistence is a synchronous PUT.

## 7. Integration points

- **INT-1 (DEP-1):** `cs-source-selection`'s persisted source + its region/org listing endpoints — we call (read-only) — contract owner: `cs-source-selection` (Ayush Sahu) — fallback: treat a missing/unready source as "not ready," disable Proceed — realizes DEP-1. **Schema not yet frozen on their side (their TQ-1) — see TRR-1.**
- **INT-2 (DEP-2):** the standalone `/v3` architecture and auth middleware already established — we reuse the pattern (own controller/model files, same middleware) — realizes DEP-2.
- **INT-3 (DEP-3):** Contentstack Management API — for org/region listing (via reused Source endpoints, not called directly by this feature), for **creating a management token** (API-3) on the destination stack, and for **fetching the destination stack's existing content statistics** (API-5) — contract owner: Contentstack — fallback: surface 401/502 as EC-4/EC-5/EC-14 — realizes DEP-3.
- **INT-4 (DEP-4):** design-system components (`Select`, `Input`, `Button`, `Badge`, `Toast`) consumed by `ui/v3` — realizes DEP-4.
- **INT-5 (DEP-5):** the (unspecified) Content Mapping feature will read this feature's persisted `destination` — bidirectional schema contract, sign-off TBD — realizes DEP-5.
- **INT-6 (DEP-6):** the real Audit step (Source → Audit → Destination) — no direct API/code integration exists between Audit and this feature; the relationship is purely about *when* this feature's Proceed gate should consider content "ready" (raw source export vs. Audit's reviewed output) — realizes DEP-6 by deferring the actual resolution to TQ-3, not by building an integration now.
- **INT-7 (DEP-7):** the (unspecified) Migrate step will consume the management token created by this feature (its identity, and its secret if persisted) — bidirectional schema contract, sign-off TBD once that step is specified — realizes DEP-7.
- **INT-8 (DEP-8):** the per-user/per-region Contentstack credential store (TR-15/DM-2) — likely a shared need with `cs-source-selection` (its own region-scoped Contentstack calls need the same lookup) — contract owner unresolved between the two features — realizes DEP-8 pending TQ-19.

## 8. Technology choices

- **TC-1:** **Reuse Source's region/org/stack listing endpoints rather than duplicate them** — chosen (confirmed decision, this session) because region/org/stack data is identical Contentstack-account data regardless of which panel asks for it; duplicating it would mean two implementations of the same Contentstack calls to maintain. Alternatives: separate `/v3/destination/regions`+`/orgs`+`/stacks` — rejected as pure duplication. (Stack *creation*, unlike listing, has no Source equivalent to reuse — it is new, TR-11.)
- **TC-2:** **No feature flag, gated by `/v3` route** — chosen (confirmed decision): matches Source exactly; this repo has no flag system. Alternatives: env flag — rejected for v1, same reasoning as Source.
- **TC-3 (superseded):** The original plan to defer import-credential *validation* to migrate-time no longer applies — the Management token path doesn't validate a user-supplied credential at all, it *creates* one (API-3). What remains open is the timing of that creation (TQ-9), not whether to validate something the user typed in.

## 9. Sequencing & phases

- **Phase 1 (backend spine):** TR-9 (persistence endpoints), TR-11's create-stack endpoint (API-4), TR-13's management-token creation endpoint (API-3), TR-14's stats endpoint (API-5) — unlocks save/resume, stack creation, token creation, and the stats fetch, testable without full UI. **Hard-blocked on `cs-source-selection`'s own T-3 (region/org/stack listing, and now also branch + master locale on the source document) actually being implemented — it is currently a `501 Not Implemented` stub** (see TRR-4).
- **Phase 2 (UI core fields):** TR-1, TR-2, TR-3, TR-4, TR-11 — unlocks region/org/stack entry (existing selection or creation) and import-authentication (UC-1 partial, UC-2, UC-3, UC-6, UC-7).
- **Phase 3 (branch + language mapping + gating):** TR-6, TR-7, TR-8, TR-12 — unlocks UC-4, UC-8, and full UC-1 gating. Both TR-6 and TR-12 now depend on Source exposing master locale/branch (Phase 1 blocker above).
- **Phase 4 (resume + stack contents):** full TR-9 read path wired into the UI, plus TR-14's Stack contents card — unlocks UC-5, UC-9.

## 10. Testing strategy

Test-cases skill generates detailed cases from feature.md ACs; this is the placement plan.

| AC ID | Test type | Test location | Notes |
|-------|-----------|---------------|-------|
| AC-1.1 | unit (component) | `ui/v3` destination component tests | Initial empty/disabled gating state |
| AC-1.2 | integration | `api/v3` destination persistence + component | Full happy-path persist |
| AC-1.3 | unit (component) | destination component | Gate stays disabled when source not ready |
| AC-1.4 | unit (component) | destination component | Cross-region banner shown on mismatch |
| AC-1.5 | unit (component) | destination component | Cross-region banner hidden on match |
| AC-2.1 | integration | region-switch modal + component | Modal opens on region change |
| AC-2.2 | integration | region-switch modal + auth | Valid login establishes session |
| AC-2.3 | unit (component) | region-switch modal | Cancel reverts region |
| AC-3.1 | unit (component) | import-auth component | Persistent two-card choice shown, Proceed disabled |
| AC-3.2 | unit (component) | import-auth component | Management token reveals the token-name field + apps warning |
| AC-3.3 | unit (component) | import-auth component | authToken reveals no field |
| AC-3.4 | unit (component) | import-auth component | Switching methods clears the other's entered name, no confirm step |
| AC-3.5 | integration | `api/v3` management-token endpoint (API-3) + component | Token created read/write with the entered name, triggered on Proceed |
| AC-3.6 | integration | `api/v3` management-token endpoint (API-3) + component | Name-collision error shown on Proceed; no token created, no advance |
| AC-4.1 | unit (component) | language-mapping component | Master-locale row shown with source locked + destination choice |
| AC-4.2 | unit (component) | language-mapping component | Zero additional rows shown by default |
| AC-4.3 | unit (component) | language-mapping component | "Add language" adds an additional row (src left, dest right) |
| AC-4.4 | unit (component) | language-mapping component | Removing the last additional row succeeds; master row unaffected |
| AC-5.1 | integration | `api/v3` destination persistence + component | Full restore after reload, incl. branch/master-locale/additional rows |
| AC-6.1 | integration | `api/v3` stack-listing (reused) + component | Existing stacks + "Create a new stack" option listed |
| AC-6.2 | unit (component) | destination component | Selecting existing stack sets it, no modal |
| AC-7.1 | unit (component) | create-stack modal | Modal opens, "Create stack" disabled until name entered |
| AC-7.2 | integration | `api/v3` create-stack endpoint (API-4) + component | Create → select → close modal |
| AC-7.3 | unit (component) | create-stack modal | Cancel creates nothing, selection unchanged |
| AC-7.4 | integration | `api/v3` create-stack endpoint (API-4) + component | Name-collision/invalid-name error shown; modal stays open, no stack created |
| AC-8.1 | integration | `api/v3` source-branch read (reused) + component | Single locked-source/chosen-destination branch row shown |
| AC-8.2 | unit (component) | branch-mapping component | No add/remove control present |
| AC-9.1 | integration | `api/v3` stats endpoint (API-5) + component | Stack name shown in "Stack contents" card |
| AC-9.2 | integration | `api/v3` stats endpoint (API-5) + component | Empty-stack message shown for an empty stack |
| AC-9.3 | integration | `api/v3` stats endpoint (API-5) + component | Stat tiles shown for a non-empty stack |

- **Fixtures / test data:** synthetic region/org/stack lists (reusing Source's existing test fixtures where possible), synthetic destination-stack stats (empty and non-empty cases), no PII, no real tokens or secrets. Mock Source's listing/persisted-source endpoints (INT-1, now including branch + master locale), the new create-stack endpoint (API-4), the new management-token endpoint (API-3, mocking Contentstack's returned secret — never a real one), the new stats endpoint (API-5), and the Contentstack Management API (INT-3).
- **Test-only hook:** a seed to pre-persist a `source` (ready) and a `destination` for UC-5/AC-5.1 without running a full export.
- **CI signal:** `api/v3` vitest unit+integration green; `ui/v3` component tests green (same `v3`-inclusion gap noted in `cs-source-selection`'s TRD applies here too — not yet wired into the vitest `include`).

## 11. Observability

- **Logs:** destination-configured, proceed-clicked, proceed-blocked (with reason), management-token-created (with `stackApiKey`, token `uid`, and `wasCreated` on the stack), and stack-created events, with `projectId` — **never** log the generated token's secret value, or any authToken session material. Level: info (configured/proceed/created), warn (blocked/failed). Via the existing v3 logger pattern.
- **Metrics:** counters — `v3_destination_configured`, `v3_destination_proceed_blocked` (label: reason), `v3_destination_stack_created`, `v3_destination_token_created`, `v3_destination_token_create_failed`. Wiring TQ — no metrics backend confirmed (same gap as Source).
- **Alerts:** none for v1.
- **Dashboards:** none for v1.
- **Traces:** none.

## 12. Security

- **Auth / authz:** every new `/v3` route behind the same standalone v3 auth middleware Source already established. No new scopes.
- **PII / secrets:** no user-supplied credential is entered on this panel anymore. The Management token *name* is not a secret. The Management token's *secret value*, returned once by Contentstack at creation (API-3), IS a secret — never logged, transmitted only over the authed channel. Whether it's persisted (encrypted) or kept request-scoped only is **TQ-2** — until resolved, this TRD assumes the more conservative option (not persisted in plaintext).
- **Threat model deltas:** this feature now **mints new write-access credentials on a customer's live stack on the user's behalf** (API-3) — a materially larger threat surface than accepting a pasted-in token. It MUST verify the authenticated user actually has permission to create management tokens on the target stack (via Contentstack's own authorization, not just a valid `app_token`). The create-stack endpoint (API-4) needs the equivalent check for `orgId`. Both endpoints should be treated as high-sensitivity mutating actions, not routine reads. If the generated secret ends up persisted (TQ-2), that's new high-value secret storage requiring encryption at rest and tightly scoped access — flagged in TRR-3. Separately, the per-user/per-region credential store (TR-15/DM-2) holds live Contentstack session credentials for potentially many regions per user — this needs the same encryption-at-rest and tightly-scoped-access treatment as any other stored secret, regardless of which feature ends up owning it (TQ-19).
- **Secret handling:** same `APP_TOKEN_KEY` mechanism as the rest of v3, unchanged.
- **Compliance:** none new (self-hosted).

## 13. Performance

References feature.md NFR-1/NFR-5.

- **Expected load:** low concurrency (self-hosted, few operators) — same profile as Source.
- **Hot paths:** the reused region/org/stack list calls (inheriting whatever caching Source's own TRD decides, §13 there); the new destination-stack stats fetch (API-5), which could be slow for a stack with a very large amount of existing content — no separate caching layer is introduced here for v1.
- **Load-test plan:** none beyond what Source's own plan already covers for the reused endpoints.

## 14. Rollout / feature flag

- **Flag name:** none (prd §9). Gated by the Destination UI route + its `api/v3` endpoints existing.
- **Default state at merge:** `api/v3` destination endpoints mounted but only reachable via the Destination panel route; Source and v2 flows unchanged.
- **Gated code paths:** `ui/v3/components/destination/**`, `ui/v3/store/slice/destination.slice.ts`, `api/v3/routes/destination.routes.ts` and its controller/service.
- **Config surface:** none new beyond what Source already introduced (optional future `VITE_ENABLE_V3`).
- **Per-stage flip:** manual — same mechanism as Source, since it's the same `/v3` surface.

## 15. Rollback plan

- **How to disable:** stop exposing the Destination panel's route and/or don't deploy its `api/v3` mount. Full revert = delete the destination-specific `ui/v3`/`api/v3` files; Source and v2 are untouched.
- **Data cleanup on rollback:** the `destination` sub-document (DM-1) is additive and optional on the v3 project record; leaving it is harmless.
- **What breaks if we rollback mid-flow:** a user mid-configuration loses any not-yet-persisted destination fields; already-persisted `destination` documents become dormant until the feature returns. Because this feature only *reads* Source's persisted data (never writes to it), rolling this feature back cannot corrupt or affect Source's data — nothing in Source or v2 breaks. **Important exception:** any stack already created via API-4 (TR-11), and any management token already created via API-3 (TR-13), before rollback are real, live artifacts in the customer's Contentstack organization — rolling back this feature does NOT delete or revoke either. Cleanup of orphaned stacks or tokens, if desired, is a manual/out-of-band action (including manually revoking any created token), not something this rollback plan automates.
- **Rollback SLA:** minutes — isolated surface behind one panel route, same as Source.

## 16. Risks & mitigations (technical)

- **TRR-1:** `cs-source-selection`'s persisted `source` schema (which this feature reads directly) is not yet frozen, and it's unconfirmed whether it will expose the source stack's locale list at all (needed for FR-8.3's language-mapping source-side options) — likelihood medium / impact high — resolve jointly with Source's owners before Phase 1 (their TQ-1, this feature's blocking dependency).
- **TRR-2:** Ambiguity on whether Proceed's gate should read raw source-export status or the (separate) Audit step's output (feature.md Q-1) could force rework of TR-8 if resolved late — likelihood medium / impact high — resolve before Phase 3.
- **TRR-3:** If the generated management token's secret ends up persisted (TQ-2), mishandling is a high-impact secret leak on a customer's live stack — likelihood medium / impact high — encrypt at rest if persisted; prefer request-scoped only if the v1 timeline allows. This risk is now about a *system-minted* write-access credential, which is a bigger blast radius than the previously-assumed user-pasted one.
- **TRR-4:** This feature's Phase 1 (TR-2, reusing Source's region/org/stack endpoints) is hard-blocked on those endpoints actually being implemented — they are currently `501 Not Implemented` stubs per `cs-source-selection`'s own TRD — likelihood high / impact high — sequence this feature's engineering start after Source's T-3 lands, not in parallel.
- **TRR-5:** The new create-stack endpoint (API-4) is non-idempotent and creates real infrastructure — a naive client retry after a timeout (the timeout itself not proving failure — the stack may have been created anyway) risks creating duplicate stacks; separately, with no rate-limiting a buggy or malicious client could spam stack creation in a customer's org — likelihood medium / impact medium — resolve retry-safety and any rate-limiting need before Phase 1 (TQ-9, TQ-11).
- **TRR-6 (new):** Creating a management token (API-3) is, like stack creation, a non-idempotent mutating call — a naive retry after a timeout could create duplicate tokens on the destination stack, and repeated token creation without cleanup could clutter the customer's stack with orphaned tokens over time — likelihood medium / impact medium — resolve retry-safety (TQ-9) and decide whether orphaned-token cleanup is needed before Phase 1.
- **TRR-7 (new):** The per-user/per-region Contentstack credential store (TR-15) is very likely needed by `cs-source-selection` too, for its own region-scoped listing calls — if built independently and inconsistently by both features, that's duplicated infrastructure holding the same class of sensitive credential in two places — likelihood medium / impact medium — resolve ownership (TQ-19) with Source's owners before either side builds it.

## 17. Task breakdown

- **T-1:** v3 project `destination` sub-document + persistence endpoints (API-1/API-2) — realizes TR-9 — M — depends on `cs-source-selection`'s T-2 (project model) existing.
- **T-2:** `ui/v3` destination slice + service scaffold, wired to Source's existing region/org endpoints — realizes TR-1, TR-2 — S — **depends on `cs-source-selection`'s T-3 being implemented (currently a stub — see TRR-4).**
- **T-3:** Region re-authentication modal — realizes TR-3 — M — depends on resolving whether this is a shared component with Source (feature.md Q-7).
- **T-4:** Import-authentication UI (persistent cards, token-name field, apps warning) — realizes TR-4 — M — depends on T-1.
- **T-5:** Language-mapping UI (mandatory master-locale row + additional rows) — realizes TR-6 — M — depends on T-1, and on `cs-source-selection` exposing master locale (TRR-1/TRR-4).
- **T-6:** Region-mismatch banner + Proceed gating (reads Source's persisted readiness/region live via its existing endpoint) — realizes TR-7, TR-8, TR-10 — M — depends on T-1, T-2, and `cs-source-selection`'s persistence endpoint being usable.
- **T-7:** Destination summary sidebar — realizes FR-7.1 — S — depends on T-3, T-4, T-5, T-9, T-10, T-11.
- **T-8:** Test suites (fixtures, mocks for INT-1/INT-3, AC placement per §10) — realizes all TRs — M — parallel with T-3…T-12.
- **T-9:** "Create a new stack" modal + create-stack endpoint (API-4), including name-collision/invalid-name error handling (feature.md EC-3, resolved) — realizes TR-11 — M — depends on T-2 (needs the existing-stack list to refresh after creation).
- **T-10:** Branch-mapping UI (single locked-source row) — realizes TR-12 — S — depends on T-1, and on `cs-source-selection` exposing the source's selected branch (TRR-1/TRR-4).
- **T-11 (new):** Management-token creation endpoint (API-3), including name-collision error handling (feature.md EC-13, resolved) + wiring it to the "Proceed to content mapping" action (feature.md Q-15, resolved: created on Proceed, before persistence) — realizes TR-13 — M — depends on T-9 (needs a selected/created Stack to create a token against) and T-6 (Proceed action/gating).
- **T-12 (new):** "Stack contents" card + stats endpoint (API-5) — realizes TR-14 — M — depends on T-9.
- **T-13 (new):** Per-user/per-region Contentstack credential store (TR-15) — realizes FR-3.7 — M — **blocked on resolving ownership with `cs-source-selection` first (TQ-19); do not build in parallel with a possible duplicate on their side.**

## 18. Open questions

- **TQ-1 (RETIRED — superseded):** The original question (validate credentials synchronously vs. defer to migrate-time) no longer applies — the Management token path doesn't accept a user-supplied credential to validate; it creates one (API-3). See TQ-9 for the question that replaces this in spirit (creation timing).
- **TQ-2 (REDEFINED):** Is the *system-generated* management token's secret (returned once by Contentstack at creation) persisted (encrypted) or request-scoped only? — owner: Eng/Security — needed by: T-1, T-11. (feature.md Q-5)
- **TQ-3:** Does Proceed's gate read the raw source-export status or the Audit step's output? — owner: Eng — needed by: T-6. (feature.md Q-1)
- **TQ-4:** Live re-check mechanism for source-readiness while the Destination panel is open (poll vs. event) to satisfy EC-6. — owner: Eng — needed by: T-6.
- **TQ-5:** Shared vs. duplicated region-switch login modal component between Source and Destination. — owner: Eng — needed by: T-3. (feature.md Q-7)
- **TQ-6 (RESOLVED):** Minimum language-mapping rows is resolved — the master-locale row is mandatory and separate; additional rows can be removed to zero. (feature.md Q-6)
- **TQ-7 (NARROWED):** Collision handling for an invalid/colliding new-stack name is resolved (error shown, no auto-suffix — feature.md Q-12). Remaining: exact Contentstack naming validation rules (character/length constraints) for the non-collision invalid-name case. — owner: Eng — needed by: T-9. (see also TQ-12 for the collision-detection-mechanism half)
- **TQ-8 (BLOCKING):** This feature's Phase 1/T-2 cannot land until `cs-source-selection`'s own T-3 (region/org/stack listing, plus branch + master locale on the source document) is implemented. — owner: Eng — needed by: Phase 1 start.
- **TQ-9:** Is stack creation (API-4) synchronous/blocking within the request, or does it need an async job like Source's export (TC-1 pattern there)? Also determines retry-safety (TRR-5). A parallel version of this question applies to management-token creation (API-3, TRR-6) — owner: Eng — needed by: T-9, T-11.
- **TQ-10 (RETIRED — moot):** Branch mapping no longer has a removable-row concept (EC-11); this question no longer applies. (feature.md Q-13, retired)
- **TQ-11:** Should the create-stack endpoint (API-4) and the management-token endpoint (API-3) be rate-limited or otherwise guarded against abuse, given both create real Contentstack infrastructure/credentials? — owner: Eng/Security — needed by: T-9, T-11. (ties to TRR-5, TRR-6)
- **TQ-12 (NARROWED):** The product/UX behavior for new-stack name collision is resolved (error shown, no auto-suffix — feature.md Q-12). Remaining: does Contentstack itself reject a duplicate name, or must this feature check first? — owner: Eng — needed by: T-9.
- **TQ-13 (NARROWED):** The product/UX behavior for management-token name collision is resolved (error shown, no auto-suffix, no reuse — feature.md Q-19). Remaining: does Contentstack reject a duplicate token name on the same stack, or must this feature check first? — owner: Eng — needed by: T-11.
- **TQ-14 (new):** Is `destination.branchMapping.srcBranch` / `masterLocaleMapping.srcLocale` stored as a snapshot at set-time, or re-derived live from Source's document on every read? A snapshot risks drift if the user changes their source branch/locale after configuring Destination. — owner: Eng — needed by: T-5, T-10.
- **TQ-15 (RESOLVED):** Management-token creation (API-3) is triggered on the user clicking "Proceed," before the destination-persistence call — not on name entry, not deferred to migrate-time. — owner: Eng — needed by: T-11. (feature.md Q-15)
- **TQ-16 (new):** Exact formula for the "Locales mapped" count (does the mandatory master-locale row count as 1, plus however many additional rows?). — owner: Eng/Design — needed by: T-5. (feature.md Q-16)
- **TQ-17 (new):** Does an unset destination choice on the master-locale row or the branch-mapping row actually block "Proceed to content mapping"? Neither is currently in TR-8's gating logic. — owner: Eng/Product — needed by: T-6. (feature.md Q-17)
- **TQ-18 (new):** Exact stat tiles for the "Stack contents" card (API-5's `stats` shape), and the UI fallback if the fetch fails (EC-14). — owner: Design/Eng — needed by: T-12. (feature.md Q-18)
- **TQ-19 (new, BLOCKING for T-13):** Is the per-user/per-region Contentstack credential store (TR-15/DM-2) already planned/built as part of `cs-source-selection`, should it be built fresh here, or should it be new shared v3 infrastructure? Building it twice independently is a real duplication risk (TRR-7). — owner: Eng (both features' tech leads) — needed by: T-13, and before either feature's Phase 1 if Source also needs it.

## 19. References

- [feature.md](./feature.md) · [prd.md](./prd.md)
- [`../cs-source-selection/feature.md`](../cs-source-selection/feature.md) · [`../cs-source-selection/trd.md`](../cs-source-selection/trd.md) — dependency + the endpoints this feature reuses.
- [../auth-httponly-cookie-migration/plan.md](../auth-httponly-cookie-migration/plan.md) — shared auth token contract this feature depends on.
- `https://claude.ai/design/p/132abb68-eaa7-494b-9820-3f9cf5fa6f15?file=Content+Map+and+Audit.dc.html` — design, page "Content Map and Audit", Destination panel (reference only, not mirrored locally).
