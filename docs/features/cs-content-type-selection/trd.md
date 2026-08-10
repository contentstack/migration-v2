# TRD: Content mapping — content type selection

- **Slug:** `cs-content-type-selection`
- **Status:** Draft
- **Author:** Chirag Chavan
- **Created:** 2026-08-10
- **Last updated:** 2026-08-10
- **Spec:** [feature.md](./feature.md)
- **Product doc:** [prd.md](./prd.md)

## 1. Overview

Two server responsibilities and one client panel.

The server derives a **content type inventory** from the project's export on disk — uid, title, and the set of content type uids each one references — and separately reads the **destination stack's content type uids** using the stored management token, marking which source uids already exist there. Both are returned in one response. The server also persists the operator's **selection and conflict modes** onto the project record.

The client renders the list, holds the working selection in memory, and answers the untick-confirmation question locally against the reference graph it was given. Nothing is written until the operator saves or advances.

## 2. Scope

**In scope (code):**
- A new `api/v3` service that reads `content_types/schema.json` from the export directory and derives the inventory plus the reference graph.
- Extension of the existing `csManagement.service` usage to read destination content types for a project (the CMA call itself already exists).
- A new `api/v3` controller and routes: one read, one write.
- A new optional `contentTypeSelection` field on the v3 project record, with a field-level setter and getter in `project.store`.
- A new `ui/v3` panel, Redux slice, thunks and API service for the Content mapping step.
- One string change in the shared wizard step definition: `content-mapping.actionLabel` → `Move to review`.

**Out of scope (code):** everything in [feature.md §5](./feature.md). Specifically no field mapping, no entry selection, no writes to the destination stack, and no dependency auto-resolution.

**Explicitly unchanged:** `api/src`, `ui/src`, and every v2 path. C-1 holds — this feature mounts only through the existing `/v3` router and `/v3/*` route seams.

## 3. Requirements traceability

| FR | TR | Notes |
|---|---|---|
| FR-1.1, FR-1.2 | TR-1 | Inventory read from the export directory |
| FR-1.3, FR-1.4, FR-1.5, FR-1.6 | TR-2 | Reference graph, recursive, multi-target, self-edge excluded |
| FR-2.1 | TR-3 | Destination content types via CMA with the stored token |
| FR-2.2, FR-2.3 | TR-4 | Exact, case-sensitive uid match |
| FR-2.4 | TR-5 | Degraded response when the destination read fails |
| FR-3.1, FR-3.2, FR-3.3, FR-3.6, FR-3.7, FR-3.9 | TR-6 | Client-side paging over the full list |
| FR-3.4, FR-3.5, FR-3.8, EC-15 | TR-7 | Client-side literal, case-insensitive title search |
| FR-4.1, FR-4.2, FR-4.7 | TR-8 | Working selection as a uid set |
| FR-4.3, FR-4.4, FR-4.5, FR-4.6 | TR-9 | Select-all, scoped to the active search |
| FR-5.1, FR-5.2, FR-5.3, FR-5.4 | TR-10 | Conflict control visibility rules |
| FR-5.5, FR-5.6, FR-5.8 | TR-11 | Conflict mode lifecycle, defaulting to `source` |
| FR-5.7 | TR-12 | Conflict decisions never gate the advance |
| FR-5.9 | TR-13 | Per-option explanation copy |
| FR-6.1, FR-6.2, FR-6.3 | TR-14 | Reverse-edge lookup and the confirmation dialog |
| FR-6.4, FR-6.5, FR-6.6, FR-6.7, FR-6.8 | TR-15 | Confirm/cancel semantics and suppression rules |
| FR-7.1, FR-7.2, FR-7.3, FR-7.4 | TR-16 | Disabled drill-in affordances |
| FR-8.1, FR-8.2, FR-8.3 | TR-17 | Status line published through the step gate |
| FR-8.4, FR-8.5 | TR-18 | Chrome owns the footer; step label changes |
| FR-8.6, FR-8.7 | TR-19 | Save-then-advance gate |
| FR-9.1, FR-9.2, FR-9.8 | TR-20 | Panel save control |
| FR-9.3, FR-9.4, FR-9.9 | TR-21 | Field-level persistence on the project record |
| FR-9.5, FR-9.6 | TR-22 | Hydration and pruning of a stale selection |
| FR-9.7 | TR-23 | Failed persist leaves the working selection intact |
| NFR-3, NFR-4 | TR-24 | Session, project scoping, token never leaves the server |
| NFR-9 | TR-25 | Structured logging with fixed failure classifications |
| EC-1, EC-2, EC-3 | TR-26 | Missing / unreadable / empty export states |

Every `FR-*` maps to at least one `TR-*`. No requirement is marked "no code change".

## 4. Architecture

**Server.** A read path and a write path, both behind the existing `/v3` router and its session guard.

The read path resolves the project, derives the export directory from the project's stored source stack api key (never from a client-supplied path — the same rule the audit follows), parses `content_types/schema.json`, and produces the inventory. It then attempts the destination read; a failure there degrades the response rather than failing it (TR-5). One response carries: the inventory, the reference graph, the destination-present uid set (or a flag saying it could not be read), and the currently persisted selection.

The write path validates the submitted selection against the current inventory and writes it to the project record with a **field-level assignment** — the same discipline the audit's decisions writer uses, because a whole-record spread destroys `destinationToken.secretEncrypted` (TRR-1).

**Client.** A Redux slice holding: the inventory and graph as received, the working selection, the persisted selection, the search term, the page size, and transient UI state (the pending confirmation, saving flag). Derived values — the footer count, whether a row shows the conflict control, whether the select-all is checked — are computed per render from those, never stored. That is the same derive-don't-store discipline used by the audit panel and the project dashboard, and it is what stops the footer count and the checkbox states from drifting apart.

The panel registers a step gate with the chrome, supplying `satisfied`, `advance` and `statusLine`. It renders no footer of its own (TR-18).

## 5. Data model

- **DM-1 — `ContentTypeInventoryItem` (derived, not persisted).** Per source content type: `uid`, `title`, `references: string[]` (content type uids), `existsInDestination: boolean`. Computed per request from the export plus the destination read. Corresponds to feature.md `SourceContentTypeInventory` and `DestinationContentTypeIndex`.

- **DM-2 — `ContentTypeSelection` (persisted).** New optional field `contentTypeSelection` on the v3 project record. Shape: a map keyed by content type uid, each value carrying the conflict mode when one applies, plus an `updatedAt` timestamp. A uid present in the map is selected; absence means unselected. The conflict mode vocabulary is `source` | `dest` | `merge`, matching the design's own ids. Corresponds to feature.md `ContentTypeSelection`.
  - **Migration required:** none. The field is additive and optional; existing project records are valid without it, and every other reader ignores it.
  - **Retention:** lives and dies with the project record. Not cleared by a re-export — pruning happens at hydration (TR-22), not at export time, so a re-export that temporarily removes a content type does not permanently destroy the operator's choice.

Every entity in [feature.md §10](./feature.md) has a DM entry.

## 6. API contracts

Two endpoints, both under the existing `/v3` router, both requiring a valid session and resolving the project within the caller's scope.

- **API-1 — read the content type inventory for a project.**
  - Returns: the inventory (DM-1) for every content type in the export, the reference graph, whether the destination could be read, and the persisted selection (DM-2) if any.
  - Returns the **whole list** — no server-side paging, filtering or search (TC-1).
  - Error shapes: project unknown or out of scope → not found; export missing or unreadable → a distinct, classified error the client renders as EC-1/EC-2; export present with zero content types → a **success** with an empty inventory, not an error (EC-3).
  - The destination management token MUST NOT appear in the response (NFR-3).

- **API-2 — persist the selection for a project.**
  - Accepts: the selection map (DM-2) without a timestamp; the server stamps `updatedAt`.
  - Validates: every submitted uid exists in the current inventory; every conflict mode is one of the three permitted values; a conflict mode is only accepted for a uid that exists in the destination. Rejects the whole payload on any violation rather than silently dropping entries.
  - Returns: the stored selection as persisted, so the client can reconcile.
  - Rejects an unknown project rather than creating one (FR-9.9).

No events are emitted (`EVT-*`: none — this repository has no event bus).

## 7. Integration points

- **INT-1 → DEP-1 (`migration-wizard-chrome`).** Consumes the existing step-gate contract: `satisfied`, `blockedReason`, `advance`, `statusLine`. Changes one string in the shared step definition (`content-mapping.actionLabel`). This is the gate's second consumer after the audit panel; the `statusLine` channel was added during that work.
- **INT-2 → DEP-2 (`cs-source-selection`).** Read-only consumer of `content_types/schema.json` inside the export directory. Depends on that file being a list of content type objects each carrying `uid`, `title` and `schema`. Does not write to the export.
- **INT-3 → DEP-3 (`cs-destination-selection`).** Read-only consumer of the stored, encrypted destination management token and the persisted destination stack/region/branch. Second consumer of that credential.
- **INT-4 → DEP-4 (v3 project store).** Adds one optional field and one field-level setter/getter pair. Must not disturb `destinationToken.secretEncrypted` on the same record.
- **INT-5 → DEP-5 (Contentstack CMA).** Read-only: list content types for the destination stack. Uses the existing `csManagement.service` host resolution and header construction.
- **INT-6 → DEP-6 (interfaces 2 and 3).** Downstream, not yet built. DM-2's shape — especially the conflict-mode vocabulary — is the contract. Changing it after selections exist in the wild requires a data migration (TRR-4).
- **INT-7 → DEP-7 (`cs-audit-report`).** No runtime integration. Listed because feature.md A-4 asserts audit exclusions do not filter this list; that assertion is an integration decision even though it produces no code.

Every `DEP-*` in feature.md §13 has a matching `INT-*`.

## 8. Technology choices

- **TC-1: Ship the whole inventory; page, search and select-all on the client.** Chosen because FR-3.5 (search the complete set), FR-4.3 (select-all covers every content type) and FR-6.1 (reverse-edge lookup on untick) all need the full set anyway — the reference graph in particular must be in the browser for the confirmation to be synchronous. A stack with a few hundred content types produces tens of KB. **This deliberately diverges from the audit's TC-3**, which paged server-side; that table held tens of thousands of entries, this one holds hundreds. Alternatives: **server-side paging and search** — rejected because it needs extra endpoints for search and select-all and still has to ship the graph; **render every row with no paging** — rejected, contradicts FR-3.1–FR-3.3. Confirmed by the user.
- **TC-2: Initial page size 25.** Chosen over the prototype's 8, which would force ~15 load-more presses on a 120-type stack, and over 50. Confirmed by the user. Resolves feature.md Q-3.
- **TC-3: Reference graph computed on the server, not the client.** Chosen because it requires walking every content type's nested schema (groups, block types, global field schemas) and that is exactly the kind of parsing that should not be duplicated in the browser or re-run per render. The client receives a flat adjacency map. Alternative: **send raw schemas and derive in the client** — rejected on payload size and on duplicating the recursion.
- **TC-4: Reverse-edge lookup computed per untick, not stored.** The graph is stored forward (`type → referenced types`); the question asked is the reverse (`who references this?`). Computing it on demand over a few hundred entries is trivial and avoids a second structure that could drift. Alternative: **precompute and store both directions** — rejected as premature.
- **TC-5: Selection saved on an explicit control AND on advance, not per tick.** Matches [feature.md UC-6, UC-7](./feature.md), and matches the audit's TC-6 reasoning: the project store rewrites its whole JSON file per write, so per-tick autosave means one full-file rewrite per checkbox. The cost is the same as the audit's — a browser refresh with unsaved ticks loses them. Unlike the audit, this screen mitigates it with an explicit, always-available save control (FR-9.1).
- **TC-6: Destination match on uid, exact and case-sensitive.** Follows feature.md FR-2.2/FR-2.3 and the prototype's own `DEST_EXISTS` keying. The cost is R-3 — hand-built destination types with a different uid go unlabelled. Recorded as TQ-2.
- **TC-7: Degrade, do not fail, when the destination cannot be read.** The source list is useful without the destination; blocking the whole screen on a CMA failure would make an unrelated outage look like a broken step. Cost: the operator can save a selection with no conflict decisions for types that really do conflict — recorded as TRR-3.

## 9. Sequencing & phases

Follows the TDD pipeline. Server before client, because the client's shape is determined by API-1's response.

1. **Phase A — inventory and graph.** TR-1, TR-2, TR-26. Pure functions over an export directory; the richest logic in the feature and the easiest to test in isolation.
2. **Phase B — destination match and the read endpoint.** TR-3, TR-4, TR-5, TR-24, TR-25, API-1.
3. **Phase C — persistence.** TR-21, TR-22, TR-23, DM-2, API-2.
4. **Phase D — panel: list, search, paging, selection.** TR-6 … TR-9, TR-16, TR-17.
5. **Phase E — conflict control and confirmation dialog.** TR-10 … TR-15.
6. **Phase F — gate, save control, step label.** TR-18, TR-19, TR-20, INT-1.

An interrupted run after Phase C leaves a working server with no UI, which is inert but harmless.

## 10. Testing strategy

The test-cases skill generates detailed cases from feature.md ACs; this is the engineering placement plan. Conventions follow the four prior v3 features: pure logic as `unit`, endpoint contracts via supertest as `integration`, React components as `unit (component)` under `ui/`.

| AC ID | Test type | Test location | Notes |
|---|---|---|---|
| AC-1.1 | unit (component) | `ui/` content mapping panel | Rows render unticked; empty status line |
| AC-1.2, AC-1.3 | unit (component) | `ui/` panel | Working selection and pluralised status line |
| AC-1.4 | unit (component) | `ui/` panel | Untick with no referencing ticked type |
| AC-1.5 | unit (component) | `ui/` panel | Ticking never cascades (FR-4.7) |
| AC-2.1, AC-2.2, AC-2.3 | unit (component) | `ui/` panel | Paging over a 120-type fixture |
| AC-2.4 | unit (component) | `ui/` panel | Search reaches beyond the loaded page |
| AC-2.5, AC-2.6 | unit (component) | `ui/` panel | Empty result; page size restored on clear |
| AC-3.1 … AC-3.5 | unit (component) | `ui/` panel | Select-all scope, newly loaded rows, search scoping, partial state |
| AC-4.1 … AC-4.6 | unit (component) | `ui/` panel | Conflict control visibility, default, lifecycle, verbatim copy |
| AC-5.1 … AC-5.3, AC-5.5 | unit (component) | `ui/` panel | Dialog appearance, naming, confirm and cancel |
| AC-5.4, AC-5.6 | unit (component) | `ui/` panel | Suppression: unticked referrer, self-reference |
| AC-5.7 | unit | `api/` inventory service | Nested-reference discovery is a server concern (TR-2); the component test asserts the dialog given a graph that contains the edge |
| AC-6.1, AC-6.3 | unit (component) | `ui/` panel | Payload shape; save control label |
| AC-6.2, AC-6.4 | unit (component) | `ui/` panel | Success acknowledgement; failure leaves selection intact |
| AC-6.5 | unit | `api/` project store | Field-level write preserves the encrypted token (TRR-1) |
| AC-7.1, AC-7.2, AC-7.4 | unit (component) | `ui/` panel + real gate | Must mount the panel inside a real `StepGateProvider` with the real `WizardFooter` — a panel-only render cannot see a broken gate. This is the lesson from the audit's duplicate-footer defect |
| AC-7.3 | unit | `ui/` wizard steps | Step definition's `actionLabel` |
| AC-8.1, AC-8.2, AC-8.3 | unit (component) | `ui/` panel | Hydration, pruning a stale uid, empty state |
| EC-1, EC-2, EC-3 | integration | `api/` content type routes | Missing, unreadable and empty exports |
| EC-4, EC-5 | integration | `api/` routes | Degraded response when destination unreadable / token absent |
| EC-6, EC-7 | integration | `api/` routes | Persist failure; unknown project rejected, not created |
| EC-8 | unit (component) | `ui/` panel | Double submit issues one write |
| EC-9 | integration | `api/` routes | Last write wins — documents the behaviour, pending TQ-3 |
| EC-10 | unit | `api/` inventory service | Dangling reference target does not crash the graph |
| EC-11, EC-12 | unit (component) + unit | `ui/` panel, `api/` service | Pruning; graph recomputed from the new export |
| EC-13 | unit | `api/` service | Same uid, different schema, still marked present |
| EC-14 | unit | `api/` service | 500-type fixture within NFR-1 |
| EC-15 | unit (component) | `ui/` panel | Regex metacharacters treated literally |
| EC-16, EC-17 | unit (component) | `ui/` panel | Self-reference untick; select-all under an active search |

Every `AC-*` in feature.md has an assigned test type.

**Fixtures required:** F1 — a small export (6 content types, one reference edge, one self-reference, one dangling target). F2 — a large export (120 content types) for paging and search. F3 — an export with a reference nested inside a modular block and inside a global field, for AC-5.7 and FR-1.4. F4 — a 500-type export for EC-14/NFR-1.

**Mocks:** the CMA content-type read (INT-5) at the `csManagement.service` boundary; the filesystem only where a fixture directory is impractical; the project store in component tests.

**Not automated:** the pixel pass (TDD Phase 3) is visual verification, and NFR-10 browser-matrix coverage is manual.

## 11. Observability

- Structured log on every inventory read: project id, content type count, reference edge count, whether the destination read succeeded, duration.
- Structured log on every destination read failure with a **fixed failure classification** — `unauthorized`, `not_found`, `network`, `unexpected` — never the raw error and never the export path, because that path contains the source stack api key.
- Structured log on every persist: project id, count of selected content types, count of those carrying a conflict mode. **Whether the chosen modes themselves are logged is PQ-2**, not assumed here — G-5 needs it, and it is a decision about recording user choices.
- No metric pipeline exists (see [prd.md §10](./prd.md)).

## 12. Security

- **NFR-3 / TR-24:** the destination management token is decrypted server-side only, used to construct CMA headers, and never included in any response body, log line, or error message. API-1's response carries destination *uids* only.
- **NFR-4:** both endpoints require a valid session and resolve the project within the caller's scope. An out-of-scope project is indistinguishable from an unknown one, matching every other scoped read in this store.
- The export directory is derived server-side from the project's stored source stack api key. A client-supplied path is never accepted — the same rule the audit follows, and for the same reason: the path contains a credential-adjacent identifier.
- API-2 validates every uid against the current inventory, so a crafted payload cannot introduce arbitrary keys into the project record.
- No new secrets, no new external egress beyond the existing CMA host.

## 13. Performance

- **NFR-1:** inventory plus reference graph for a 200-content-type export in under 2 seconds. The work is a single directory read, one JSON parse, and one recursive walk per content type — comfortably inside that budget. Fixture F4 (500 types) guards the headroom.
- **NFR-2:** ticking, unticking, searching and paging resolve entirely on the client against loaded data (TC-1). No network request per keystroke or per tick.
- The reverse-edge lookup on untick (TC-4) is O(n × e) over a few hundred content types — negligible, and only on an untick.
- API-1's payload is the one thing that grows with stack size: uid, title and a short uid array per content type. A 500-type stack is still well under a megabyte. No pagination is planned; if a stack ever makes this painful, that is the trigger to revisit TC-1.
- No caching layer. Unlike the audit's findings, the inventory is cheap to recompute and has no expensive scan behind it, so a cache would add invalidation risk for no gain.

## 14. Rollout / feature flag

- **Flag:** none. **There is no feature-flag system in this repository** — consistent with Source, Destination, the project dashboard and Audit.
- **Exposure:** gated by the `/v3` route existing and by the `content-mapping` step's placeholder body being replaced.
- **Kill switch:** restore the placeholder branch for `content-mapping` in `ui/v3/pages/Migration/index.tsx` and stop mounting the new routes.
- **Config surface:** none. The page size (TC-2) is a constant, not configuration.

## 15. Rollback plan

- **How to disable:** restore the placeholder branch for the `content-mapping` step and stop mounting the two new routes. A full revert additionally deletes the new `api/v3` and `ui/v3` files, the `contentTypeSelection` field on the project type, and reverts the one-string change to the shared step definition.
- **The step label is the one non-isolated piece.** `content-mapping.actionLabel` lives in `migration-wizard-chrome`'s step definition. Reverting it to `Continue to preview` is correct if this feature is fully removed — but if any other work has started depending on `Move to review`, that revert belongs with them, not here.
- **Data cleanup on rollback:**
  - `contentTypeSelection` (DM-2) is additive and optional. Leaving it costs nothing; every other reader ignores it. No cleanup required.
  - Nothing is written to the destination stack by this feature, so there is no external state to reverse.
  - No files are written into the export directory (unlike the audit's `audit.json`), so no orphans.
- **What breaks if we rollback mid-flow:**
  - An operator mid-selection loses unsaved ticks — under TC-5 that is every tick since their last save. The explicit save control makes this less severe than the audit's equivalent, but it is the same failure mode.
  - Already-persisted selections become dormant, not lost: they stay on the project record and are re-read if the feature returns.
  - **Interfaces 2 and 3, if they have shipped by then, lose their input entirely.** They have no meaning without a selection — this is a harder break than the audit's, where Content mapping merely showed more items than intended. If they exist, they must be rolled back together.
  - The wizard returns to a state it has already shipped in: a `content-mapping` step with a placeholder body. Nothing in Source, Audit, Destination, the dashboard or v2 breaks.

## 16. Risks & mitigations (technical)

- **TRR-1: A whole-record write destroys the encrypted destination token.** `{...project, contentTypeSelection}` would drop or stale `destinationToken.secretEncrypted`, which cannot be recovered from Contentstack. Mitigation: field-level assignment only (TR-21), pinned by AC-6.5. This is a known trap — the audit hit exactly this and it is why the setter pattern exists.
- **TRR-2: The panel renders its own footer and re-creates the audit's duplicate-action bug.** Mitigation: FR-8.5 forbids it, TR-18 assigns the footer to the chrome, and the AC-7.x tests are required to mount the real `WizardFooter` inside a real `StepGateProvider` — a panel-only render cannot detect the defect, which is precisely how it survived on the audit step.
- **TRR-3: A degraded destination read produces a silently under-specified selection.** Under TC-7 the operator can save a selection whose conflicting types carry no conflict mode, because none was ever offered. Mitigation: FR-2.4 requires telling the operator the destination could not be checked. The saved record is still valid — absence of a mode is legal (FR-5.7) — but downstream consumers must treat "no mode" as "unknown", not as a default. Worth flagging to INT-6.
- **TRR-4: DM-2's shape is a contract with features that do not exist yet.** Changing the conflict vocabulary after selections are persisted requires a data migration. Mitigation: agree the shape with interfaces 2 and 3 before ship ([prd.md §12](./prd.md)).
- **TRR-5: The reference graph is only as good as the schema walk.** A field container type not handled by TR-2's recursion silently produces a missing edge, and the resulting failure mode is an absent warning — invisible in testing unless a fixture covers that container. Mitigation: fixture F3 covers modular blocks and global fields explicitly; EC-10 covers dangling targets.
- **TRR-6: Client-side select-all over a large export creates a large payload on save.** 500 uids is still small, but it is the one operation whose payload scales with stack size. Mitigation: none needed at current scale; revisit with TC-1 if stacks grow.

## 17. Task breakdown

| Task | Realizes | Phase |
|---|---|---|
| T-1 — export reader for `content_types/schema.json`, tolerant of a missing or malformed file | TR-1, TR-26 | A |
| T-2 — recursive reference-graph builder covering groups, block types and global field schemas | TR-2 | A |
| T-3 — destination content type read for a project, using the stored token | TR-3 | B |
| T-4 — uid match and the `existsInDestination` flag | TR-4 | B |
| T-5 — degraded-response path when the destination read fails | TR-5, TR-25 | B |
| T-6 — API-1 controller, route, session guard and project scoping | TR-24, TR-26 | B |
| T-7 — `contentTypeSelection` on the project type, with a field-level setter and getter | TR-21, DM-2 | C |
| T-8 — API-2 controller, route and payload validation | TR-21, TR-23 | C |
| T-9 — Redux slice, thunks and API service for the panel | TR-8, TR-22 | D |
| T-10 — list, row, search and paging | TR-6, TR-7 | D |
| T-11 — selection and select-all | TR-8, TR-9 | D |
| T-12 — disabled `map fields` / `entries` affordances | TR-16 | D |
| T-13 — conflict control with its three options and explanations | TR-10, TR-11, TR-12, TR-13 | E |
| T-14 — untick confirmation dialog with reverse-edge lookup and focus handling | TR-14, TR-15 | E |
| T-15 — step gate registration, status line, save-then-advance | TR-17, TR-19 | F |
| T-16 — panel save control and acknowledgement | TR-20 | F |
| T-17 — `content-mapping.actionLabel` → `Move to review` in the shared step definition | TR-18, INT-1 | F |

Every `TR-*` is realized by at least one `T-*`.

## 18. Open questions

- **TQ-1:** Should API-1 return the persisted selection in the same response, or should the client fetch it separately? Bundled here for one round trip, but it couples a derived read to a persisted read and means a persistence change invalidates the read contract. — owner: Chirag Chavan — needed by: Phase B.
- **TQ-2:** Should the destination match fall back to title when no uid matches (TC-6, R-3, feature.md Q-2 / prd.md PQ-5)? — owner: Chirag Chavan — needed by: Phase B.
- **TQ-3:** Is last-write-wins acceptable for two tabs persisting one project's selection (EC-9, feature.md Q-5)? A version or timestamp precondition on API-2 would make it detectable. — owner: Chirag Chavan — needed by: Phase C.
- **TQ-4:** Should API-2 accept a partial update, or always replace the whole selection? Specified as full replacement above; a partial update would be smaller but makes deletion ambiguous. — owner: Chirag Chavan — needed by: Phase C.
- **TQ-5:** Does `Move to review` advance to the `preview` step even once interfaces 2 and 3 exist inside this step, or will it then advance within the step? Specified today as advancing to `preview`. — owner: Chirag Chavan — needed by: Phase F.
- **TQ-6:** Should the conflict modes chosen be logged for G-5 (PQ-2)? Affects §11. — owner: Chirag Chavan — needed by: Phase C.

## 19. References

- Claude Design project `132abb68-eaa7-494b-9820-3f9cf5fa6f15`, page **"Migration Tool Prototype"** — the reference for all three Content mapping interfaces; this feature covers only the first screen. Its state object confirmed the conflict vocabulary (`source` / `dest` / `merge`) and the `DEST_EXISTS` uid keying used by TC-6.
- [feature.md](./feature.md) — the behavioural contract.
- [prd.md](./prd.md) — priority, rollout and measurement context.
- `docs/features/cs-audit-report/trd.md` — the precedent for the job/store split, the field-level write discipline (TRR-1) and the save-on-continue reasoning (TC-5).
- `docs/features/migration-wizard-chrome/feature.md` — the step-gate contract this panel registers with (INT-1).
