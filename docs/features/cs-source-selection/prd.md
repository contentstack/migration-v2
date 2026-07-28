# PRD: Contentstack Source Selection (Content Map & Audit — Source panel)

- **Slug:** `cs-source-selection`
- **Related:** [feature.md](./feature.md) · [trd.md](./trd.md)
- **Status:** Draft
- **Product owner:** TBD — Open Question (PQ-4)
- **Engineering lead:** Ayush Sahu
- **Design lead:** TBD — Open Question (PQ-4)
- **Created:** 2026-07-28
- **Last updated:** 2026-07-28

## 1. TL;DR

On step 3 of the Contentstack-to-Contentstack migration wizard, the Source panel lets a migration operator pick what to migrate *from* — a live Contentstack stack or an uploaded export bundle — scope it to specific modules, and preview the resulting content graph before mapping. It ships in the new **v3** flow (`/v3` UI routes + `api/v3` endpoints), leaving the existing v2 flow untouched.

## 2. Problem & opportunity

See [feature.md §2](./feature.md).

Product delta: this is the entry point of the reworked v3 migration experience — the first step where a user commits to a source. Getting it right (scoping + preview before commit) directly reduces failed/oversized migrations, which are the top source of rework in the v2 flow. No hard market-sizing data yet.

## 3. Target users

See [feature.md §3](./feature.md).

Primary persona for this release: **Migration operator**. The Partner/consultant (file path) is a first-class but secondary path — both "From a stack" and "From a file" ship together (both P0).

## 4. Product goals & success metrics

See [feature.md §4](./feature.md) for goal statements. Targets are unresolved because no product-analytics pipeline is confirmed for this self-hosted tool (see §10, PQ-1/PQ-2).

- **G-1:** Single-panel source specification + read.
  - **Metric:** Source-step completion rate (reached → export/extract succeeded).
  - **Target:** `TBD — Open Question` (PQ-1).
  - **Type:** north-star.
- **G-2:** Module-scoped migrations.
  - **Metric:** % of sources using "Specific module(s)".
  - **Target:** `TBD — Open Question` (PQ-1).
  - **Type:** leading indicator.
- **G-3:** Selection survives reload.
  - **Metric:** reported cases of lost source selection after refresh.
  - **Target:** 0.
  - **Type:** guardrail-not-to-regress.
- **G-4:** Graph accuracy.
  - **Metric:** graph entity counts vs. actual extract result.
  - **Target:** 100% match.
  - **Type:** guardrail-not-to-regress.

## 5. Non-goals

See [feature.md §5](./feature.md).

Product-side additions: no product-analytics instrumentation is committed in this release (PQ-2); no i18n/localization of the Source panel copy is in scope for first ship (English only).

## 6. Requirements (prioritized)

Every `FR-*` from feature.md, with a launch priority. Full text lives in [feature.md §8](./feature.md).

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-1.1 | Two mutually exclusive modes, stack default | P0 | Core layout |
| FR-1.2 | Preserve hidden-mode data on tab switch | P1 | UX nicety; loss is annoying not blocking |
| FR-1.3 | Source header + status badge | P1 | Informational |
| FR-2.1 | Region dropdown | P0 | Stack path |
| FR-2.2 | Organization dropdown (per region) | P0 | Stack path |
| FR-2.3 | Stack dropdown (per org) | P0 | Stack path |
| FR-2.4 | Required + ordered cascading gating | P0 | Prevents invalid submits |
| FR-2.5 | Branch display + change (default `main`) | P1 | Default `main` covers the common case |
| FR-2.6 | Scope: whole stack / specific module | P0 | Whole-stack is the P0 default |
| FR-2.7 | Specific-module multi-select w/ counts | P1 | Scoping is an enhancement over whole-stack |
| FR-2.8 | Primary action + loading state | P0 | Triggers the read |
| FR-2.9 | Gate read until required fields set | P0 | Correctness |
| FR-3.1 | `.zip` dropzone (drag/browse) | P0 | File path |
| FR-3.2 | File card + remove | P0 | File path |
| FR-3.3 | Validate bundle + manifest | P0 | File path core |
| FR-3.4 | Scope: everything / specific modules | P0 | Everything-in-file is the P0 default |
| FR-3.5 | File specific-module multi-select | P1 | Scoping enhancement |
| FR-3.6 | Forced dependency ("required by entries") | P1 | Correctness of scoped subset; ships with FR-3.5 |
| FR-3.7 | Upload-another / extract actions + lock | P0 | File path core |
| FR-3.8 | Reject invalid bundle w/ error | P0 | Safety (EC-3) |
| FR-3.9 | 100 MB size cap w/ message | P0 | Safety (EC-4) |
| FR-4.1 | Graph empty state | P1 | Graph is UC-3 (P1) |
| FR-4.2 | Stat tiles (5 counts) | P1 | Graph is UC-3 (P1) |
| FR-4.3 | Dependency-ordered node/edge graph | P1 | Graph is UC-3 (P1) |
| FR-4.4 | Pan / zoom controls | P2 | Enhancement over a static graph |
| FR-5.1 | Endpoints under `/v3`, authed, fully standalone | P0 | New standalone `api/v3` router (no v2 reuse) |
| FR-5.2 | Persist source selection to project | P0 | UC-4 / G-3 |
| FR-5.3 | List regions/orgs/stacks/branches | P0 | Feeds stack dropdowns |
| FR-5.4 | Modules-with-counts endpoint | P1 | Feeds specific-module UI (P1) |
| FR-5.5 | Start export (async) + upload/validate/extract | P0 | Core read |
| FR-5.6 | Content-graph data endpoint | P1 | Feeds graph (P1) |

**Priority definitions:** P0 — must ship for launch; P1 — should ship, missing degrades but doesn't block; P2 — nice to have, fast-follow OK.

## 7. User experience

See [feature.md §6](./feature.md) (use cases) and [§7](./feature.md) (flows).

Product-side UX decisions:
- **Copy:** load-bearing strings are fixed by the design and quoted in feature.md ACs (dropzone text, "required by entries", empty-state text). English only for first ship.
- **Empty states:** graph empty-state text is specified (AC-3.1). Zero-org / zero-stack empty states (EC-1) need short explanatory copy — exact wording `TBD` (PQ-5).
- **Error copy:** invalid-bundle (EC-3), size-limit (EC-4), and auth/permission (EC-5) messages should follow one consistent tone; a copy standard is `TBD` (PQ-5).
- **First-run guidance:** none planned for v1 (the two-tab layout is considered self-explanatory).

## 8. Non-functional requirements

See [feature.md §9](./feature.md). No additional product-side NFRs (brand/i18n/compliance) beyond English-only first ship.

## 9. Launch & rollout plan

- **Rollout mechanism:** **Gated by the `/v3` route.** There is no feature-flag system; the feature is reachable only via the new `/v3` UI routes and `api/v3` endpoints. The v2 flow is untouched.
- **Feature flag name:** none (see [trd.md §14](./trd.md)).
- **Cohort staging:**
  - **Stage 1 (internal):** team/dev reaches `/v3/projects/...` directly. Entry: api/v3 Source endpoints deployed.
  - **Stage 2 (opt-in):** v3 entry point linked for selected users/self-hosters.
  - **GA:** v3 becomes the default migration entry point (redirect/nav change — a separate decision, out of this feature).
- **Kill switch:** stop exposing/ linking the `/v3` entry point (and/or don't deploy `api/v3`). No runtime toggle; nothing in v2 to revert.
- **Comms plan:** changelog + internal note when v3 Source ships. Owner `TBD` (PQ-4).

## 10. Analytics & instrumentation

No product-analytics pipeline is confirmed for this self-hosted tool. Post-launch metrics (§4) therefore cannot be measured from client events today.

| Event | Trigger | Properties | Metric it feeds |
|-------|---------|------------|-----------------|
| `TBD — Open Question (PQ-2)` | — | — | G-1, G-2 |

Interim measurement, if any, relies on server logs (feature.md NFR-7 / [trd.md §11](./trd.md)) — export/extract start/success/failure — which can approximate G-1 completion but not G-2 UI-scoping choices. Deciding whether to add telemetry is PQ-2.

## 11. Post-launch success criteria

Gated on PQ-1/PQ-2 (targets + telemetry). Until those resolve, success is assessed qualitatively.

- **7 days:** v3 Source usable end-to-end for both stack and file paths with no P0 defects.
- **30 days:** `TBD` — G-1 completion-rate threshold (PQ-1).
- **60 days:** `TBD` — G-2 module-scoping adoption (PQ-1).
- **90 days:** `TBD`.
- **Regression guardrails:** G-3 (0 lost selections after reload) and G-4 (100% graph-count accuracy) must hold.

## 12. Dependencies & stakeholders

Technical dependencies: [feature.md §13](./feature.md) and [trd.md §7](./trd.md).

- **Product stakeholders:** Eng lead — Ayush Sahu. PM / Design lead / QA lead / DocOps — `TBD` (PQ-4).
- **Cross-team dependencies:**
  - **Destination-panel owners (same v3 wizard)** — must agree the persisted `source` schema shape (feature.md DEP-7, [trd.md §5](./trd.md)) — by TRD sign-off — owner `TBD` (PQ-3/TQ).

## 13. Risks & mitigations (product-side)

- **PR-1:** Without telemetry, we can't prove G-1/G-2 impact — medium/medium — decide telemetry approach early (PQ-2) or accept qualitative-only assessment.
- **PR-2:** Two source paths (stack + file) both P0 doubles first-ship surface — medium/medium — file path can be de-scoped to P1 fast-follow if timeline slips (decision owner: PM, PQ-4).
- **PR-3 (resolved):** Spec/implementation drift closed — feature.md updated to `/v3` + fully standalone (2026-07-28) so all three docs agree.

## 14. Timeline & milestones (high level)

- **Spec approved:** 2026-07-28 (feature.md Draft).
- **Design approved:** external design exists; sign-off `TBD`.
- **Engineering start:** `TBD` — after api/v3 skeleton (next task).
- **Feature-complete:** `TBD`.
- **Staged rollout start:** `TBD`.
- **GA:** `TBD`.

Task breakdown: [trd.md §17](./trd.md).

## 15. Open questions

- **PQ-1:** G-1/G-2 metric thresholds (completion-rate target, module-scoping adoption target). — owner: Product — needed by: post-launch review. (feature.md Q-1)
- **PQ-2:** Is any product-analytics/telemetry added, or is measurement logs-only/qualitative? — owner: Product/Eng — needed by: GA.
- **PQ-3 (CLOSED):** feature.md updated to `/v3` + fully standalone (2026-07-28); docs are consistent.
- **PQ-4:** Named stakeholders (PM, Design lead, QA lead, comms owner). — owner: Ayush — needed by: engineering start.
- **PQ-5:** Final copy for zero-org/zero-stack empty states and error toasts (EC-1/EC-3/EC-4/EC-5). — owner: Design/Product — needed by: test-case stage. (feature.md Q-3 relates)

## 16. References

- [feature.md](./feature.md)
- [trd.md](./trd.md)
- `https://claude.ai/design/p/132abb68-eaa7-494b-9820-3f9cf5fa6f15?file=Content+Map+and+Audit.dc.html` — Claude Design project, page **"Content Map and Audit"**, **Source panel** only (Destination panel out of scope).
