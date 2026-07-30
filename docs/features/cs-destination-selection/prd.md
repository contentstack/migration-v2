# PRD: Contentstack Destination Selection (Content Map & Audit — Destination panel)

- **Slug:** `cs-destination-selection`
- **Related:** [feature.md](./feature.md) · [trd.md](./trd.md)
- **Status:** Draft
- **Product owner:** `TBD — Open Question` (PQ-3)
- **Engineering lead:** Chirag Chavan
- **Design lead:** `TBD — Open Question` (PQ-3)
- **Created:** 2026-07-22
- **Last updated:** 2026-07-30

## 1. TL;DR

On the Contentstack-to-Contentstack migration wizard, the Destination panel lets a migration operator configure where content is migrated *to* — region, organization, a stack (picked from existing stacks or created fresh via a modal), an import-authentication method (a system-generated read/write Management token, named by the user, or a deferred authToken sign-in), and how the source's locked master locale and branch map onto the destination — gated on the source (from the already-shipped Source feature) being ready. It reuses Source's already-built region/org/stack listing endpoints rather than duplicating them, previews what already exists in the chosen destination stack, and ships in the same v3 flow, leaving v2 untouched.

## 2. Problem & opportunity

See [feature.md §2](./feature.md).

Product delta: this is the second major step of the v3 migration wizard, immediately following Source (and, in the real product flow, Audit). Getting destination configuration and import authentication right up front prevents failed imports discovered only at migrate time — the more expensive failure mode compared to a failed export, since it surfaces after the user has already invested time in Source/Audit. No hard market-sizing data yet.

## 3. Target users

See [feature.md §3](./feature.md).

Primary persona for this release: **Migration operator**. The Partner/consultant path (Management-token authentication) ships alongside as first-class, not deferred — both authentication methods are P0 (see §6).

## 4. Product goals & success metrics

See [feature.md §4](./feature.md) for goal statements. Targets are unresolved for the same reason as the Source feature: no product-analytics pipeline is confirmed for this self-hosted tool (see §10, PQ-2).

- **G-1:** Single-panel destination specification, including existing-stack selection or new-stack creation.
  - **Metric:** Destination-step completion rate (reached → "Proceed to content mapping" clicked successfully).
  - **Target:** `TBD — Open Question` (PQ-1).
  - **Type:** north-star.
- **G-2:** Selection survives reload.
  - **Metric:** reported cases of lost destination selection after refresh.
  - **Target:** 0.
  - **Type:** guardrail-not-to-regress.
- **G-3:** Cross-region migrations are always flagged.
  - **Metric:** cross-region destination configurations proceeding without the warning having been shown.
  - **Target:** 0.
  - **Type:** guardrail-not-to-regress.
- **G-4:** Gating correctness.
  - **Metric:** cases of a user reaching content mapping while the persisted source was not actually ready.
  - **Target:** 0.
  - **Type:** guardrail-not-to-regress.

## 5. Non-goals

See [feature.md §5](./feature.md).

Product-side additions: no product-analytics instrumentation is committed in this release (PQ-2), matching the Source feature's precedent; no i18n/localization of the Destination panel copy is in scope for first ship (English only, matching Source).

## 6. Requirements (prioritized)

Every `FR-*` from feature.md, with a launch priority. Full text lives in [feature.md §8](./feature.md).

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-1.1 | Region dropdown | P0 | Cannot configure a destination without it |
| FR-1.2 | Organization dropdown (per region) | P0 | Same |
| FR-1.3 | Stack dropdown (existing stacks + "Create a new stack") | P0 | Same |
| FR-1.4 | "Create a new stack" opens modal (name + description) | P0 | Only path to a new stack |
| FR-1.5 | Confirm creates stack, selects it, closes modal | P0 | Core correctness for the create path |
| FR-1.6 | Cancel creates nothing, leaves selection unchanged | P0 | Prevents silent bad state |
| FR-1.7 | Required + gated on Region/Org/Stack | P0 | Prevents invalid submits |
| FR-2.1 | Region change → login modal | P0 | Without this, cross-region destinations are simply unreachable |
| FR-2.2 | Log in gated on both fields non-empty | P0 | Prevents invalid submits |
| FR-2.3 | Valid login establishes session, closes modal | P0 | Core correctness |
| FR-2.4 | Cancel reverts region, no session change | P0 | Prevents silent bad state |
| FR-3.1 | Exactly one import-auth method required, via persistent cards | P0 | Import cannot proceed without a chosen method |
| FR-3.2 | Management token reveals a token-name field | P0 | Core to that path |
| FR-3.3 | Clicking Proceed creates a read/write management token via API (before persisting), with a name-collision error | P0 | The actual mechanism that makes Management token usable |
| FR-3.4 | authToken reveals no field (deferred sign-in) | P0 | Core to that path |
| FR-3.5 | Dismissible "apps need authToken" warning on Management token | P1 | Important guidance, but not a hard gate |
| FR-3.6 | Switching method discards the other method's entered name | P0 | Prevents silent bad state |
| FR-3.7 | Per-user/per-region Contentstack credential look-up for authToken | P0 | Without this, the authToken path can't actually be used later — it's the mechanism, not a nicety |
| FR-9.1 | Single locked-source-branch + chosen-destination-branch row | P0 | The whole point of branch mapping |
| FR-9.2 | No add/remove controls for branch mapping | P0 | Correctness — there is only ever one source branch |
| FR-9.3 | Source-branch side visually marked as locked/read-only | P1 | Clarity, not blocking |
| FR-4.1 | Mandatory locked-master-locale row + chosen destination locale | P0 | Migrations need at least the master locale mapped to mean anything |
| FR-4.2 | Additional repeatable rows (source-locale + destination-locale) | P1 | Enhancement over the mandatory master-locale mapping |
| FR-4.3 | Remove any additional row, including down to zero | P1 | Same; explicitly resolved as unrestricted (feature.md Q-6) |
| FR-4.4 | Summary reflects a locales-mapped count | P1 | Informational; exact counting formula open (Q-16) |
| FR-5.1 | Cross-region banner (advisory only) | P1 | Important guidance, but must not block (G-3 is a guardrail, not a hard gate) |
| FR-6.1 | Proceed gated on fields + source readiness | P0 | The feature's core correctness guarantee |
| FR-6.2 | "Prepare the source first" caption | P0 | Without it, users don't know why Proceed is disabled |
| FR-6.3 | Proceed persists + advances | P0 | Core action |
| FR-7.1 | Destination summary sidebar | P1 | Informational, not blocking |
| FR-8.1 | Standalone `/v3`, no v2 reuse | P0 | Architectural non-negotiable, matches Source |
| FR-8.2 | Persist destination selection | P0 | G-2 / UC-5 |
| FR-8.3 | Read persisted source readiness/region/branch/master locale | P0 | Drives FR-6.1, FR-5.1, FR-9.1, FR-4.1 — nothing else works without this |
| FR-10.1 | "Stack contents" card shows selected stack's name | P1 | Informational, not blocking |
| FR-10.2 | Empty-stack message | P1 | Same |
| FR-10.3 | Stat tiles for a non-empty stack | P2 | Exact metrics undecided (Q-18); nice-to-have polish over the empty-state message |
| FR-10.4 | Fetch destination stack's existing content stats (new capability) | P1 | Required to back FR-10.2/10.3 at all |

**Priority definitions:** P0 — must ship for launch; P1 — should ship, missing degrades but doesn't block; P2 — nice to have, fast-follow OK.

## 7. User experience

See [feature.md §6](./feature.md) (use cases) and [§7](./feature.md) (flows).

Product-side UX decisions:
- **Copy:** load-bearing strings are fixed by the design and quoted in feature.md ACs (method-card descriptions, the Management-token-name field and its apps warning, the cross-region banner, the "Prepare the source first" caption, the locked-row "Locked"/"Master" labels). English only for first ship. The Management-token-name hint copy ("configured on the destination stack") reads as if referencing an existing token rather than creating one — worth revisiting given the actual create-a-token behavior (feature.md Q-4).
- **Error copy:** invalid-credentials (EC-4), network/timeout (EC-5), invalid/colliding-stack-name (EC-3, resolved behavior), and token-name-collision (EC-13, resolved behavior) messages should follow one consistent tone; the underlying behavior for EC-3/EC-13 is now decided (error shown, no auto-suffix) but the exact copy/tone standard is `TBD` (PQ-5), matching the Source feature's unresolved PQ-5.
- **First-run guidance:** none planned for v1 — the single-form layout is considered self-explanatory, consistent with Source's decision.

## 8. Non-functional requirements

See [feature.md §9](./feature.md). No additional product-side NFRs (brand/i18n/compliance) beyond English-only first ship.

## 9. Launch & rollout plan

- **Rollout mechanism:** **Same as Source** — gated purely by the `/v3` route existing. There is no feature-flag system in this repo. (Confirmed decision.)
- **Feature flag name:** none (see [trd.md §14](./trd.md)).
- **Cohort staging:**
  - **Stage 1 (internal):** team/dev reaches the Destination panel directly once `api/v3` destination endpoints are deployed alongside the already-shipped Source endpoints.
  - **Stage 2 (opt-in):** v3 entry point linked for selected users/self-hosters (same cohort as Source's Stage 2 — they arrive at the same wizard).
  - **GA:** part of v3 becoming the default migration entry point (same GA decision as Source; not owned by this feature alone).
- **Kill switch:** stop exposing/linking the Destination panel's route (and/or don't deploy its `api/v3` endpoints). No runtime toggle.
- **Comms plan:** changelog + internal note when Destination ships. Owner `TBD` (PQ-3).

## 10. Analytics & instrumentation

No product-analytics pipeline is confirmed for this self-hosted tool (matching Source's precedent). Post-launch metrics (§4) therefore cannot be measured from client events today.

| Event | Trigger | Properties | Metric it feeds |
|-------|---------|------------|-----------------|
| `TBD — Open Question (PQ-2)` | — | — | G-1 |

Interim measurement relies on server logs (feature.md NFR-6 / [trd.md §11](./trd.md)) — destination-configured / proceed-clicked / proceed-blocked events — which can approximate G-1 completion. Deciding whether to add telemetry is PQ-2.

## 11. Post-launch success criteria

Gated on PQ-1/PQ-2 (targets + telemetry). Until those resolve, success is assessed qualitatively.

- **7 days:** Destination panel usable end-to-end (both import-auth paths, language mapping, resume) with no P0 defects.
- **30 days:** `TBD` — G-1 completion-rate threshold (PQ-1).
- **60 days:** `TBD`.
- **90 days:** `TBD`.
- **Regression guardrails:** G-2 (0 lost selections after reload), G-3 (0 unflagged cross-region proceeds), and G-4 (0 proceeds while source not ready) must hold.

## 12. Dependencies & stakeholders

Technical dependencies: [feature.md §13](./feature.md) and [trd.md §7](./trd.md).

- **Product stakeholders:** Eng lead — Chirag Chavan. PM / Design lead / QA lead / comms owner — `TBD` (PQ-3).
- **Cross-team dependencies:**
  - **`cs-source-selection` owners (Ayush Sahu)** — this feature reads their persisted `source` selection (feature.md DEP-1); that schema is not yet frozen on their side either (their own TQ-1) — needs joint sign-off before either side's Phase 1 lands — by TRD sign-off. Also needs to coordinate on the per-user/per-region Contentstack credential lookup (feature.md DEP-8/Q-20) — likely a shared need between both features, not something either should build in isolation.
  - **Content Mapping owners (feature not yet specified)** — will consume this feature's persisted `destination` selection (feature.md DEP-5) — schema sign-off needed before that feature's spec — owner `TBD` (PQ-3).

## 13. Risks & mitigations (product-side)

- **PR-1:** Ambiguity over whether Proceed gates on raw source-export completion or the (separate) Audit step's output (feature.md Q-1), and the design-vs-real-flow ordering conflict (Q-2), could ship a confusing or incorrect user-facing sequence if unresolved — medium/high — resolve both before engineering start.
- **PR-2:** Without telemetry, we can't prove G-1 impact — medium/medium — decide telemetry approach early (PQ-2) or accept qualitative-only assessment (mirrors Source's PR-1).
- **PR-3:** Two import-authentication paths (Management token + authToken) both P0 doubles first-ship surface — medium/medium — authToken could be de-scoped to a P1 fast-follow if timeline slips (decision owner: PM, PQ-6).
- **PR-4:** "Create a new stack" is a real, irreversible action against a customer's live Contentstack organization (unlike everything else on this panel, which is just local configuration) — a naming mistake or accidental click creates real clutter in the user's org — medium/low — ensure the create-stack modal's copy and confirmation step make this consequence clear (ties to PQ-5's copy-standard work).
- **PR-5:** The Management token path now has the system *create* a new read/write credential on the customer's destination stack automatically, rather than just accepting one the user already had — this is a bigger trust/consent surface than the panel had before (we're minting write access on the user's behalf, not just reading what they give us) — medium/medium — make sure the product experience clearly communicates that a token is being created, not merely referenced (ties to the Q-4 copy concern).

## 14. Timeline & milestones (high level)

- **Spec approved:** 2026-07-22 (feature.md Draft).
- **Design approved:** external design exists (shared with Source, same Claude Design page); sign-off `TBD`.
- **Engineering start:** `TBD` — blocked on `cs-source-selection`'s T-3 (region/org listing) actually landing, since this feature reuses those endpoints (see [trd.md §16](./trd.md) TRR-4).
- **Feature-complete:** `TBD`.
- **Staged rollout start:** `TBD`.
- **GA:** `TBD` (shared with Source's GA decision).

Task breakdown: [trd.md §17](./trd.md).

## 15. Open questions

- **PQ-1:** G-1 completion-rate target. — owner: Product — needed by: post-launch review. (feature.md Q-8)
- **PQ-2:** Is any product-analytics/telemetry added, or is measurement logs-only/qualitative? — owner: Product/Eng — needed by: GA.
- **PQ-3:** Named stakeholders (PM, Design lead, QA lead, comms owner). — owner: Chirag Chavan — needed by: engineering start. (feature.md Q-9)
- **PQ-4:** Correct next-step copy/ordering for the "After you proceed" preview — the design shows "Audit" as next, which conflicts with the real product order where Audit precedes Destination. — owner: Design/Product — needed by: TRD. (feature.md Q-2)
- **PQ-5:** Final copy/tone standard for error toasts (EC-3/EC-4/EC-5). — owner: Design/Product — needed by: test-case stage.
- **PQ-6:** Should the authToken import-authentication path be de-scoped to a P1 fast-follow if the timeline is tight (ties to PR-3)? — owner: PM — needed by: engineering start.
- **PQ-7 (narrowed):** Should the Destination summary's stack-related label (currently still literally "New stack" in the design) be updated now that existing stacks are also supported? (The "Branches mapped" count question is now moot — there's always exactly one branch mapping.) — owner: Design — needed by: TRD. (feature.md Q-14)
- **PQ-8:** Should the "Management token name" field's hint copy be rewritten to make clear a *new* token is being created, not an existing one referenced? — owner: Design — needed by: copy finalization. (feature.md Q-4)
- **PQ-9 (RESOLVED):** Automatically creating a read/write management token on the user's behalf does not get its own explicit confirmation step — it happens as part of clicking "Proceed" itself (feature.md Q-15, resolved). (ties to PR-5)
- **PQ-10:** Should the per-user/per-region Contentstack credential lookup (needed for authToken) be built once as shared v3 infrastructure, coordinated with `cs-source-selection`, rather than each feature building its own? — owner: Eng leads (both features) — needed by: TRD. (feature.md Q-20)

## 16. References

- [feature.md](./feature.md)
- [trd.md](./trd.md)
- `https://claude.ai/design/p/132abb68-eaa7-494b-9820-3f9cf5fa6f15?file=Content+Map+and+Audit.dc.html` — Claude Design project, page **"Content Map and Audit"**, **Destination panel** only (Source panel out of scope, covered separately).
- [`../cs-source-selection/feature.md`](../cs-source-selection/feature.md), [`../cs-source-selection/prd.md`](../cs-source-selection/prd.md) — sibling feature this depends on.
