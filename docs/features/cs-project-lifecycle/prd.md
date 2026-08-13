# PRD: Project deletion and unique project names

- **Slug:** `cs-project-lifecycle`
- **Related:** [feature.md](./feature.md) · [trd.md](./trd.md)
- **Status:** Draft
- **Product owner:** Chirag Chavan
- **Engineering lead:** Chirag Chavan
- **Design lead:** None — no design exists for these flows; the app's existing
  conventions are the specification (see [feature.md §16, Q-1 resolution](./feature.md))
- **Created:** 2026-08-12
- **Last updated:** 2026-08-12

## 1. TL;DR

Migration operators can delete a project they no longer need, which removes it from the
dashboard and reclaims the disk its export occupied. Creating a project with a name
already in use is refused. Both are needed now because the dashboard has become
unusable as a working surface — 18 records, mostly throwaway tests, 160 MB of
unreclaimable export data, and two projects sharing a name with no way to tell them
apart.

## 2. Problem & opportunity

See [feature.md §2](./feature.md).

Product-side delta: this is an internal tool with a single operator, so there is no
market sizing to add. The cost of not doing it is measurable directly, and grows:

- **Disk:** 160 MB across 5 exports today, none reclaimable through the product. Every
  future export adds to it. On a large customer stack a single export is far larger than
  the five current ones combined.
- **Legibility:** 17 named projects for what is, in practice, a handful of real
  migrations. The dashboard's stated purpose — find the right project quickly, see which
  are unfinished — is already degraded.
- **Correctness risk:** with two projects named "Chirag Sample", resuming the wrong one
  means configuring a migration against a stack the operator did not intend. That is a
  wrong-data risk, not a cosmetic one.

## 3. Target users

See [feature.md §3](./feature.md).

Primary persona for this release: the migration operator, who is also the only persona.
Jobs-to-be-done framing: *"when I finish or abandon a migration, I want to remove it so
my dashboard shows only work that matters, without losing track of which project is
which."*

Adoption assumption: there is no adoption curve to manage. The operator is the person
requesting the feature, and both capabilities are on the path they already use daily.

## 4. Product goals & success metrics

See [feature.md §4](./feature.md) for goals. Expanded with measurable targets.

Metrics here are deliberately modest and mostly binary. This is a single-user local tool
with no telemetry pipeline — the "collection" mechanism is the operator observing the
dashboard and the `v3Log` lines the server already writes (see §10). Inventing
percentage-based adoption targets for one user would be theatre.

- **G-1:** An operator can remove a project without filesystem access.
  - **Metric:** Number of product paths that still require manually deleting a folder —
    counted by inspection.
  - **Target:** 0, at merge.
  - **Type:** north-star (binary).
- **G-2:** Disk occupied by a deleted project's export is reclaimed.
  - **Metric:** Existence of `exportData/<projectId>/` after deletion, and bytes
    reclaimed, from the `v3Log` deletion line (EVT-1).
  - **Target:** Folder absent in 100% of deletions; the 160 MB currently held by
    abandoned test projects reclaimable within the first week of use.
  - **Type:** north-star.
- **G-3:** No two live projects in one workspace share a name.
  - **Metric:** Count of case-folded, trimmed duplicate names among live projects.
  - **Target:** No NEW duplicate creatable from merge onward. The one existing duplicate
    ("Chirag Sample" ×2) is grandfathered and excluded — see §5.
  - **Type:** guardrail-not-to-regress.
- **G-4:** No existing project becomes unreachable or is silently modified.
  - **Metric:** All 17 named projects list and open after the change; the malformed
    `demo-project` row stays out of the list.
  - **Target:** 17/17, verified once at merge.
  - **Type:** guardrail-not-to-regress.

## 5. Non-goals

See [feature.md §5](./feature.md).

Product-side scope cuts that surfaced during prioritization:

- **No undo, and no trash view.** The record survives as `isDeleted: true`, but the
  export folder is genuinely removed, so a restore would hand back a project whose data
  is gone. Half a restore is worse than none. Recorded in the spec's §5 and made visible
  to the operator by FR-2.4's copy requirement.
- **The existing duplicate name stays.** Enforcement is create-time only. Two projects
  named "Chirag Sample" remain; G-3's target explicitly excludes them.
- **No retention rule for deleted records.** `isDeleted: true` rows accumulate in
  `projects.json`. They are small and nothing reads them. Deferred as PQ-2.

## 6. Requirements (prioritized)

Every `FR-*` from [feature.md §8](./feature.md), with a priority. Not renumbered.

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-1.1 | Endpoint that deletes one project by id | P0 | UC-1 does not exist without it |
| FR-1.2 | Set `isDeleted = true` rather than removing the record | P0 | The store's scope predicate already depends on this field |
| FR-1.3 | Mark the record deleted BEFORE removing files | P0 | Ordering is the whole safety property; reversed, a failure destroys data belonging to a still-live project |
| FR-1.4 | Remove `exportData/<projectId>/` and its contents | P0 | G-2. The disk reclaim is half the point of the feature |
| FR-1.5 | Scope-resolve the target; 404 for unknown / deleted / out-of-scope | P0 | Also the security boundary — the three cases must be indistinguishable |
| FR-1.6 | Respond 200 on success | P0 | Contract |
| FR-1.7 | Never delete outside `exportData/<projectId>/` | P0 | Highest-impact risk in the feature (R-1) |
| FR-1.8 | No project name, description or stack api key in deletion logs | P0 | Matches the existing NFR-7 rule the audit path already follows |
| FR-1.9 | A deleted project is absent from list and single reads | P0 | Already true via the store's scope predicate; stated so it is tested, not assumed |
| FR-1.10 | The four other store writers refuse a deleted project | **P0** | Confirmed P0 by the operator. Only `setV3ContentTypeSelection` guards today; `requireProject` ignores the flag entirely. Shielded by the controllers now, but deletion makes the hole reachable |
| FR-1.11 | An in-flight export must not recreate the folder or persist a graph | **P0** | Confirmed P0. This is the difference between a deleted project staying deleted and its folder silently reappearing via the export's atomic rename |
| FR-2.1 | Delete action on each project card | P0 | The only entry point (Q-3 keeps it to the card) |
| FR-2.2 | Confirmation dialog before anything is deleted | P0 | Deletion is irreversible in practice (§5) |
| FR-2.3 | Dialog displays the project's name | P0 | With duplicate names in the store, naming the target is what makes the confirmation meaningful |
| FR-2.4 | Dialog states the export will be removed and cannot be undone | P0 | The operator's informed consent for an irreversible action |
| FR-2.5 | Cancel leaves the project unchanged | P0 | Contract |
| FR-2.6 | List refreshes after deletion without a full page reload | P1 | A manual refresh would still show correct data; degrades, does not block |
| FR-2.7 | Confirm control disabled while a deletion is in flight | P1 | Guards a double-submit; the second request 404s harmlessly, so this is polish over correctness |
| FR-2.8 | A failed deletion leaves the project listed and surfaces the failure | P0 | Silently dropping a row that still exists would misrepresent the data |
| FR-3.1 | Refuse create for a name already used by a live project in scope | P0 | UC-2 does not exist without it |
| FR-3.2 | Compare case-insensitively and trimmed | P0 | Confirmed by the operator. Without it the rule is trivially bypassed and the collision it prevents is the one a human actually makes |
| FR-3.3 | Consider only live projects; deleted names are free | P0 | Confirmed by the operator (UC-3). Getting this wrong reads as a bug (R-4) |
| FR-3.4 | Respond 409 on a duplicate name | P0 | Contract; distinct from 400 for a missing name (EC-10) |
| FR-3.5 | Create no record when refusing | P0 | Contract |
| FR-3.6 | A name used in another region/owner scope is accepted | P0 | Also a privacy boundary — the refusal must not leak another operator's project names |
| FR-3.7 | Enforced server-side regardless of any client check | P0 | The client rule is an affordance; this is the contract. Mirrors the existing comment on `createProject` |
| FR-4.1 | Create dialog shows the reason for a duplicate refusal | P0 | Otherwise the create silently fails |
| FR-4.2 | Typed name and description retained on refusal | P0 | Losing input on a validation failure is a defect, not a rough edge |
| FR-4.3 | Dialog stays open on refusal | P0 | Implied by FR-4.2; stated so it is tested |
| FR-4.4 | Indicate a clash before submit, from the loaded list | P2 | The spec says SHOULD. Pure affordance — the server rule stands either way |

**Priority definitions:**
- **P0** — must ship for launch; the feature does not work without it.
- **P1** — should ship for launch; missing degrades but doesn't block.
- **P2** — nice to have; fast-follow acceptable.

**Priority honesty note.** Two requirements are deliberately NOT P0. FR-2.6 (auto
refresh) and FR-2.7 (double-submit guard) both degrade the experience without producing
wrong data — a stale list corrects on refresh, and a duplicated delete request 404s.
Everything else is P0 because deletion is irreversible and a half-applied delete or a
leaked-scope refusal produces wrong or lost data.

## 7. User experience

See [feature.md §6](./feature.md) (use cases) and [§7](./feature.md) (flows).

Product-side delta: there is **no design**, by decision (Q-1). The UX is therefore
specified as consistency with named existing components rather than as a comparison
against a reference:

- The confirmation dialog follows `ContentMappingPanel`'s existing dialog — the same
  semantics, focus handling and card styling. That dialog already exists for a
  destructive-ish confirmation (unselecting a referenced content type), so the pattern is
  established rather than invented.
- The refusal message uses `CreateProjectModal`'s existing `error` prop and its
  `role="alert"` element. No new UI surface.
- The delete affordance sits on `ProjectCard` alongside its existing controls.

The practical consequence for the downstream `tdd` stage is that its Phase 3 is a
consistency review, and its defect signature is a hardcoded value where a token exists.

## 8. Non-functional requirements

See [feature.md §9](./feature.md). No product-side additions; the spec's numbers (30 s
deletion bound, WCAG-style dialog semantics, log-content restrictions) stand as written.

## 9. Launch & rollout plan

**Mechanism: hard flip on merge. No feature flag.**

This is concrete, not a deferral. Three reasons:

1. **No flag infrastructure exists.** There is no flag mechanism anywhere in `api/v3` or
   `ui/v3` — verified by inspection. Introducing one for this feature would be a larger
   change than the feature.
2. **The tool is local and single-user.** It is pulled and run on one machine and is not
   hosted (recorded in `docs/plans/source-export-revamp.md`). There is no cohort to stage
   across and no production blast radius.
3. **A flag would not de-risk the risky part.** The irreversible action is the folder
   deletion, which only happens when the operator confirms a dialog. A flag would gate
   whether the button exists, which the operator can already decide by not pressing it.

**Stages:** none. Merge, restart the api server (required — `npm run dev` is
`tsx ./src/server.ts` with no watch), and the capability is live.

**Pre-merge gate:** the full `api` and `ui` suites green, plus one manual verification
that deleting a project with a real 160 MB export both removes the folder and leaves
every other project intact (G-2, G-4).

## 10. Analytics & instrumentation

There is no analytics pipeline. Instrumentation means structured lines through the
existing `v3Log` helper (`api/v3/utils/logger.util.ts`), which the audit and export paths
already use. Every event below is constrained by FR-1.8 and NFR-6: identifiers and
numbers only, never a project name, description or stack api key.

| ID | Event | Fields | Serves |
|----|-------|--------|--------|
| EVT-1 | `project.delete.succeeded` | `projectId`, `folderRemoved` (bool), `bytesReclaimed` (number), `durationMs` | G-1, G-2, NFR-1 |
| EVT-2 | `project.delete.failed` | `projectId`, `reason` (fixed classification: `not_found`, `folder_remove_failed`, `internal`) | G-1, EC-6 |
| EVT-3 | `project.create.rejected` | `reason` (fixed: `duplicate_name`, `name_required`, `name_too_long`) | G-3 |

Metric coverage check: G-1 → EVT-1/EVT-2. G-2 → EVT-1 (`folderRemoved`,
`bytesReclaimed`). G-3 → EVT-3 (`duplicate_name`). G-4 → no event; verified by
inspection at merge, which is appropriate for a one-off migration-safety check rather
than an ongoing signal.

`bytesReclaimed` is a deliberate addition rather than a nice-to-have: without it G-2 has
no quantitative evidence, only the binary "folder absent".

## 11. Post-launch success criteria

Assessed by the operator, not by a dashboard. Timeframes are short because the user base
is one person who will exercise both paths within days.

- **Within 1 week:** the abandoned test projects are gone and the dashboard shows only
  real migrations; the 160 MB of stale export data is reclaimed. No project the operator
  intended to keep has been lost.
- **Within 1 week:** no new duplicate name exists among live projects.
- **Within 30 days:** no occurrence of a deleted project's folder reappearing (the
  FR-1.11 failure mode), and no occurrence of a live project whose export folder is
  missing (the NFR-4 failure mode). Both are detectable from EVT-1/EVT-2 plus the state
  of `exportData/`.
- **Guardrail:** no regression in the existing dashboard behaviours covered by
  `cs-project-dashboard` — listing, search, resume, create.

## 12. Dependencies & stakeholders

Cross-team dependencies from [feature.md §13](./feature.md), all internal to this
repository. There is no external team dependency, and nothing here is blocked on another
group.

| DEP | What | Nature | Owner |
|-----|------|--------|-------|
| DEP-1 | `api/v3/models/project.store.ts` | Blocking — both capabilities are implemented against it | Chirag Chavan |
| DEP-2 | `api/v3/utils/migrationData.util.ts` | Read-only, but load-bearing for NFR-2: its `safeSegment` sanitisation confines the deletion | Chirag Chavan |
| DEP-3 | `api/v3/services/export.service.ts` | Blocking for FR-1.11 | Chirag Chavan |
| DEP-4 | `ui/v3/components/projects/ProjectCard.tsx`, `ProjectsTopBar.tsx` | Blocking for the UI requirements | Chirag Chavan |
| DEP-5 | `ui/v3/components/projects/CreateProjectModal.tsx` | Read-only — its existing `error` slot satisfies FR-4.1 with no new surface | Chirag Chavan |
| DEP-6 | `api/v3/services/auditScan.service.ts` | Coupling only — its findings cache lives inside the export folder and is removed with it | Chirag Chavan |

**Stakeholders.** Product owner, engineering lead and QA are the same person, who is also
the sole user. Recorded plainly rather than padded into a matrix: there is no design lead
because there is no design (Q-1), and no separate QA sign-off gate beyond the test suites
and the one manual verification named in §9.

## 13. Risks & mitigations (product-side)

Technical risks live in [trd.md §16](./trd.md); the spec's own list is
[feature.md §15](./feature.md). Product-side:

- **PR-1: The operator deletes a project they meant to keep.** Likelihood low, impact
  high and irreversible. Mitigation: the confirmation dialog names the project (FR-2.3)
  and states that the export will be removed and cannot be undone (FR-2.4). Naming the
  project matters more than usual here, precisely because duplicate names exist.
- **PR-2: Uniqueness feels obstructive rather than helpful.** Likelihood low. The rule
  only fires on an exact human-equivalent collision, and deleting frees the name at once
  (FR-3.3), so the common workflow "delete the old one, recreate it" keeps working.
- **PR-3: The existing "Chirag Sample" duplicate is read as a bug after launch.**
  Likelihood medium, impact low. Mitigation: EC-13 states the grandfathering explicitly
  so it is not "fixed" by accident, and G-3's target excludes it.
- **PR-4: Deleted records accumulating in `projects.json` slowly bloat a file that is
  read whole on every store operation.** Likelihood low, impact low at current volumes
  (a deleted record is a few hundred bytes). Deferred as PQ-2 rather than solved now.

## 14. Timeline & milestones (high level)

Sequenced so each milestone is independently verifiable and an interrupted run leaves
something coherent. Effort is expressed in relative size, not dates — one engineer, no
external dependencies.

| Milestone | Content | Exit criteria |
|-----------|---------|---------------|
| M-1 | Test cases from this PRD + feature.md (the `test-case` stage) | Matrix covers every `AC-*` and `EC-*`; automatable rows identified |
| M-2 | Paired tests written, all failing for the right reason | 1:1 positive/negative pairing; red for missing behaviour, not typos |
| M-3 | Server: delete endpoint, uniqueness rule, FR-1.10 and FR-1.11 guards | Every server test green; full `api` suite green |
| M-4 | UI: delete affordance, confirmation dialog, refusal message | Every UI test green; full `ui` suite green |
| M-5 | Consistency review against the named precedents (Q-1) | No hardcoded value where a token exists; dialog semantics match |
| M-6 | Manual verification on real data | A real 160 MB export deleted; other projects verified intact |

## 15. Open questions

- **PQ-1:** Should the delete action also appear inside an opened project's wizard chrome,
  or only on the dashboard card? This release does the card only (FR-2.1). Carried from
  [feature.md](./feature.md) Q-3. — owner: Chirag Chavan — needed by: UI implementation
  (M-4).
- **PQ-2:** Do `isDeleted: true` records need a retention rule, or is unbounded growth of
  small records acceptable? Carried from [feature.md](./feature.md) Q-4. Product-side
  framing: this only becomes visible if the file grows enough to slow the store's
  whole-file reads. — owner: Chirag Chavan — needed by: not blocking.
- **PQ-3:** Should `bytesReclaimed` (EVT-1) be surfaced to the operator in the UI — a
  "reclaimed 32 MB" confirmation — or is the log line enough? Not in feature.md, so it
  is out of scope for this release by default. — owner: Chirag Chavan — needed by: not
  blocking.

Resolved during this stage, recorded so the reasoning is not lost:
- ~~Priority of FR-1.10 / FR-1.11~~ — **both P0**, confirmed by the operator. Delete is
  not safe without them.
- ~~Rollout mechanism~~ — **hard flip, no flag**; see §9 for why a flag would not reduce
  the actual risk.

## 16. References

- [feature.md](./feature.md) — the behavioural contract; `UC-*`/`FR-*`/`AC-*`/`EC-*` IDs
  originate there and are not renumbered here.
- [trd.md](./trd.md) — technical design, API contract, task breakdown.
- `docs/features/cs-project-dashboard/` — the dashboard this feature extends. Separate ID
  namespace.
- `docs/plans/source-export-revamp.md` — establishes the
  `exportData/<projectId>/<stackApiKey>/` layout that makes a per-project folder deletion
  possible, and records the local/single-user deployment context cited in §9.
- No design file, by decision. The visual precedents are named in §7.
