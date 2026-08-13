# TRD: Project deletion and unique project names

- **Slug:** `cs-project-lifecycle`
- **Related:** [feature.md](./feature.md) · [prd.md](./prd.md)
- **Status:** Draft
- **Engineering lead:** Chirag Chavan
- **Created:** 2026-08-12
- **Last updated:** 2026-08-12

## 1. Overview

Two additive changes inside `api/v3` and `ui/v3`. Deletion sets the existing `isDeleted`
flag on a project record and removes that project's export directory. Name uniqueness is a
scan over the caller's in-scope live projects performed inside `createV3Project` before it
writes. No new service, no new store, no schema migration.

The design leans almost entirely on machinery that already exists: `isDeleted` is a
required field the store's scope predicate already honours, `stackDataDir` already
sanitises and resolves the per-project export path, and `CreateProjectModal` already
renders an error prop. The genuinely new code is small; most of the work is guarding the
edges.

## 2. Scope

**In scope**

- `api/v3/models/project.store.ts` — a delete function, a uniqueness check inside
  `createV3Project`, and an `isDeleted` guard on four existing writers.
- `api/v3/controllers/project.controller.ts` — a delete handler; a 409 branch on create.
- `api/v3/routes/project.routes.ts` — one new route.
- `api/v3/services/export.service.ts` — a liveness re-check before the final rename and
  graph persist (FR-1.11).
- `ui/v3` — delete affordance on the project card, a confirmation dialog, the 409 message
  wired into the existing create-modal error slot, and the thunk/slice plumbing for both.

**Out of scope** — see [feature.md §5](./feature.md) and [prd.md §5](./prd.md). Notably:
no rename, no undo/trash surface, no retroactive de-duplication, no retention rule for
deleted records.

## 3. Requirements traceability

| Spec ID | Tech ID(s) | Notes |
|---------|------------|-------|
| FR-1.1 | TR-1, TR-9 | Store function + route/handler |
| FR-1.2 | TR-1 | Field write, not a record removal |
| FR-1.3 | TR-2 | Ordering is enforced in one place, in the service layer |
| FR-1.4 | TR-3 | Recursive removal of the resolved directory |
| FR-1.5 | TR-9 | Scope resolution happens in the controller, as every other project read does |
| FR-1.6 | TR-9 | 200 + JSON body; there is no `NO_CONTENT` constant in `v3/constants/http.ts` |
| FR-1.7 | TR-4 | Path built only via `stackDataDir`; containment asserted by test |
| FR-1.8 | TR-10 | Fixed classifications only through `v3Log` |
| FR-1.9 | — | **No code change** — the store's existing `inScope` predicate already excludes `isDeleted === true`. Stated as a requirement so it is covered by a test rather than assumed to stay true |
| FR-1.10 | TR-5 | Guard added to four writers, mirroring `setV3ContentTypeSelection` |
| FR-1.11 | TR-6 | Liveness re-check in the export job before its final writes |
| FR-2.1 | TR-11 | Card affordance |
| FR-2.2 | TR-12 | Dialog gate |
| FR-2.3 | TR-12 | Dialog content |
| FR-2.4 | TR-12 | Dialog copy |
| FR-2.5 | TR-12 | Cancel path issues no request |
| FR-2.6 | TR-13 | Refresh via the existing projects thunk |
| FR-2.7 | TR-13 | In-flight state on the confirm control |
| FR-2.8 | TR-13 | Failure keeps the row and surfaces the error |
| FR-3.1 | TR-7 | Uniqueness scan |
| FR-3.2 | TR-7 | Normalisation is case-fold + trim, comparison only |
| FR-3.3 | TR-7 | Scan filters to live projects |
| FR-3.4 | TR-8, TR-9 | Distinct 409 error carried to the handler |
| FR-3.5 | TR-8 | Throw before any write |
| FR-3.6 | TR-7 | Scan is scoped to region + owner |
| FR-3.7 | TR-7 | Enforced in the store, the layer no client can bypass |
| FR-4.1 | TR-14 | Existing `error` prop of `CreateProjectModal` |
| FR-4.2 | TR-14 | Modal must not reset its fields on error |
| FR-4.3 | TR-14 | Modal stays open |
| FR-4.4 | TR-15 | Client-side pre-check against the loaded list (P2) |

### Technical requirements

- **TR-1:** `project.store.ts` exposes a function that, given a project id, sets
  `isDeleted = true` and updates `updated_at`, using a **field-level assignment** on the
  found record — never a spread over the project — and throws a 404-shaped error when the
  id is unknown or the record is already deleted.
- **TR-2:** The delete flow performs the record write BEFORE the directory removal, and
  the directory removal failing does not roll the record write back. The two steps live in
  one place so the ordering cannot be reimplemented differently by a second caller.
- **TR-3:** The directory removal is recursive and tolerant of absence (`force`), so a
  project that was never exported deletes cleanly.
- **TR-4:** The directory path is obtained solely from `migrationData.util.ts`. Because
  `stackDataDir(projectId, stackId)` returns the per-STACK leaf, deletion needs the
  per-PROJECT parent; that parent must be derived through the same sanitising helper
  rather than by string-joining the project id onto the root. See TQ-1.
- **TR-5:** `upsertV3Source`, `setV3Graph`, `setV3AuditDecisions` and
  `setV3DestinationToken` each reject a project whose `isDeleted` is `true` with a
  404-shaped error, matching the guard `setV3ContentTypeSelection` already implements.
- **TR-6:** The export job re-checks that its project is still live immediately before
  finalising the export folder and before persisting the graph, and abandons both if it is
  not — leaving no folder behind.
- **TR-7:** `createV3Project` compares the requested name against the names of projects
  passing the same `inScope` predicate it already uses for reads, using a normalisation of
  `trim()` + case-fold, and tolerating records whose `name` is absent.
- **TR-8:** A uniqueness violation throws a 409-shaped error before any mutation of
  `db.data`, and no `db.write()` occurs on that path.
- **TR-9:** The controller resolves the project through the caller's scope before deleting,
  returns 404 for unknown/deleted/out-of-scope, 200 on success, and maps the store's
  409-shaped error to a 409 response on create.
- **TR-10:** Deletion emits exactly one `v3Log` line on success and one on failure,
  carrying identifiers, byte counts and fixed reason classifications only.
- **TR-11:** The project card renders a delete control.
- **TR-12:** A confirmation dialog gates the delete, names the project, states the
  consequence, and issues no request when cancelled.
- **TR-13:** The UI refreshes the project list after a successful delete, disables the
  confirm control while a delete is in flight, and on failure keeps the row and surfaces
  the error.
- **TR-14:** The create modal renders a 409 message through its existing `error` prop
  without resetting its fields or closing.
- **TR-15:** The create modal optionally pre-checks the typed name against the already
  loaded project list, using the same normalisation as TR-7.

## 4. Architecture

- **Components touched:** `project.store.ts` · `project.controller.ts` ·
  `project.routes.ts` · `export.service.ts` · `migrationData.util.ts` (read) ·
  `ProjectCard.tsx` · `CreateProjectModal.tsx` · the projects slice and thunks.
- **New components:** one confirmation dialog in `ui/v3/components/projects/`. No new
  service, store or util module on the server — everything lands in modules that already
  own the relevant concern.
- **Data flow (delete, happy path):**
  1. The operator activates the delete control on a project card.
  2. The UI opens the confirmation dialog with the project's name.
  3. On confirm, the UI issues `DELETE /v3/project/:projectId` with the session token.
  4. The controller derives the caller's scope from the token and resolves the project
     through the scoped read. A miss returns 404.
  5. The store sets `isDeleted = true` and `updated_at`, then writes.
  6. The export directory for that project is removed recursively.
  7. The handler responds 200; the UI re-fetches the project list.
- **Data flow (create with a duplicate name):**
  1. The operator submits the create form.
  2. The controller validates presence/length as it does today, then calls
     `createV3Project`.
  3. The store loads records, filters to the caller's scope and to live projects, and
     compares normalised names.
  4. On a match it throws a 409-shaped error before touching `db.data`.
  5. The controller responds 409; the modal renders the reason and keeps the fields.
- **Why the record write precedes the folder removal.** The reverse ordering has a
  failure mode with no acceptable end state: if the folder is removed and the record write
  then fails, the dashboard shows a live project whose export is gone — every downstream
  step would read an empty folder and the operator would have no indication why. Marking
  first means the worst case is an orphaned folder for a project already hidden, which
  costs disk and nothing else.

## 5. Data model

- **DM-1: `V3Project.isDeleted`** — no schema change. The field is already declared
  required and is present with value `false` on 17 of the 18 live records. This feature is
  the first writer. No migration and no backfill: `inScope` treats a missing flag as live
  (`p.isDeleted !== true`), which is the correct reading for a legacy record.
- **DM-2: export directory `exportData/<projectId>/`** — no stored schema; a filesystem
  entity whose lifecycle gains a delete. It contains the exported stack content, the
  downloaded asset binaries, and the audit findings cache (`audit.json`), all removed
  together.
- **DM-3: project name uniqueness** — **no persisted structure.** Deliberately not an
  index or a stored normalised key: at 18 records a linear scan is trivially fast, and a
  denormalised key would be a second source of truth that could disagree with `name` after
  any future rename. The rule is evaluated at write time from the records themselves.
- **Malformed records (EC-15, C-4).** One record (`demo-project`) carries only `id` and
  `created_at`. The uniqueness scan therefore MUST NOT assume `name` is a string, and the
  scope filter already excludes the record because `region` and `owner` are absent. This
  is a real row in the live store, not a defensive hypothetical.

## 6. API contracts

### API-1: `DELETE /v3/project/:projectId`

- **Purpose:** Delete one project and remove its exported content.
- **Auth:** Required — the same session-token guard the existing project routes use. The
  caller's region and owner are derived from the token, never from the request.
- **Request:** No body. `projectId` is the only input, from the path.
- **Response (200):**
  ```
  { deleted: true, id: string }
  ```
- **Error cases:**
  - `404` → unknown id, already-deleted project, or a project outside the caller's scope.
    The three are deliberately indistinguishable (FR-1.5).
  - `401` → missing or invalid session token, from the existing guard.
  - `500` → the record write failed. Note that a FOLDER-removal failure does **not**
    produce a 500: the record is already marked deleted by then, so the operation has
    succeeded from the operator's point of view and the residual orphan is logged
    (EVT-2), not surfaced as a failed delete. See TQ-2.
- **Idempotency:** No. A second delete of the same id returns 404, because the project no
  longer exists as far as any scoped read is concerned. Reporting 200 for a project this
  request did not delete would be a false success.
- **Realizes:** FR-1.1, FR-1.5, FR-1.6, TR-9.

### API-2: `POST /v3/project` (modified)

- **Purpose:** Unchanged — create a project. Gains one refusal.
- **Auth:** Unchanged.
- **Request:** Unchanged (`{ name, description? }`).
- **Response (200):** Unchanged.
- **Error cases:** existing `400` cases unchanged (name missing, >200 chars, leading
  whitespace) plus **`409` → a live project in the caller's scope already uses that name**
  (case-folded, trimmed). The 400 and 409 cases must stay distinct: "you must provide a
  name" and "that name is taken" are different problems and EC-10 requires they not be
  conflated.
- **Idempotency:** Still not idempotent for distinct names. For a REPEATED name it now
  behaves idempotently by refusing — which supersedes the note in
  `project.controller.ts` that "two identical requests create two projects, and v3 cannot
  delete either". That comment must be updated; it will otherwise contradict the code.
- **Realizes:** FR-3.1, FR-3.4, FR-3.6, TR-8, TR-9.

### Events

Delivery is a synchronous local log write through `v3Log`; there is no bus and no
subscriber, so delivery guarantees are "best-effort, in-process". Payload fields are
constrained by FR-1.8 — identifiers, booleans, numbers and fixed classifications only.

- **EVT-1:** `project.delete.succeeded` — `{ projectId, folderRemoved: boolean,
  bytesReclaimed: number, durationMs: number }` — emitted after both steps complete —
  consumed by: the operator reading server output.
- **EVT-2:** `project.delete.failed` — `{ projectId, reason: "not_found" |
  "folder_remove_failed" | "internal" }` — emitted when either step fails.
- **EVT-3:** `project.create.rejected` — `{ reason: "duplicate_name" | "name_required" |
  "name_too_long" }` — emitted when create is refused. Carries **no name**, which is the
  whole point: the rejected value is customer-adjacent content.

## 7. Integration points

- **INT-1:** `project.store.ts` — we call — contract owner: this feature — no latency SLA
  (local file I/O) — fallback: none; a store failure fails the request — realizes DEP-1.
- **INT-2:** `migrationData.util.ts` — we call — contract owner: the Source Export Revamp
  — realizes DEP-2. Load-bearing for security: its `safeSegment` sanitisation is what
  makes FR-1.7 hold. Note the shape mismatch flagged in TR-4/TQ-1: it exposes the
  per-stack leaf, and deletion needs the per-project parent.
- **INT-3:** `export.service.ts` — we call (a liveness check) and it calls us (the store's
  guards) — bidirectional — contract owner: the Source Export Revamp — realizes DEP-3.
- **INT-4:** `ProjectCard.tsx` / `ProjectsTopBar.tsx` — we modify — realizes DEP-4.
- **INT-5:** `CreateProjectModal.tsx` — we modify, additively: its existing `error` prop
  and `role="alert"` element already satisfy FR-4.1, so no new surface — realizes DEP-5.
- **INT-6:** `auditScan.service.ts` — no call in either direction; coupling only. Its
  findings cache lives inside the export folder and is destroyed with it. Recorded so the
  coupling is known rather than discovered — realizes DEP-6.

## 8. Technology choices

- **TC-1: Soft delete over hard delete.** Chosen because `isDeleted` already exists, is
  required on every record, and is already honoured by the store's scope predicate and by
  `setV3ContentTypeSelection`'s guard. A hard delete would discard that machinery and make
  the "cannot be resurrected by a later write" property unenforceable.
- **TC-2: Delete the export folder anyway.** Confirmed by the operator. It makes deletion
  effectively irreversible, which is why FR-2.4 requires the dialog to say so. The
  alternative — keep the folder — means disk grows without bound and a recreated project
  cannot reuse the orphan.
- **TC-3: In-store uniqueness, not a controller-level check.** The store is the only layer
  no client can bypass, and it is where the scope predicate already lives. A check in the
  controller would have to duplicate `inScope`.
- **TC-4: Case-fold + trim for comparison, store the name verbatim.** Comparison is
  normalised; the stored value is exactly what the operator typed. Never strip characters
  — that would mangle non-ASCII names (R-5).
- **TC-5: Accept the check-then-write race.** Confirmed by the operator. A mutex was
  considered (the pattern exists in `cliExport.service.ts`) and rejected: the window is
  the microtask gap between a scan and a write in a single-process local tool. Recorded as
  a residual risk (TRR-3) rather than engineered against.
- **TC-6: No feature flag.** No flag infrastructure exists in v3, and a flag would gate
  whether a button renders rather than de-risking the irreversible action behind a
  confirmation dialog. See [prd.md §9](./prd.md).

## 9. Sequencing & phases

| Phase | Work | Gate |
|-------|------|------|
| 1 | Paired tests for every automatable `AC-*` / `EC-*`, all red for the right reason | 1:1 pairing; failures are missing-behaviour, not typos |
| 2 | Store layer: delete function, uniqueness scan, the four `isDeleted` guards (TR-1…TR-8) | Store tests green |
| 3 | Route + controller: API-1, the 409 branch, logging (TR-9, TR-10) | Route tests green; full `api` suite green |
| 4 | Export-job liveness check (TR-6) | FR-1.11 tests green |
| 5 | UI: card control, dialog, refusal message, plumbing (TR-11…TR-15) | Full `ui` suite green |
| 6 | Consistency review against the Q-1 precedents; manual verification on real data | No hardcoded value where a token exists; a real export deleted and other projects intact |

Phases 2–4 land no user-visible change on their own, so they are safe to merge ahead of
the UI.

## 10. Testing strategy

Engineering placement plan. The `test-case` stage generates the detailed matrix from
[feature.md §11](./feature.md); this table says where each test lives.

All tests are **unit** tests under vitest, which is the only suite this repo runs
(`api/` and `ui/` each have their own `vitest.config.ts`). There is no e2e stage at this
point in the pipeline — Playwright is a separate, later concern.

| AC ID | Test type | Test location | Notes |
|-------|-----------|---------------|-------|
| AC-1.1 | unit | `api/tests/unit/v3/models/project.store.delete.test.ts` | Real temp dir via `V3_DATA_DIR` + `V3_MIGRATION_DATA_DIR`; a real file inside the folder so removal is observable |
| AC-1.2 | unit | `api/tests/unit/v3/models/project.store.delete.test.ts` | Asserted through `listV3Projects` |
| AC-1.3 | unit | `api/tests/unit/v3/models/project.store.delete.test.ts` | Asserted through `getV3Project` |
| AC-1.4 | unit | `api/tests/unit/v3/models/project.store.delete.test.ts` | Two projects, two folders — the isolation case |
| AC-1.5 | unit | `api/tests/unit/v3/routes/project.routes.test.ts` | 404 + store unchanged |
| AC-1.6 | unit | `api/tests/unit/v3/routes/project.routes.test.ts` | Out-of-scope project; the security case |
| AC-1.7 | unit | `api/tests/unit/v3/models/project.store.delete.test.ts` | No folder on disk |
| AC-1.8 | unit | `api/tests/unit/v3/models/project.store.delete.test.ts` | Folder removal made to fail; asserts the record is already marked |
| AC-1.9 | unit | `ui/tests/unit/v3/components/projects/DeleteProjectDialog.test.tsx` | Copy assertions |
| AC-1.10 | unit | `ui/tests/unit/v3/components/projects/DeleteProjectDialog.test.tsx` | Cancel issues no request |
| AC-1.11 | unit | `ui/tests/unit/v3/components/projects/DeleteProjectDialog.test.tsx` | Double activation → one request. Must land the second press while the first is in flight, not sequentially |
| AC-1.12 | unit | `ui/tests/unit/v3/pages/Projects.test.tsx` | Failure keeps the row |
| AC-1.13 | unit | `api/tests/unit/v3/models/project.store.delete.test.ts` | The four writers, one assertion each (FR-1.10) |
| AC-1.14 | unit | `api/tests/unit/v3/services/export.service.test.ts` | Extends the existing suite; mock the liveness read (FR-1.11) |
| AC-2.1 | unit | `api/tests/unit/v3/models/project.store.uniqueName.test.ts` | |
| AC-2.2 | unit | `api/tests/unit/v3/models/project.store.uniqueName.test.ts` | Case variant |
| AC-2.3 | unit | `api/tests/unit/v3/models/project.store.uniqueName.test.ts` | Whitespace variant |
| AC-2.4 | unit | `api/tests/unit/v3/models/project.store.uniqueName.test.ts` | The accepted case — guards against over-blocking |
| AC-2.5 | unit | `api/tests/unit/v3/models/project.store.uniqueName.test.ts` | Different scope accepted; the privacy boundary |
| AC-2.6 | unit | `ui/tests/unit/v3/components/projects/CreateProjectModal.test.tsx` | Extends the existing suite; fields retained |
| AC-3.1 | unit | `api/tests/unit/v3/models/project.store.uniqueName.test.ts` | Deleted name reusable |
| AC-3.2 | unit | `api/tests/unit/v3/models/project.store.uniqueName.test.ts` | Exactly one live project with the name |
| EC-15 | unit | `api/tests/unit/v3/models/project.store.uniqueName.test.ts` | Malformed record must not break the scan — seeded as `{ id, created_at }` only |

- **Fixtures / test data:** each store test points `V3_DATA_DIR` at a fresh temp dir and
  re-imports the module, following the pattern in the existing
  `project.store.*.test.ts` files. Folder-removal tests additionally point
  `V3_MIGRATION_DATA_DIR` at a temp dir and create real files, because the subject IS the
  filesystem effect — mocking `fs` would assert nothing. Names in fixtures are invented
  ("Migration Test"); no customer data.
- **Test-only feature flag or seed hook:** none. The two env vars above are the existing
  test seams.
- **CI signal:** `cd api && npx vitest run` and `cd ui && npx vitest run`, both fully
  green. Current baselines to beat: api 1293 / 115 files, ui 1212 / 64 files.
- **Deliberate non-coverage:** the check-then-write race (EC-11) has no automated test.
  Reproducing it requires interleaving two `db.read()`/`db.write()` cycles at a specific
  microtask boundary, and a test that forces that interleaving would assert the
  implementation's internals rather than its contract. Accepted per TC-5 and recorded as
  TRR-3 instead of covered by a misleading test.

## 11. Observability

- **Logs:** EVT-1, EVT-2 and EVT-3 (§6) through `v3Log`. Structured fields only —
  identifiers, booleans, numbers and fixed classifications. **Never** the project name,
  description, or the source stack api key (FR-1.8, NFR-6). The name is the specific trap
  here: it is the most natural thing to log on a delete and it is customer-adjacent
  content, which is why EVT-3 carries a reason code and no value.
- **Metrics:** none. There is no metrics backend; `bytesReclaimed` on EVT-1 is the
  quantitative signal for [prd.md §4](./prd.md) G-2 and is carried on the log line.
- **Alerts:** none. Single-user local tool with no pager destination. The operator reads
  server output directly.

## 12. Security

- **Authorisation:** API-1 sits behind the existing session-token guard, and the target is
  resolved through the caller's region+owner scope. Unknown, deleted and out-of-scope all
  return 404, so the response cannot be used to enumerate another operator's projects
  (FR-1.5, AC-1.6).
- **Path containment — the highest-impact concern in this feature.** Deletion is
  recursive, so a project id that escaped its directory would delete arbitrary
  directories. `projectId` is server-generated (`randomUUID`) today, but it arrives here
  as a URL path segment and must not be trusted on that basis. The path is therefore built
  only through `migrationData.util.ts`, whose `safeSegment` collapses separators and strips
  leading dots. FR-1.7 gets an explicit test asserting a malformed id cannot escape
  `exportData/`.
- **Information disclosure:** FR-3.6 requires that a name used in another scope be
  accepted, so the 409 cannot be used to probe for another operator's project names.
  EVT-3 logs no name.
- **Data destruction:** the folder removal is irreversible and is the one genuinely
  destructive operation added. It is gated by a confirmation dialog stating the
  consequence (FR-2.4), and it can only ever target the resolved per-project directory.

## 13. Performance

- **Deletion (NFR-1):** bounded at 30 s for a 160 MB / ~10,000-file folder. Recursive
  removal is I/O-bound; the bound exists so that a slow delete is treated as a defect
  rather than accepted. Node's recursive `rm` is used rather than a hand-rolled walk.
- **Uniqueness scan:** O(n) over records in scope, n = 18 today. The store already reads
  the whole file on every operation, so the scan adds no I/O — only a pass over an
  in-memory array. No index is justified at this size (DM-3).
- **Deleted-record accumulation:** each soft-deleted record stays in `projects.json`,
  which is read and rewritten whole on every store operation. At a few hundred bytes per
  record this is immaterial now; it is the reason PQ-2 exists.

## 14. Rollout / feature flag

No feature flag — see [prd.md §9](./prd.md) and TC-6. Hard flip on merge.

**Operational note:** the api server must be restarted to pick up the change.
`npm run dev` is `NODE_ENV=production tsx ./src/server.ts` with no watch, so a running
server keeps the old code and the delete route will 404. This has already caused one
false "it doesn't work" during the Source Export Revamp; it is recorded here so it does
not again.

## 15. Rollback plan

**Reverting the code is straightforward. Reverting the effects is not, and that asymmetry
is the honest headline.**

- **Code:** revert the changes to the five server files and the UI components. The new
  route disappears; create stops returning 409. Nothing else depends on either.
- **Data — irreversible:** every export folder deleted while the feature was live is
  gone. There is no backup and no trash. A rollback does **not** restore them; the
  affected projects must be re-exported from Contentstack. This is the direct consequence
  of TC-2 and is the reason FR-2.4 requires the dialog to say so.
- **Data — recoverable:** `isDeleted: true` records are still in `projects.json`. After a
  rollback the store's `inScope` predicate still filters them, so those projects stay
  hidden. Making them visible again means editing the JSON by hand — flipping the flag
  back to `false`. Worth knowing: **a rollback does not un-hide deleted projects**, so the
  dashboard after a revert looks like the dashboard before it, minus the deleted rows and
  their data.
- **Mid-flight:** if a delete is interrupted between the record write and the folder
  removal, the end state is a hidden project with an orphaned folder. That state is
  self-consistent and harmless; the folder can be removed manually. The reverse ordering
  would have produced a visible project with no data, which is why TR-2 fixes the order.
- **What does NOT need rolling back:** the uniqueness rule leaves no trace. It only ever
  refused writes, so there is no data to undo.

## 16. Risks & mitigations (technical)

- **TRR-1: Recursive deletion escaping the intended directory.** Likelihood low, impact
  catastrophic (arbitrary data loss). Mitigation: the path comes only from
  `migrationData.util.ts` (TR-4); an explicit test asserts a malformed project id stays
  inside `exportData/`. Note the shape mismatch in TQ-1 — the helper currently exposes the
  per-stack leaf, and reaching the parent by string manipulation would bypass the very
  sanitisation being relied on.
- **TRR-2: A spread over the project record destroying the write-only token secret.**
  Likelihood medium (it is the natural way to write the update), impact high and
  unrecoverable. `destinationToken.secretEncrypted` cannot be read back. Mitigation: TR-1
  mandates a field-level assignment, exactly as `setV3AuditDecisions` and
  `setV3ContentTypeSelection` already document for the same reason.
- **TRR-3: The check-then-write race on create.** Likelihood low, impact low (two live
  projects sharing a name — the state that exists today anyway). Accepted per TC-5,
  deliberately untested per §10.
- **TRR-4: A missed `isDeleted` guard on a future store writer.** Likelihood medium over
  time, impact medium (writing migration state to a deleted project). Mitigation: TR-5
  covers the four writers that exist; the deeper fix would be to make `requireProject`
  itself reject deleted records, which would cover every future writer by default — see
  TQ-3.
- **TRR-5: The uniqueness scan throwing on a malformed record.** Likelihood medium if
  unguarded — such a record exists in the live store right now. Impact high (create breaks
  entirely for everyone). Mitigation: TR-7 requires tolerating an absent `name`; EC-15 is
  tested with a `{ id, created_at }`-only fixture.
- **TRR-6: The export job's liveness check leaving a partial folder.** Likelihood low,
  impact medium. If the job abandons after the CLI has written the temp folder but before
  the rename, the temp folder remains. Mitigation: TR-6 must remove the temp directory on
  the abandon path, not merely skip the rename.

## 17. Task breakdown

Every `TR-*` is realized by at least one task.

| Task | Description | Realizes | Depends on |
|------|-------------|----------|------------|
| T-1 | Paired tests for the store's delete behaviour, including the four-writer guard and the folder-removal-failure ordering case | TR-1…TR-5 | — |
| T-2 | Paired tests for the uniqueness scan, including scope isolation, deleted-name reuse and the malformed record | TR-7, TR-8 | — |
| T-3 | Paired route tests for API-1 and the create 409 | TR-9 | — |
| T-4 | Paired tests for the export-job liveness check | TR-6 | — |
| T-5 | Paired UI tests for the dialog, the card control and the refusal message | TR-11…TR-15 | — |
| T-6 | Implement the store delete function with field-level assignment and the 404-shaped error | TR-1 | T-1 |
| T-7 | Implement the mark-then-remove ordering and the recursive, absence-tolerant removal | TR-2, TR-3 | T-6 |
| T-8 | Expose the per-project export directory through `migrationData.util.ts` and use it for the removal | TR-4 | T-1 |
| T-9 | Add the `isDeleted` guard to the four store writers | TR-5 | T-1 |
| T-10 | Implement the uniqueness scan inside `createV3Project`, tolerant of absent names | TR-7, TR-8 | T-2 |
| T-11 | Add the route, the delete handler, and the create 409 mapping | TR-9 | T-3, T-6, T-10 |
| T-12 | Add EVT-1/EVT-2/EVT-3 log lines with fixed classifications only | TR-10 | T-11 |
| T-13 | Add the export-job liveness check, including temp-folder cleanup on abandon | TR-6 | T-4 |
| T-14 | Build the confirmation dialog following the `ContentMappingPanel` precedent | TR-12 | T-5 |
| T-15 | Add the card delete control | TR-11 | T-5 |
| T-16 | Wire the delete thunk, list refresh, in-flight state and failure surfacing | TR-13 | T-14, T-15 |
| T-17 | Wire the 409 into the create modal's existing error slot without resetting fields | TR-14 | T-5 |
| T-18 | Optional pre-submit clash hint in the create modal (P2) | TR-15 | T-17 |
| T-19 | Update the stale TRR-2 comment in `project.controller.ts` that says v3 cannot delete | — | T-11 |

## 18. Open questions

- **TQ-1:** `migrationData.util.ts` exposes `stackDataDir(projectId, stackId)` — the
  per-STACK leaf. Deletion needs the per-PROJECT parent. Should the util gain a
  `projectDataDir(projectId)` that shares the same `safeSegment` sanitisation (preferred —
  it keeps one choke point), or should deletion derive the parent from a `stackDataDir`
  result? The second option means string-manipulating a path, which would bypass the
  sanitisation FR-1.7 depends on. — owner: Chirag Chavan — needed by: T-8.
- **TQ-2:** Should a folder-removal failure be visible to the operator at all? The API
  currently returns 200 (the record is marked, the project is gone from their view) and
  logs EVT-2. The alternative is a 200 with a warning field the UI surfaces, telling them
  disk was not reclaimed. — owner: Chirag Chavan — needed by: T-11.
- **TQ-3:** Should `requireProject` itself reject soft-deleted records, rather than each
  writer carrying its own guard? That would cover every future writer by default (TRR-4),
  but it changes the behaviour of five existing call sites at once, so it is a larger
  blast radius than this feature needs. — owner: Chirag Chavan — needed by: not blocking;
  T-9 implements the narrow version either way.
- **TQ-4:** Carried from [feature.md](./feature.md) Q-3 / [prd.md](./prd.md) PQ-1 — delete
  from the card only, or also from an opened project? Affects T-15's scope only. — owner:
  Chirag Chavan — needed by: T-15.

## 19. References

- [feature.md](./feature.md) — behavioural contract; source of all `UC-*`/`FR-*`/`AC-*`/
  `EC-*`/`NFR-*`/`DEP-*` IDs.
- [prd.md](./prd.md) — priorities, rollout, analytics events, post-launch criteria.
- `docs/features/cs-project-dashboard/trd.md` — the dashboard's own TRD, whose TRR-2
  ("v3 cannot delete") this feature supersedes; T-19 updates the corresponding code
  comment.
- `docs/plans/source-export-revamp.md` — establishes the
  `exportData/<projectId>/<stackApiKey>/` layout that makes a per-project delete possible,
  and the `safeSegment` sanitisation TRR-1 depends on.
- No design file, by decision. Visual precedents are named in [prd.md §7](./prd.md).
