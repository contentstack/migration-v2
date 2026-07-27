# PRD: <Feature Name>

- **Slug:** `<slug>`
- **Related:** [feature.md](./feature.md) · [trd.md](./trd.md)
- **Status:** Draft
- **Product owner:** <name>
- **Engineering lead:** <name>
- **Design lead:** <name>
- **Created:** <YYYY-MM-DD>
- **Last updated:** <YYYY-MM-DD>

## 1. TL;DR

Two or three sentences. What we're building, for whom, why now. No jargon.

## 2. Problem & opportunity

See [feature.md §2](./feature.md).

Add here (only if you have data): market/business context, size of the opportunity, cost of not doing it, links to research.

## 3. Target users

See [feature.md §3](./feature.md).

Add here: primary persona for THIS release (if the spec lists multiple), jobs-to-be-done framing, adoption assumptions.

## 4. Product goals & success metrics

See [feature.md §4](./feature.md) for goals. Expand each with a measurable target.

- **G-1:** <goal statement from spec>
  - **Metric:** <name — how collected>
  - **Target:** <threshold — timeframe, e.g. "80% completion within 30 days of GA">
  - **Type:** north-star / leading indicator / guardrail-not-to-regress
- **G-2:** …

## 5. Non-goals

See [feature.md §5](./feature.md). Add any product-side scope cuts that surfaced during prioritization.

## 6. Requirements (prioritized)

Every `FR-*` from feature.md, with a priority. Do NOT renumber.

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-1 | <one-liner — see feature.md for full text> | P0 | |
| FR-2 | … | P1 | Fast-follow acceptable |
| FR-3 | … | P0 | |

**Priority definitions:**
- **P0** — must ship for launch; the feature does not work without it.
- **P1** — should ship for launch; missing degrades but doesn't block.
- **P2** — nice to have; fast-follow acceptable.

## 7. User experience

See [feature.md §6](./feature.md) (use cases) and [§7](./feature.md) (flows).

Add here — product-side UX decisions the spec doesn't cover: copy tone, onboarding, first-run guidance, empty-state approach, error copy standards, i18n strategy for launch.

## 8. Non-functional requirements

See [feature.md §9](./feature.md). Add product-side NFRs (brand guidelines, launch-market i18n scope, licensing/compliance sign-off owner) if any.

## 9. Launch & rollout plan

- **Rollout mechanism:** <feature flag / dark launch / staged rollout / hard flip / beta cohort>
- **Feature flag name:** `<flag_key>` (must match [trd.md §14](./trd.md))
- **Cohort staging:**
  - **Stage 1:** <who, how many, entry criteria> — target date
  - **Stage 2:** …
  - **GA:** <criteria to flip 100%>
- **Kill switch:** <exact mechanism to disable — flip the flag / revert a config / etc.>
- **Comms plan:** <internal announcement · changelog · docs · in-app notice — who owns each>

## 10. Analytics & instrumentation

Events required to measure §4 metrics. Every G-* must be measurable from these events.

| Event | Trigger | Properties | Metric it feeds |
|-------|---------|------------|-----------------|
| `<event_name>` | <when it fires> | `<k1:type, k2:type>` | G-1 |

## 11. Post-launch success criteria

How we know it worked. Each row ties back to a §4 metric.

- **7 days:** <threshold + which metric>
- **30 days:** …
- **60 days:** …
- **90 days:** …
- **Regression guardrails:** <metrics that must NOT get worse, and by how much>

## 12. Dependencies & stakeholders

Technical dependencies live in [feature.md §13](./feature.md) and [trd.md §7](./trd.md). Product-side ownership here.

- **Product stakeholders:** PM, Design, Eng lead, QA lead, DocOps, Marketing, Support, Legal (if applicable).
- **Cross-team dependencies:**
  - <team> — what we need from them — by when — owner on their side

## 13. Risks & mitigations (product-side)

Business, adoption, GTM, and stakeholder risks — technical risks live in [trd.md §16](./trd.md).

- **PR-1:** <risk> — likelihood/impact — mitigation.
- **PR-2:** …

## 14. Timeline & milestones (high level)

- **Spec approved:** <date>
- **Design approved:** <date>
- **Engineering start:** <date>
- **Feature-complete (code merged, flag off):** <date>
- **Beta / staged rollout start:** <date>
- **GA:** <date>

Engineering-level task breakdown lives in [trd.md §17](./trd.md).

## 15. Open questions

Product-side. Include unresolved items copied from feature.md §16 that are product-owned.

- **PQ-1:** <question> — owner: <who> — needed by: <milestone>

## 16. References

- [feature.md](./feature.md)
- [trd.md](./trd.md)
- <design URL or project + specific page names, e.g. "Choose Migration Path", "Audit Report Step">
- <research links, competitor scans, related tickets, prior specs>
