# TRD: CS→CS Project Dashboard

- **Slug:** `cs-project-dashboard`
- **Related:** [feature.md](./feature.md) · [prd.md](./prd.md)
- **Status:** Draft
- **Tech lead:** Chirag Chavan
- **Engineers:** Chirag Chavan
- **Created:** 2026-08-04
- **Last updated:** 2026-08-05

> **Revision 2026-08-05 — organization scoping removed.** A project belongs to a
> user in a region. Organization is no longer a record field, a scope dimension, or
> a URL segment anywhere in `api/v3`.
>
> This is net-simplifying. It **deletes** four things the previous revision needed:
> the client-side session slice that held the selected organization, the storage
> module that persisted it, the owner-and-region-only read variant that existed
> solely because one route lacked an `:orgId`, and the widening of the
> organizations endpoint. It **adds** one: a small user endpoint for the avatar.
>
> It also makes the change wider: removing the `/org/:orgId` segment touches route
> contracts owned by `cs-source-selection` and `cs-destination-selection`. See TRR-1.

## 1. Overview

Adds the two project-CRUD capabilities `api/v3` is missing — list and create — extends the `V3Project` record with the fields a list needs (`name`, `region`, `owner`, `isDeleted`, optional `description`), removes `org_id` from it, scopes both list and single reads by region + owner, removes the `/org/:orgId` segment from every v3 project path, and builds the `ui/v3` page that consumes them. Two derived pure functions replace stored state: the status badge and the resume step are both computed from a project's persisted `source` and `destination` documents rather than from a status column or a step pointer.

See [prd.md §1](./prd.md) for product framing and [feature.md §1](./feature.md) for the spec summary.

## 2. Scope

**In scope:**

- `api/v3`: `V3Project` type extension and the removal of `org_id`; new list and create store functions; three-way scoping of the existing single read; two new endpoints; a new user endpoint; creation logging; **the removal of the `/org/:orgId` segment from all four project-scoped route mounts**.
- `ui/v3`: a new project API service and user service, the projects page and its card / modal / state components, and three derived pure functions.
- **Edits to three already-shipped features**, each a consequence of the path change rather than opportunism:
  - `cs-source-selection` — its source persistence endpoints lose the organization segment, so its service, callers and tests change.
  - `cs-destination-selection` — same for its destination persistence endpoints, plus the removal of the `orgId` prop threaded into its panel.
  - `migration-wizard-chrome` — its `?orgId=` resolution and the `orgId` it threads into `useWizardSource` are deleted.
  - Both `source.controller` and `destination.controller` — their `getV3Project` call sites take the new three-way scope.

**Out of scope:**

- Organization scoping in any form — [feature.md §5](./feature.md). Not deferred; removed.
- Delete, rename, import and export. The `isDeleted` field is added (FR-9.5) but nothing sets it; the action itself is spec Q-6.
- Any analytics or telemetry client — [prd.md §10](./prd.md).
- Pagination and server-side search — spec Q-10.
- Dark mode — a v3-wide change, its own feature.
- A backfill or migration of pre-existing project records — resolved as "accept the loss" (spec Q-7, FR-9.14).
- Any change to `api/src` or `ui/src` beyond the single existing route mounts. v3 remains standalone (feature.md C-1).

## 3. Requirements traceability

Every `FR-*` from [feature.md §8](./feature.md) maps to one or more `TR-*`.

| Spec ID | Tech ID(s) | Notes |
|---------|------------|-------|
| FR-1.1, FR-1.6 | TR-10 | Top bar composition; the product name substitutes for the design's organization block |
| FR-1.2, FR-1.4, FR-1.5 | TR-10 | Avatar rendering and its fallback chain |
| FR-1.3 | TR-6 | Dedicated user endpoint |
| FR-2.1, FR-2.2, FR-2.3, FR-2.4, FR-2.5, FR-2.6, FR-2.7 | TR-10 | Title row, including the two conditional-render rules |
| FR-3.1 | TR-2, TR-5, TR-15 | Store filter, endpoint, client service |
| FR-3.2 | TR-10 | Mount-only effect with no reactive dependency |
| FR-3.3 | TR-10 | Two collections in page state — unfiltered and filtered |
| FR-3.4, FR-3.5, FR-3.6 | TR-10 | Grid rendering; no pagination is satisfied by omission |
| FR-4.1, FR-4.2, FR-4.3, FR-4.4, FR-4.7, FR-4.10, FR-4.12 | TR-11 | Card component |
| FR-4.5, FR-4.6 | TR-9, TR-11 | Date formatter, rendered in the card footer |
| FR-4.8, FR-4.9 | TR-8, TR-11 | Derived resume step, consumed on activation |
| FR-4.11 | TR-14 | Navigation target carries project + step only |
| FR-5.1, FR-5.2, FR-5.3, FR-5.5, FR-5.6 | TR-7 | Derived status — a pure function |
| FR-5.4 | TR-11 | Per-status icon lives with the badge rendering |
| FR-6.1, FR-6.2, FR-6.4, FR-6.6 | TR-13 | Client-side filter |
| FR-6.3 | TR-13 | Seeded from the `search` query parameter |
| FR-6.5 | TR-10 | Clear affordance on the search control |
| FR-7.1, FR-7.2, FR-7.3, FR-7.4, FR-7.5, FR-7.6, FR-7.7, FR-7.11, FR-7.13, FR-7.14 | TR-12 | Create modal: fields, validation, cancel, failure, visuals |
| FR-7.8 | TR-3, TR-5, TR-15 | Request body carries only name and description |
| FR-7.9, FR-7.10, FR-7.12 | TR-16 | Create orchestration: reset, navigate, single-flight guard |
| FR-8.1, FR-8.2 | TR-17 | Loading placeholders |
| FR-8.3, FR-8.4, FR-8.5, FR-8.6 | TR-17 | Two mutually exclusive empty states |
| FR-8.7, FR-8.8 | TR-17 | Error state and retry |
| FR-8.9 | — | No code change — a design sign-off obligation, tracked as [prd.md](./prd.md) PQ-1 |
| FR-9.1, FR-9.2, FR-9.3, FR-9.4, FR-9.5, FR-9.7, FR-9.8, FR-9.10 | TR-1 | Type and record shape, including the removal of `org_id` |
| FR-9.6 | TR-2 | The three-way list filter |
| FR-9.9 | TR-5 | Auth applied at the route mount, matching the existing v3 pattern |
| FR-9.11, FR-9.12 | TR-4 | Scoped single read; not-found rather than forbidden |
| FR-9.13 | TR-5, TR-15, **TR-18, TR-19, TR-20** | Path change across all four mounts and every client that builds them |
| FR-9.14 | TR-2, TR-4 | Satisfied by *not* adding a relaxation — asserted by test rather than by code |
| NFR-1, NFR-2 | TR-13, TR-10 | Client-side filter and a single mount-time request |
| NFR-3, NFR-4 | TR-5, TR-11 | Token-derived identity; text rendering of user-supplied strings |
| NFR-5, NFR-6 | TR-11, TR-10 | Keyboard operability, focus, text-first status |
| NFR-7 | TR-17 | Failure is not an empty list |
| NFR-8 | — | No code change — spec Q-12 |
| NFR-9 | TR-21 | Creation logging, excluding customer content |

### Technical requirements

- **TR-1:** Extend the `V3Project` type with `name: string`, `region: string`, `owner: string`, `isDeleted: boolean` as **required** fields and `description?: string` as optional, and **remove** the persisted `org_id` field. Required rather than optional is the enforcement mechanism for FR-9.10 — the compiler must refuse a record without them, so the side-effect creation paths in `upsertV3Source` / `upsertV3Destination` cannot produce one.
- **TR-2:** Add a list function to the v3 project store that returns only records matching all three of the caller's region, the caller's user id, and `isDeleted !== true`. The filter is a single predicate, not three chained optional checks, so a missing field fails the match rather than passing it.
- **TR-3:** Add a create function to the v3 project store. It accepts a name and an optional description, and assigns the id, region, owner, `isDeleted: false` and both timestamps itself. It must not accept any of those from its caller.
- **TR-4:** Change the existing single-project read to take the same three-way scope as TR-2 and to return "absent" rather than "denied" when the scope does not match. **There is exactly one read function** — the previous revision needed a second, owner-and-region-only variant because `GET /v3/source/:projectId/graph` carried no organization segment; with organization gone, that asymmetry and that variant are both deleted. Every existing call site — both the source and the destination controllers — is updated in the same change.
- **TR-5:** Add two project endpoints, and change all four project-scoped route mounts to drop their `/org/:orgId` segment. Authentication stays applied at the mount point rather than per route (matching the current v3 pattern, so no route can be added later without a guard). The caller's region and user id are read from the verified token only.
- **TR-6:** Add a user endpoint returning the authenticated user's first name, last name and email, for the avatar. Replaces the previous revision's approach of widening the organizations endpoint — **that widening is reverted**, which removes the breaking change to `cs-destination-selection` it created.
- **TR-7:** Add a pure function mapping a project to its derived status. Takes the project, returns one of three literal values. No store access, no network, no React. The `Completed` branch is implemented even though no input can currently produce it, so that adding a migration-completion signal later changes the input, not this function's shape.
- **TR-8:** Add a pure function mapping a project to the wizard route segment it should open at, expressed in `migration-wizard-chrome`'s step vocabulary rather than in a local copy of it. Same purity constraints as TR-7.
- **TR-9:** Add a date formatter producing a relative description under 7 days and an absolute `MMM D, YYYY` at or beyond it, with correct singular and plural forms. Must be deterministic under test — the current time is an argument, never read from the clock inside.
- **TR-10:** Build the projects page: top bar (product mark, product name, avatar), title row (disabled back control, heading, search, primary action), the reflowing card grid, and the conditional-render rules for the primary action. Holds the unfiltered and filtered collections separately (FR-3.3) and issues the list request once on mount (FR-3.2 / NFR-2).
- **TR-11:** Build the project card as a single activatable control carrying the name, the fixed source pill, the status badge and the footer date. Keyboard-operable with a visible focus indicator, and rendering all user-supplied strings as text.
- **TR-12:** Build the create-project modal: name and description fields with their length and leading-whitespace rules, a submit gated on validity, cancel via control / close / overlay creating nothing, and a failure path that keeps the modal open with input preserved. Visual treatment follows the existing v3 modals.
- **TR-13:** Implement search as a filter over the already-loaded collection, seeded from the `search` query parameter, treating a whitespace-only value as empty, and issuing no network request.
- **TR-14:** Have the page's navigation target contain the project id and the step segment only. No organization parameter is added, and none is preserved from an incoming URL.
- **TR-15:** Add a v3 project API service and a v3 user API service, both going through the existing shared API client so that token attachment and 401 handling are inherited rather than reimplemented.
- **TR-16:** Orchestrate the create flow: guard against a second submission while one is in flight, discard leftover wizard state on success, then navigate to the wizard's first step. The single-flight guard must not rely on the submit control's disabled state alone.
- **TR-17:** Build the loading placeholders and the three terminal states (first-run empty, search-empty, error-with-retry), with the mutual-exclusion rules from FR-8.6 expressed in one place rather than as independent conditions per state. A 401 must render neither an error nor an empty state.
- **TR-18:** Update `cs-source-selection`'s client service and its callers for the new source persistence paths. Its existing tests are the acceptance signal; no assertion about source behaviour changes.
- **TR-19:** Update `cs-destination-selection`'s client service, its thunk call sites, and the `orgId` prop threaded from `pages/Migration` into `DestinationPanel` — that prop is deleted, not defaulted.
- **TR-20:** Delete the wizard's organization resolution: the `?orgId=` read in `useWizardNavigation`, its preservation across step transitions, and the `orgId` argument threaded into `useWizardSource`. The 90 existing chrome tests are the acceptance signal.
- **TR-21:** Log project creation with the new project id, and never the name or description.

**Deleted by this revision, and listed so the removal is deliberate rather than incidental:** the client session slice holding the selected organization; the `ui/v3/storage/preferences` module and its ESLint `localStorage` allowlist entry; the organization-switch race guard in the project thunks; the owner-and-region-only store read; the widening of the organizations endpoint response.

## 4. Architecture

**Components touched:**

- `api/v3/models/types.ts` — the `V3Project` shape (TR-1).
- `api/v3/models/project.store.ts` — list, create, and the scoped single read (TR-2, TR-3, TR-4).
- `api/v3/controllers/` — a new project controller and a new user controller; edits to the source and destination controllers' single-read call sites (TR-4, TR-5, TR-6).
- `api/v3/routes/` and `api/v3/index.ts` — a new project route file, a new user route file, and the four mounts that lose their organization segment (TR-5).
- `ui/v3/pages/Projects/` — replaces the current placeholder (TR-10).
- `ui/v3/services/api/{source,destination,wizard}.service.ts` — paths and signatures (TR-18, TR-19, TR-20).
- `ui/v3/store/thunks/destination.thunks.ts` and `ui/v3/components/destination/DestinationPanel.tsx` — the `orgId` argument and prop are deleted (TR-19).
- `ui/v3/components/wizard/{useWizardNavigation,useWizardSource,WizardChrome}.ts(x)` and `ui/v3/pages/Migration/index.tsx` — organization threading deleted (TR-20).

**New components:**

- `ui/v3/services/api/project.service.ts` and `user.service.ts` (TR-15).
- A projects-component folder holding the card, the create modal, and the state components (TR-11, TR-12, TR-17).
- Three derived pure functions: status, resume step, date formatter (TR-7, TR-8, TR-9).
- A project store slice holding the unfiltered list and its flags.

**Data flow (happy path — list):**

1. The page mounts and dispatches the list thunk. No organization is read, resolved or supplied.
2. The client service issues `GET /v3/project` through the shared API client, which attaches the session token.
3. The route's mount-level guard verifies the token and attaches the decoded payload.
4. The controller reads the region and user id from the token and calls the store's list function.
5. The store applies the three-way predicate and returns the matching records.
6. The page stores the result as the unfiltered collection and derives the filtered collection from it and the current search text.
7. Each card renders its name, the fixed source pill, its derived status badge, and its formatted date.

**Data flow (happy path — create):**

1. The modal validates the name and description locally, then dispatches the create thunk.
2. The thunk's single-flight guard rejects a concurrent second call.
3. The client service posts only the name and the description to `POST /v3/project`.
4. The controller assigns the id, region, owner, `isDeleted: false` and timestamps, then calls the store's create function.
5. Creation is logged with the new project id only.
6. On success the thunk discards leftover wizard state and navigates to the wizard's first step for the new project.

**Data flow (error path):**

1. A failed list request leaves the unfiltered collection untouched and sets an error, so the page renders the error state rather than an empty list (NFR-7).
2. Retry re-dispatches the same thunk with no page reload.
3. A failed create leaves the modal mounted with its input intact and clears the single-flight guard.
4. A 401 on any request is handled by the shared API client — it clears the token and redirects — and the page renders **neither** an error nor an empty state, because "No projects yet" would be untrue on the way out.
5. A single read that fails the three-way scope returns "absent", which the caller surfaces as not found.

**Concurrency / ordering constraints:**

- **Create must be single-flight.** v3 has no delete, so a duplicate project is permanent. The guard cannot live in the submit control's disabled state, because two activations in the same tick both observe the pre-update value — the same failure mode already handled in the wizard's step gate.
- **The path change is atomic across client and server.** A client posting to `/v3/project` against a server still mounted at `/v3/org/:orgId/project` 404s, and vice versa. There is no compatibility window and no fallback — see §15.
- **TR-1's field removal must land with TR-2 and TR-4 in one deployment.** A store filtering on `region`/`owner` against records that have neither matches nothing.

## 5. Data model

Every entity in [feature.md §10](./feature.md) has an entry.

- **DM-1: Alter `V3Project`** (in `api/v3/models/types.ts`, persisted in the lowdb JSON store) — add `name: string`, `region: string`, `owner: string`, `isDeleted: boolean` (all required) and `description?: string`; **remove `org_id`**. **Migration: forward-only, no backfill.** Confirmed decision (spec Q-7): the store contains exactly one pre-existing record and it is knowingly abandoned rather than migrated. Backfill duration: n/a. The record remains in the file, inert and invisible; nothing deletes it. Note that removing the field is *simpler to roll back* than the previous revision's rename, because reverted code reading `org_id` finds it absent rather than finding two competing fields — see §15.
- **DM-2: derived project status** — no schema change. A pure function over `source` and `destination` (TR-7). Never persisted, so it cannot be stale, and `Completed` is currently unreachable by construction.
- **DM-3: derived resume step** — no schema change. A pure function over the same two sub-documents (TR-8). Deliberately not the stored `current_step` field v2 carries.
- **DM-4: user identity** — no schema change. Read through from the new user endpoint (TR-6) and held only for the lifetime of the page. Not persisted anywhere and not logged.

**Deleted from the previous revision's model:** DM-5, the client-side selected organization. There is no such value, and therefore no `localStorage` key and no storage module.

**Indexes:** none. The store is a lowdb JSON document scanned in memory; introducing an index would be premature at the project counts in question (spec Q-10 tracks when that stops being true).

## 6. API contracts

### API-1: `GET /v3/project`

- **Purpose:** list the caller's projects.
- **Auth:** required — valid `app_token`, verified at the route mount. Region and user id come from the token only, never from the request.
- **Request:** no body, no parameters. **There is no organization parameter of any kind** (FR-9.13).
- **Response (200):**
  ```
  { projects: Array<{
      id, name, description?, region, owner,
      isDeleted, created_at, updated_at,
      source?, destination?
    }> }
  ```
  `source` and `destination` are included because the client derives both the status badge and the resume step from them (TR-7, TR-8). Sending only a summary would force a second request per card.
- **Error cases:** 401 → token missing or invalid.
- **Idempotency:** yes, trivially — a read.
- **Realizes:** FR-3.1, FR-9.6, FR-9.9, FR-9.13, FR-9.14 · TR-2, TR-5.

### API-2: `POST /v3/project`

- **Purpose:** create a project.
- **Auth:** required, as API-1.
- **Request:**
  ```
  { name: string, description?: string }
  ```
  Any other field present in the body is ignored, not honoured — the id, region, owner, `isDeleted` and timestamps are server-assigned (FR-7.8).
- **Response (201):**
  ```
  { project: { id, name, description?, region, owner,
               isDeleted, created_at, updated_at } }
  ```
- **Error cases:** 401 → token missing or invalid. 400 → name absent, name longer than 200 characters, name beginning with whitespace, or description longer than 255 characters. Server-side validation duplicates the client's rules deliberately; the client's are an affordance, the server's are the contract. Whether a duplicate name is a 409 is TQ-1.
- **Idempotency:** **no.** Two identical requests create two projects. The single-flight guard is client-side (TR-16), and v3 has no delete, so this is the riskiest endpoint in the feature — see TRR-3.
- **Realizes:** FR-7.8, FR-9.1–FR-9.5, FR-9.9, FR-9.10 · TR-3, TR-5, TR-21.

### API-3: `GET /v3/user` — **NEW**

- **Purpose:** the authenticated user's display identity, for the avatar.
- **Auth:** required, as API-1.
- **Request:** no body, no parameters.
- **Response (200):**
  ```
  { user: { firstName?, lastName?, email? } }
  ```
  All three are optional because Contentstack does not guarantee them — SSO-provisioned users frequently have neither name (EC-16, EC-17, EC-18).
- **Error cases:** 401 → token missing or invalid. Any other failure is non-fatal to the page: the avatar falls back to its icon and the project list is unaffected, because the two are independent requests (EC-19).
- **Idempotency:** yes — a read.
- **Realizes:** FR-1.2–FR-1.5 · TR-6.

### API-4: `GET /v3/source/orgs` — **REVERTED to its original shape**

The previous revision widened this to `{ user, orgs }`. That widening is undone; it returns the bare organization array it always did. **Consequence:** the breaking change to `cs-destination-selection` that the previous revision's TRR-3 tracked no longer exists.

### API-5: project-scoped source and destination endpoints — **PATH CHANGE, breaking**

```
PUT  /v3/org/:orgId/project/:projectId/source        →  PUT  /v3/project/:projectId/source
GET  /v3/org/:orgId/project/:projectId/source        →  GET  /v3/project/:projectId/source
PUT  /v3/org/:orgId/project/:projectId/destination   →  PUT  /v3/project/:projectId/destination
GET  /v3/org/:orgId/project/:projectId/destination   →  GET  /v3/project/:projectId/destination
```

- **Request and response bodies are unchanged.** Only the path changes.
- **Owned by** `cs-source-selection` and `cs-destination-selection`; changed here under FR-9.13 because the segment existed only to identify a project by organization, which is no longer how a project is identified.
- **Breaking with no compatibility window:** the old paths stop resolving. Any bookmarked wizard URL carrying `?orgId=` still loads the page, but the parameter is simply ignored.
- **Realizes:** FR-9.13 · TR-5, TR-18, TR-19.

### API-6: single-project read — **MODIFIED, internal**

Not an HTTP endpoint. The store-level single read gains the three-way scope and returns "absent" on a scope miss (TR-4). Reached through the endpoints in API-5, whose external contracts are otherwise unchanged — but a request that previously succeeded for a project belonging to another user or region now returns not found.

- **Realizes:** FR-9.11, FR-9.12 · TR-4.

### Events

**None.** There is no event bus, message queue or analytics pipeline in this repository ([prd.md §10](./prd.md)). Project creation is recorded as a log line (TR-21), not as an emitted event.

## 7. Integration points

Every `DEP-*` in [feature.md §13](./feature.md) has an entry.

- **INT-1:** `migration-wizard-chrome` — **bidirectional.** We read its step vocabulary to express the derived resume step (TR-8), and we delete its organization resolution entirely (TR-20). Contract owner: `migration-wizard-chrome`. Latency SLA: n/a, in-process. Fallback: none needed — with no organization to resolve there is nothing to fall back to. Realizes DEP-1.
- **INT-2:** `cs-source-selection` — **bidirectional and breaking.** We read its persisted `source` document for the derived status and resume step, and we change its persistence route paths (API-5, TR-18). Contract owner: `cs-source-selection`. Fallback: an absent or unrecognised `source` yields `Draft` and the wizard's first step, never an error (FR-5.6). Realizes DEP-2.
- **INT-3:** `cs-destination-selection` — **bidirectional and breaking.** Same for the `destination` document and its persistence routes, plus the deletion of the `orgId` prop threaded into its panel (TR-19). Realizes DEP-3.
- **INT-4:** the v3 project store — **we call and we change.** New list and create functions plus the scoped single read (TR-2, TR-3, TR-4). Contract owner: this feature going forward. Fallback: none — the feature does not function without it. Realizes DEP-4.
- **INT-5:** the v3 project type — **we change.** TR-1. Blocking; the field removal must deploy atomically with the store changes. Realizes DEP-5.
- **INT-6:** the shared v3 API client — **we call.** Token attachment and the 401-clears-and-redirects behaviour are inherited, not reimplemented, which is what makes AC-6.3 hold without this page containing any auth logic. Contract owner: `ui/v3/auth`. Realizes DEP-6.
- **INT-7:** the Contentstack Management API user endpoint — **we call, via API-3.** Supplies the name and email. External contract we do not own and cannot version. Fallback: the avatar's fallback chain terminates in an icon (FR-1.4, EC-18), and a total failure of this call leaves the project list unaffected (EC-19). Realizes DEP-7.

## 8. Technology choices

- **TC-1: derive status and resume step rather than store them.** Chosen because a derived value cannot be stale, needs no new field, no write path and no update-on-every-transition, and because the wizard chrome already derives step completion the same way — so the codebase has one rule instead of two. Alternatives: a stored status column plus a stored `current_step`, as v2 does — rejected because v2's own status field is exactly the kind of value that drifts from reality when an update is missed. Accepted cost: a step the user merely visited without persisting anything is not resumable, and `Completed` is unreachable until a Migrate step exists. Confirmed decision (spec Q-2).
- **TC-2: `name`, `region` and `owner` required, not optional.** Chosen because optionality is the direct cause of the existing nameless, ownerless record — `upsertV3Source` creates a minimal project as a side effect, and optional fields let it. Required makes that a compile error. Alternatives: optional fields with runtime validation — rejected because runtime validation only fires on the paths someone remembered to add it to.
- **TC-3: no backfill; the pre-existing record is abandoned.** Chosen because there is exactly one such record, it holds no customer data, and a backfill cannot produce a truthful `owner` or `region`. Alternatives rejected: a one-off backfill script; treating a missing field as matching any value, which would permanently weaken a security filter for one development record. Confirmed decision (spec Q-7, FR-9.14).
- **TC-4: scope the single read in this feature, not a follow-up.** Chosen because filtering only the list would leave the URL as a bypass. Alternatives rejected: a second scoped read used only by new code, which leaves the unscoped one reachable; deferring, which would leave FR-9.11, FR-9.12, AC-3.7 and AC-3.8 unimplemented. Confirmed decision (spec Q-8). *Simplified by this revision: with organization gone there is one read function rather than two.*
- **TC-5: not-found rather than forbidden on a scope miss.** Chosen because "forbidden" confirms that a project with that id exists, which the caller is not entitled to know.
- **TC-6: remove organization from the project entirely, rather than keeping it as an unused field.** Chosen because a field nothing reads, filters or validates is dead weight that the next reader will assume is authoritative. Alternative: keep it informational to preserve the option of reintroducing organization grouping — rejected because reintroduction would need a migration regardless, and an unvalidated field rots. Confirmed decision (2026-08-05).
- **TC-7: drop the `/org/:orgId` segment from ALL project paths, not only the new ones.** Chosen because the alternative leaves two route shapes in one API that disagree about whether a project belongs to an organization, keeps the wizard supplying an orgId it no longer has a source for, and keeps TQ-2 open. Alternatives rejected: changing only the new project routes; keeping the segment and ignoring its value, which advertises a scope that does not exist. Accepted cost: three services, five call sites and four pre-existing test files change (TRR-1). Confirmed decision (2026-08-05).
- **TC-8: a dedicated `GET /v3/user` for the avatar.** Chosen because nothing else now fetches the user's name — the previous justification (the organization control needed that call anyway) no longer holds. Alternatives rejected: keeping the widened organizations endpoint and calling it solely to discard the organization list; dropping the avatar. Reverting the widening also removes a breaking change to `cs-destination-selection`. Confirmed decision (spec Q-5, re-resolved).
- **TC-9: no client-side session slice or preference storage.** With no organization to hold or persist, both are deleted rather than kept empty. Consequence: the `ui/v3/storage` module and its ESLint `localStorage` allowlist entry are removed, restoring `auth/token.ts` as the single file permitted to touch `localStorage`.
- **TC-10: no feature flag.** Chosen for consistency with all three sibling v3 features, and because this repository has no flag mechanism to use. Alternative: build the repository's first flag — rejected as disproportionate. See §14.

## 9. Sequencing & phases

Four phases. Two hard constraints drive the ordering: the field removal in TR-1 must deploy atomically with the store functions that read the new fields, and **the path change must land on client and server together** — there is no compatibility window.

- **Phase 1 (data + endpoints + paths):** TR-1, TR-2, TR-3, TR-4, TR-5, TR-6, TR-21 — unlocks a listable and creatable project on the server, verifiable by request alone. Must ship as one unit. This is also where the four route mounts lose their organization segment and where both existing controllers' read call sites change.
- **Phase 2 (client contracts):** TR-15, TR-18, TR-19, TR-20 — updates every client that builds a project-scoped URL, and deletes the wizard's organization threading. **Must deploy with Phase 1**, since the server paths have already changed. This is the phase that touches `cs-source-selection`, `cs-destination-selection` and `migration-wizard-chrome`.
- **Phase 3 (the page):** TR-7, TR-8, TR-9, TR-10, TR-11, TR-13, TR-14, TR-17 — unlocks the full read-only experience: list, search, card, badge, date, and all four states. This is the phase that makes v3 demoable.
- **Phase 4 (create + polish):** TR-12, TR-16, then the P2 group from [prd.md §6](./prd.md) — the avatar (FR-1.2–1.5) and the two search conveniences. Separable so the avatar, the sole reason for API-3, can be dropped late without unpicking anything else.

Phases 1 and 2 are a single deployment unit even though they are separate phases of work.

## 10. Testing strategy

Every `AC-*` from [feature.md §11](./feature.md) has a test type. The test-cases skill generates the detailed cases from feature.md; this is the placement plan.

Packages: `api` for store, controller and route tests; `ui` for slice, thunk, component and pure-function tests. Both use vitest. **Node 24 is required** — both suites fail at startup on Node 21, and the repository declares no `engines` field or `.nvmrc`.

| AC ID | Test type | Test location | Notes |
|-------|-----------|---------------|-------|
| AC-1.1 | unit | `ui` page test | Mocked list thunk returning 3 projects |
| AC-1.2 | unit | `ui` page test | Request pending — placeholders present, both empty states absent |
| AC-1.3 | unit | `api` store test | 4 records, one soft-deleted |
| AC-1.4 | unit | `api` store test | Records differing only by owner and by region |
| AC-1.5 | unit | `ui` card test | Asserts all four literal strings and the date form |
| AC-1.6 | unit | `ui` card test | Current time passed as an argument (TR-9) — no clock mocking |
| AC-2.1 | unit | `ui` page test | Asserts the filter result and that no request was issued |
| AC-2.2 | unit | `ui` page test | Case-insensitivity |
| AC-2.3 | unit | `ui` page test | Clearing restores the full collection |
| AC-2.4 | unit | `ui` page test | Router mocked with a `search` query parameter |
| AC-2.5 | unit | `ui` page test | Asserts the search-empty copy and the first-run state's absence |
| AC-3.1 | unit | `ui` card test | Destination persisted → Destination step |
| AC-3.2 | unit | `ui` card test | Nothing persisted → first step |
| AC-3.3 | unit | `ui` card test | Source export succeeded → Audit |
| AC-3.4 | unit | `ui` page test + `ui` wizard test | Asserts the navigation target carries no organization, and the wizard's reads are issued from the project id alone |
| AC-3.5 | unit | `ui` card test | Empty id → no navigation |
| AC-3.6 | unit | `ui` card test | Keyboard activation matches pointer activation |
| AC-3.7 | unit | `api` store test | Foreign-owner read → absent |
| AC-3.8 | unit | `api` store test | Foreign-region read → absent |
| AC-4.1 | unit | `ui` page test | Primary action opens the modal |
| AC-4.2 | unit | `ui` modal test | Empty name → no request |
| AC-4.3 | unit | `ui` modal test | 201-character name |
| AC-4.4 | unit | `ui` modal test | Leading-whitespace name |
| AC-4.5 | unit | `ui` modal test | 256-character description |
| AC-4.6 | unit | `ui` thunk test | Asserts the request body contains **only** name and description |
| AC-4.7 | unit | `ui` thunk test | Asserts wizard-state reset ordered before navigation |
| AC-4.8 | unit | `ui` modal test | Cancel → no request |
| AC-4.9 | unit | `ui` thunk test | Two submissions, one request — the single-flight guard |
| AC-4.10 | unit | `ui` modal test | Failure keeps the modal mounted with input intact |
| AC-5.1 | unit | `ui` page test | Zero projects → first-run state, not search-empty |
| AC-5.2 | unit | `ui` page test | Zero projects → no `New Project` control |
| AC-5.3 | unit | `ui` page test | Empty-state create control opens the same modal |
| AC-5.4 | unit | `ui` page test | One project → `New Project` present, first-run state absent |
| AC-6.1 | unit | `ui` page test | 500 → error state with retry; no placeholders, no empty state |
| AC-6.2 | unit | `ui` page test | Retry re-issues and renders results |
| AC-6.3 | unit | `ui` page test | 401 → neither an error state nor an empty state |

**Additional coverage this revision requires, beyond the ACs:** the new paths themselves. `api` route tests must assert that `GET /v3/project` and the four project-scoped endpoints resolve, and that the old `/v3/org/:orgId/...` paths no longer do — otherwise a stale mount would pass unnoticed.

- **Fixtures / test data:** project fixtures in each package's existing fixtures folder, covering: nothing persisted; source persisted and export succeeded; destination persisted; soft-deleted; foreign owner; foreign region; a 201-character name; a name with a leading space. No real customer data and no real Contentstack ids.
- **Mocks:** the shared API client at the service boundary for `ui` tests; the Contentstack Management API at the axios boundary for `api` tests. The router is mocked in `ui` tests so navigation assertions check the intended target rather than a real URL change.
- **Test-only seed hook:** none required. The store honours `V3_DATA_DIR`, so `api` tests isolate to a temporary directory.
- **CI signal:** both `api` and `ui` unit suites green, including the pre-existing tests in the three features this work edits — specifically the 90 `migration-wizard-chrome` tests, the `cs-source-selection` store and route tests, and the `cs-destination-selection` panel, thunk and route tests. These are the acceptance signal for [prd.md §11](./prd.md)'s regression guardrails.
- **Not in scope here:** Playwright / e2e specs are a separate stage.

## 11. Observability

- **Logs:**
  - Project creation — the new project id, at info level. **Never** the project name or description, which are customer-supplied content (NFR-9, TR-21). Note the previous revision also logged an organization id; there is no longer one.
  - Project list — no log line per request.
  - Scope misses on the single read — not logged as errors. A scope miss is the expected outcome for a foreign or soft-deleted project, so logging it would be noise, and logging the requested id would record something the caller is not entitled to.
- **Metrics, alerts, dashboards, traces:** none. There is no backend for any of them in this repository ([prd.md §10](./prd.md)).

This section is deliberately thin, and the thinness is the honest state of the repository rather than an omission. [prd.md](./prd.md) PQ-2 tracks whether v3 should acquire any of it.

## 12. Security

- **Auth / authz:** every project endpoint requires a valid `app_token`, enforced at the route mount rather than per handler (TR-5), which is the existing v3 pattern and means a route added later cannot accidentally be unguarded. The caller's region and user id are taken from the verified token only — never from the body, the query string or the path (NFR-3). No new scopes or roles.
- **Removing the organization segment does not weaken authorization**, and this is worth stating explicitly because a path losing a segment looks like a loss of specificity. It is not: organization was never an authorization dimension. The values that decide what a caller may see — region and owner — come from the verified token and always did. What the segment provided was a *client-supplied* value that the server had to be careful not to trust.
- **The main security change is TR-4.** The existing single-project read applies no scope at all today, so a kept URL is readable by any authenticated user. Scoping it (FR-9.11) and answering not-found rather than forbidden (FR-9.12) closes that. This is a fix to already-shipped behaviour that this feature absorbs.
- **PII handling:** the project name and description are customer-supplied and are rendered as text, never as markup (NFR-4). Neither is logged (TR-21). The user's own first name, last name and email are read for the avatar, held in memory for the lifetime of the page, never persisted and never logged (DM-4).
- **Threat model deltas:**
  - *New surface:* three endpoints. Mitigated by deriving region and owner from the token, so a caller cannot reach another user's projects by manipulating a path.
  - *New surface:* a create endpoint accepting free text. Mitigated by length limits enforced server-side as well as client-side, and by rendering as text on the way out.
  - *Removed surface:* the unscoped single read, and a client-supplied path parameter the server previously had to distrust.
  - *Not mitigated:* API-2 is not idempotent and v3 has no delete, so an attacker with a valid session can create unbounded projects. Accepted for an internal tool with authenticated-only access; recorded as TRR-3.
- **Secret handling:** no new secrets.
- **Compliance flags:** none. No new data category, no new residency surface.

## 13. Performance

References `NFR-1` and `NFR-2` from [feature.md §9](./feature.md).

- **Expected load:** single-digit concurrent users. Requests: one list request per page mount, one user request per page mount, one create per project. Dataset: tens of projects per user today; the growth rate is unknown, which is what spec Q-10 is about.
- **Hot paths / bottlenecks:**
  - The search filter runs on every keystroke over the full loaded collection. NFR-1 sets the bar at 200 projects within 100 ms. The risk is not the substring match but re-rendering 200 cards per keystroke — the card is the thing to profile.
  - The list endpoint scans the whole lowdb document in memory. Linear in total project count across all users, not just the caller's.
- **Caching strategy:** no caching of the project list — it is requested once per page mount and on explicit retry, which is a cache of exactly one entry with an explicit invalidation trigger. The user identity is held for the page's lifetime.
- **Load-test plan:** none. Formal load testing is disproportionate for single-digit concurrency. NFR-1's 200-project bar is verified by a component test with a generated fixture; how that measurement is taken reliably in CI is TQ-4.

## 14. Rollout / feature flag

- **Flag name:** **none.** This repository has no feature-flag mechanism, and all three sibling v3 features confirmed the same approach (TC-10, [prd.md §9](./prd.md)).
- **Default state at merge:** n/a. The gate is what is deployed and what is linked.
- **Gated code paths:** none behind a flag. The effective gates are the v3 projects route being linked as an entry point, and the endpoints being deployed.
- **Config surface:** the existing v3 environment variables only (`V3_DATA_DIR`, `VITE_BASE_API_URL`, `VITE_API_VERSION_V3`). This feature adds no new configuration, and **removes** one client-side storage key.
- **Per-stage flip mechanism:** manual — deploy, link the entry point. No percentage rollout and no cohort targeting, because there is no mechanism for either.

## 15. Rollback plan

- **How to disable:** revert the deployment — **client and server together**. There is no runtime toggle and, unlike the previous revision, no partial-rollback path.
- **This revision made rollback coarser, and that is the main cost of TC-7.** The previous plan kept `?orgId=` as a fallback, so the client and server could move independently. With the segment removed there is no such window: a client built for `/v3/project/:projectId/source` gets a 404 from a server still mounted at `/v3/org/:orgId/...`, and vice versa. Both must move in the same deployment, in both directions.
- **Data cleanup on rollback:** the `V3Project` change is **forward-only**, but cleaner to reverse than the previous revision's rename:
  1. **Removing `org_id` is asymmetric but harmless.** Reverted code reading `org_id` finds it absent and treats the project as org-less, which is exactly what the reverted `upsertV3Source` used to do when it created records. No record ends up with two competing fields, which the previous plan's rename would have produced.
  2. **Projects created through this feature become unreachable, not deleted.** They are valid records, but reverted code offers no list and no create, so the only way back to one is a saved URL — which the reverted, unscoped single read will serve.
- **What breaks if we rollback:**
  - **Any project-scoped request, if only one side is reverted.** This is the dominant failure mode and the reason Phases 1 and 2 are one deployment unit.
  - **The security property.** Reverting TR-4 restores the unscoped single read, reopening the URL bypass. Not a crash, but a silent regression that should be called out explicitly in any revert.
  - **Not affected:** the one pre-existing abandoned record; it is inert in every version.
- **Rollback SLA:** minutes, *provided both sides are reverted together*. There is no automated rollback; this is a manual redeploy of an internal tool.

## 16. Risks & mitigations (technical)

Spec-level risks are in [feature.md §15](./feature.md); product risks in [prd.md §13](./prd.md). Technical only here.

- **TRR-1:** **Removing the `/org/:orgId` segment changes route contracts in two shipped features**, so three services, five call sites, one component prop and four pre-existing test files change alongside this work. Likelihood: certain. Impact: medium. Mitigation: the change is mechanical — a URL loses a segment, so its builders lose a parameter — and touches no behaviour of either panel; those features' existing suites are the acceptance signal. Route tests must assert the old paths no longer resolve, so a stale mount cannot pass unnoticed.
- **TRR-2:** **Client and server must deploy together** (§15). A partial deployment 404s every project-scoped request. Likelihood: low with a single deployment unit, but the failure is total. Impact: high. Mitigation: Phases 1 and 2 ship as one unit; the route tests above are the pre-deployment check.
- **TRR-3:** **API-2 is not idempotent and v3 has no delete**, so any duplicate creation is permanent clutter. Likelihood: medium — double-clicks are ordinary. Impact: low individually, cumulative over time. Mitigation: the client single-flight guard uses synchronous state set before the await (TR-16), the same fix already applied in the wizard's step gate; AC-4.9 asserts one request from two submissions. Not fully mitigated — server-side idempotency is TQ-2.
- **TRR-4:** **Scoping the single read changes behaviour in two shipped features.** A request that previously succeeded can now return not found — correct, but it will look like a regression to anyone holding a URL for a project they do not own. Likelihood: medium. Impact: medium. Mitigation: both controllers' existing tests must stay green; the only URLs that break are ones that should never have worked.
- **TRR-5:** **The search filter re-renders every card on every keystroke.** NFR-1's 100 ms bar at 200 projects is about the render, not the match. Likelihood: medium at higher project counts. Impact: medium. Mitigation: keep the card cheap; the status and resume-step functions are pure and trivial by design. Measurement approach is TQ-4.
- **TRR-6:** **`isDeleted` is added but nothing sets it**, so the field is dead weight and the exclusion logic is untestable against real data. Likelihood: certain. Impact: low. Mitigation: test it with a fixture that sets the field directly; spec Q-6 tracks the action that would write it.
- **TRR-7:** **The avatar now costs a second request on page load.** Small, but it is a request the previous revision did not make. Likelihood: certain. Impact: low — it is independent of the project list, so a slow or failed user request delays and breaks nothing else (EC-19). Mitigation: fire it in parallel with the list request, never sequenced before it.

**Retired from the previous revision:** the risk that widening the organizations endpoint would break `cs-destination-selection`. That widening is reverted (API-4), so the risk no longer exists.

## 17. Task breakdown

Sequenced. Sizes are S / M / L relative to each other, not calendar estimates.

**Phase 1 — data + endpoints + paths**

- **T-1:** Extend the `V3Project` type with the four required fields and the optional description, and remove `org_id` — realizes TR-1 — S.
- **T-2:** Update both existing upsert paths so they can no longer create a record without the required fields — realizes TR-1 — M — depends on T-1.
- **T-3:** Add the list function with the three-way predicate — realizes TR-2 — S — depends on T-1.
- **T-4:** Add the create function with server-assigned fields — realizes TR-3 — S — depends on T-1.
- **T-5:** Scope the single read, delete the owner-and-region-only variant, and update both controllers' call sites and their tests — realizes TR-4 — M — depends on T-1.
- **T-6:** Add the project controller and route file; drop the organization segment from all four project-scoped mounts; add route tests asserting the old paths no longer resolve — realizes TR-5 — M — depends on T-3, T-4.
- **T-7:** Add the user controller, route and endpoint; revert the widening of the organizations endpoint — realizes TR-6 — S.
- **T-8:** Add creation logging — realizes TR-21 — S — depends on T-6.

**Phase 2 — client contracts** *(same deployment as Phase 1)*

- **T-9:** Add the client project service and user service — realizes TR-15 — S — depends on T-6, T-7.
- **T-10:** Update `cs-source-selection`'s service and callers for the new paths — realizes TR-18 — S.
- **T-11:** Update `cs-destination-selection`'s service, thunk call sites and the `orgId` prop threaded into its panel — realizes TR-19 — M.
- **T-12:** Delete the wizard's organization resolution and the `orgId` threaded into `useWizardSource`; keep the 90 chrome tests green — realizes TR-20 — M.

**Phase 3 — the page**

- **T-13:** Add the derived status and resume-step functions — realizes TR-7, TR-8 — S.
- **T-14:** Add the date formatter with the current time as an argument — realizes TR-9 — S.
- **T-15:** Build the project card — realizes TR-11 — M — depends on T-13, T-14.
- **T-16:** Build the loading placeholders and the three terminal states with their mutual-exclusion rule — realizes TR-17 — M.
- **T-17:** Build the page: top bar, title row, grid, and the mount-time list request — realizes TR-10, TR-14 — L — depends on T-9, T-15, T-16.
- **T-18:** Add search with URL seeding — realizes TR-13 — S — depends on T-17.

**Phase 4 — create + polish**

- **T-19:** Build the create modal with its validation and cancel behaviour — realizes TR-12 — M — depends on T-17.
- **T-20:** Add the create orchestration: single-flight guard, wizard-state reset, navigation — realizes TR-16 — M — depends on T-9, T-19.
- **T-21:** Add the avatar and its fallback chain — realizes TR-10 (avatar clauses) — S — depends on T-7, T-17.
- **T-22:** Add the search clear affordance — realizes TR-10 (FR-6.5) — S — depends on T-18.

Every `TR-*` is realized by at least one `T-*`: TR-1→T-1/T-2, TR-2→T-3, TR-3→T-4, TR-4→T-5, TR-5→T-6, TR-6→T-7, TR-7→T-13, TR-8→T-13, TR-9→T-14, TR-10→T-17/T-21/T-22, TR-11→T-15, TR-12→T-19, TR-13→T-18, TR-14→T-17, TR-15→T-9, TR-16→T-20, TR-17→T-16, TR-18→T-10, TR-19→T-11, TR-20→T-12, TR-21→T-8.

## 18. Open questions

- **TQ-1:** Should API-2 reject a duplicate project name with a 409, or permit duplicates as v2 appears to? If it rejects, the conflict needs user-visible copy. Carries feature.md Q-13 — owner: Chirag Chavan — needed by: Phase 1.
- **TQ-2:** Should API-2 support an idempotency key so a retried or duplicated request cannot create a second project server-side (TRR-3)? The client guard is not a complete answer, and v3 cannot delete the result — owner: Chirag Chavan — needed by: Phase 4.
- **TQ-3:** Should the user identity from API-3 be refetched on every page mount, or cached for the session? Refetching is simpler and always fresh; caching avoids a round trip on every navigation back to the page — owner: Chirag Chavan — needed by: Phase 4.
- **TQ-4:** How is NFR-1's "100 ms at 200 projects" measured reliably? A wall-clock assertion in a unit test is flaky in CI, so this may need to be a manual check or a dropped threshold rather than an automated gate (TRR-5) — owner: Chirag Chavan — needed by: Phase 3.
- **TQ-5:** At what project count does the in-memory full-document scan in the list endpoint, or the client-side filter, need replacing (spec Q-10, §13)? Answerable with data after 90 days per [prd.md §11](./prd.md) — owner: Chirag Chavan — needed by: post-launch.
- **TQ-6:** Which browsers and versions must the page support (feature.md NFR-8, Q-12)? — owner: Chirag Chavan — needed by: launch.

**Retired from the previous revision:** the question of what the page shows when the user belongs to no organizations (it no longer reads organizations), and the question of when to remove the `?orgId=` fallback (there is no fallback — the parameter is deleted).

## 19. References

- [feature.md](./feature.md) — the spec, revised 2026-08-05; the `UC-*`/`FR-*`/`AC-*`/`EC-*`/`NFR-*`/`DEP-*` contract this TRD traces.
- [prd.md](./prd.md) — priorities (§6), rollout staging (§9), and the reasoning behind the absent analytics section (§10).
- Claude Design project `132abb68-eaa7-494b-9820-3f9cf5fa6f15`, page **"CS to CS Dashboard"** — the page being implemented; its organization block is deliberately not implemented (spec Q-16). Reference only.
- [../migration-wizard-chrome/trd.md](../migration-wizard-chrome/trd.md) — its TQ-2 (`?orgId=`) is closed by deletion here; its step definitions are the vocabulary TR-8 targets.
- [../cs-source-selection/trd.md](../cs-source-selection/trd.md) — owns the source persistence routes changed by API-5 and the `source` document read by TR-7 and TR-8.
- [../cs-destination-selection/trd.md](../cs-destination-selection/trd.md) — owns the destination persistence routes changed by API-5 and the `destination` document.
- `api/v3/models/project.store.ts` · `api/v3/models/types.ts` — the store and type this feature extends.
- `api/src/services/projects.service.ts` · `ui/src/pages/Projects/index.tsx` · `ui/src/components/Card/index.tsx` — v2's equivalents. Note v2 scopes projects by organization and this feature deliberately does not, so v2's four-way filter is prior art for the shape but not for the dimensions. Reference only; v3 imports nothing from v2.
