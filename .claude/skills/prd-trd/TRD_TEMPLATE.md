# TRD: <Feature Name>

- **Slug:** `<slug>`
- **Related:** [feature.md](./feature.md) · [prd.md](./prd.md)
- **Status:** Draft
- **Tech lead:** <name>
- **Engineers:** <names>
- **Created:** <YYYY-MM-DD>
- **Last updated:** <YYYY-MM-DD>

## 1. Overview

Two or three sentences. What's being built, from an engineering perspective.

See [prd.md §1](./prd.md) for product framing and [feature.md §1](./feature.md) for the spec summary.

## 2. Scope

- **In scope:** <what this TRD covers>
- **Out of scope:** <adjacent work explicitly deferred, with a one-liner why>

Product-level non-goals live in [feature.md §5](./feature.md).

## 3. Requirements traceability

Every `FR-*` from feature.md maps to one or more `TR-*` here. If an FR needs no code change, say so.

| Spec ID | Tech ID(s) | Notes |
|---------|------------|-------|
| FR-1 | TR-1, TR-2 | |
| FR-2 | TR-3 | |
| FR-3 | — | No code change — pure product/copy decision. |

### Technical requirements

- **TR-1:** <atomic statement — what the system must do at code level>
- **TR-2:** …

## 4. Architecture

Describe the change in words. Prefer prose + component list over ASCII diagrams.

- **Components touched:** <module A · service B · package C>
- **New components:** <name — purpose — owner>
- **Data flow (happy path):**
  1. …
  2. …
- **Data flow (error path):**
  1. …
- **Concurrency / ordering constraints:** <e.g. "step 3 must complete before step 4 for the same entity">

## 5. Data model

Every entity in [feature.md §10](./feature.md) needs an entry — or an explicit "no schema change".

- **DM-1:** New table `<name>` — columns `<col: type>`, indexes `<...>`. Migration required (forward-only / reversible).
- **DM-2:** Alter table `<name>` — add column `<col: type>`. Backfill strategy: <online / offline / none>. Backfill duration estimate: <time>.
- **DM-3:** …

If nothing changes: `No schema changes.`

## 6. API contracts

Every new or modified endpoint / event / RPC.

### API-1: `<METHOD> /path`

- **Purpose:** <one line>
- **Auth:** <required scopes / roles>
- **Request:**
  ```
  { ...shape or type... }
  ```
- **Response (200):**
  ```
  { ...shape or type... }
  ```
- **Error cases:** <status code → message key / error class>
- **Idempotency:** <yes/no — if yes, key source>
- **Realizes:** FR-*, TR-*

### Events

- **EVT-1:** `<event.name>` — payload `<shape>` — emitted when `<trigger>` — consumed by `<subscriber>` — delivery guarantees: <at-least-once / at-most-once / exactly-once>.

## 7. Integration points

Every `DEP-*` in [feature.md §13](./feature.md) must have a matching entry here.

- **INT-1:** <name> — direction (we call / they call / bidirectional) — contract owner — latency SLA — fallback when they're down — realizes DEP-*.
- **INT-2:** …

## 8. Technology choices

Only decisions with real alternatives worth recording. Each: choice + rationale + alternatives rejected.

- **TC-1:** <decision, e.g. "PostgreSQL for X"> — chosen because <reason>. Alternatives: <a, b> — rejected because <reason>.
- **TC-2:** …

## 9. Sequencing & phases

If work must ship in phases, list them and what each unlocks. Otherwise: `Single-phase delivery — all TRs ship together.`

- **Phase 1:** covers TR-1, TR-2 — unlocks <what user-visible capability or internal milestone>.
- **Phase 2:** …

## 10. Testing strategy

Every `AC-*` from [feature.md §11](./feature.md) gets a test type. The test-cases skill will generate detailed test cases from feature.md ACs — this section is the *engineering placement plan* for those tests.

| AC ID | Test type | Test location | Notes |
|-------|-----------|---------------|-------|
| AC-1.1 | unit | <package/module> | |
| AC-1.2 | e2e | <suite name> | Requires <seed data> |
| AC-2.1 | integration | <suite name> | Against real DB |

- **Fixtures / test data:** <how tests get realistic data — never PII>
- **Test-only feature flag or seed hook:** <if any>
- **CI signal:** <which pipeline stages must be green>

## 11. Observability

- **Logs:** <events, level, structured fields — never log PII / secrets>
- **Metrics:** <name — type (counter/gauge/histogram) — labels>
- **Alerts:** <condition · threshold · severity · pager destination>
- **Dashboards:** <link or "to be created — owner: <name>">
- **Traces / spans (if applicable):** <span names, attributes>

## 12. Security

- **Auth / authz:** <new scopes, roles, permission checks — where enforced>
- **PII handling:** <what's touched, retention, redaction rules, right-to-delete impact>
- **Threat model deltas:** <new attack surface + mitigations>
- **Secret handling:** <where new secrets live, rotation, access controls>
- **Compliance flags:** <GDPR / SOC2 / HIPAA / regional data residency — sign-off owner>

## 13. Performance

References `NFR-*` from [feature.md §9](./feature.md). Add engineering-side numbers:

- **Expected load:** <QPS, concurrent users, dataset size, growth rate>
- **Hot paths / bottlenecks:** <where to profile / benchmark>
- **Caching strategy:** <keys, TTL, invalidation triggers — or "no caching">
- **Load-test plan:** <how we verify before GA>

## 14. Rollout / feature flag

- **Flag name:** `<flag_key>` (must match [prd.md §9](./prd.md))
- **Default state at merge:** OFF everywhere
- **Gated code paths:** <specific files/functions/endpoints behind the flag>
- **Config surface:** <env var, remote-config key, admin UI>
- **Per-stage flip mechanism:** <manual toggle, % rollout, cohort targeting>

## 15. Rollback plan

Be honest — say what breaks.

- **How to disable:** <flip flag / revert PR / kill switch — exact command or step>
- **Data cleanup on rollback:** <how to reverse migrations, orphan rows, in-flight state — or "migration is forward-only, no cleanup needed because <reason>">
- **What breaks if we rollback mid-migration:** <realistic assessment — usually not "nothing">
- **Rollback SLA:** <how fast we can be back to pre-launch state>

## 16. Risks & mitigations (technical)

- **TRR-1:** <risk — e.g. "backfill exceeds 24h window on largest tenant"> — likelihood/impact — mitigation.
- **TRR-2:** …

## 17. Task breakdown

Sequenced engineering tasks. Each realizes one or more `TR-*`.

- **T-1:** <task title> — realizes TR-1 — est <size / sprint-points>
- **T-2:** <task title> — realizes TR-1, TR-2 — depends on T-1 — est <size>
- **T-3:** …

## 18. Open questions

Tech-side questions not yet resolved.

- **TQ-1:** <question> — owner: <who> — needed by: <milestone>

## 19. References

- [feature.md](./feature.md)
- [prd.md](./prd.md)
- <design URL / page names — for reference only, not copied locally>
- <ADRs, prior art, related design docs, RFCs>
