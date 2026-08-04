# PRD: CS→CS Project Dashboard

- **Slug:** `cs-project-dashboard`
- **Related:** [feature.md](./feature.md) · [trd.md](./trd.md)
- **Status:** Draft
- **Product owner:** Chirag Chavan
- **Engineering lead:** Chirag Chavan
- **Design lead:** `TBD — Open Question` (PQ-1)
- **Created:** 2026-08-04
- **Last updated:** 2026-08-05

> **Revision 2026-08-05 — organization scoping removed.** Projects are no longer
> organization-specific, so the organization switcher is gone along with the use
> case it served. IDs below follow [feature.md](./feature.md)'s renumbered set;
> `PQ-*` and `PR-*` keep their original numbers, because they are decision history.
> The single largest product consequence is that this feature now changes route
> contracts in two already-shipped features — see PR-4.

## 1. TL;DR

The v3 (Contentstack → Contentstack) migration tool currently has no way to list or create a project, so any work done in it is reachable only by keeping the URL by hand. This gives v3 the landing page it is missing: list the projects the user owns, search them, open one to resume where it was left, and create a new one. Functionality mirrors the v2 tool's Projects page; the visual design follows the "CS to CS Dashboard" page in the Claude Design project, with one deliberate deviation where that design assumes an organization switcher this feature does not have.

## 2. Problem & opportunity

See [feature.md §2](./feature.md).

Product-side context the spec does not carry:

- **This is the gate on v3 being demoable.** The three v3 features shipped so far (Source, Destination, wizard chrome) are all reachable only by typing a URL that contains a project id which no UI can produce. Until this page exists, v3 cannot be shown to anyone who is not one of its authors, which blocks the Stage 2 (opt-in) cohort that all three sibling PRDs assume.
- **Cost of not doing it:** every v3 feature built after this one inherits the same problem, and each one adds more work that is unreachable. The cost grows with the number of features, not with time.
- **It also removes a defect and a whole concept, not just a gap.** Every v3 project endpoint is mounted under `/v3/org/:orgId/...`, and nothing in the UI supplies that value — so the wizard reads it from a hand-typed query parameter, and without it the Destination panel silently skips its reads. That segment existed only because a project used to belong to an organization. Removing organization scoping removes the segment, which closes the defect by deletion rather than by wiring. Recorded as TQ-2 in [migration-wizard-chrome/trd.md](../migration-wizard-chrome/trd.md).
- **No market or research data.** This is an internal tool for Contentstack solutions teams; there is no competitive scan or sizing exercise behind it.

## 3. Target users

See [feature.md §3](./feature.md).

- **One persona: the migration operator.** Every requirement below serves them.
- **The secondary persona was dropped in this revision.** A "solutions architect / migration lead overseeing migrations across organizations" was inferred purely from the organization switcher in the design. With organization scoping removed there is nothing that persona was needed to justify, so carrying it would have been carrying an unvalidated assumption for its own sake.
- **Jobs to be done:** "show me what I was working on"; "let me pick up where I stopped without re-walking the wizard"; "let me start a new migration without leaving the tool".
- **Adoption assumption:** operators arrive at this page as their entry point to v3 and treat it the way they already treat v2's Projects page. No onboarding or training is planned, because the page is deliberately a familiar shape.

## 4. Product goals & success metrics

See [feature.md §4](./feature.md) for the goal statements.

**Instrumentation constraint that shapes every row below:** there is no analytics or telemetry layer anywhere in v3 or in v2's UI — no event pipeline, no product analytics SDK. Client-side metrics therefore cannot be specified against real infrastructure, and inventing an event table nothing emits would misrepresent what ships. Confirmed decision: defer instrumentation and record it as PQ-2.

- **G-1:** A migration operator can find and reopen any existing project without needing a stored URL.
  - **Metric:** completeness of the list — proportion of the user's projects in the (region, owner) scope that appear on the page.
  - **Target:** 100%, verified by the automated acceptance tests for AC-1.1, AC-1.3 and AC-1.4 rather than by production telemetry.
  - **Type:** north-star — verified at build time.
- **G-2:** Reopening a project resumes at the furthest step it reached, not the first step.
  - **Metric:** resume correctness across the three derivable cases (nothing persisted → first step; source ready → Audit; destination persisted → Destination).
  - **Target:** all three cases correct, verified by AC-3.1, AC-3.2 and AC-3.3.
  - **Type:** north-star — verified at build time.
- **G-3:** An operator can create a project and begin configuring its source without leaving the flow.
  - **Metric:** create-to-wizard transitions with no intermediate page.
  - **Target:** 100% of successful creations land on the wizard's first step, verified by AC-4.7.
  - **Type:** leading indicator — verified at build time.
- **G-4:** No v3 URL requires an organization.
  - **Metric:** every project-scoped v3 endpoint resolves from a project id alone, and the Destination panel's mount-time reads succeed with no query parameters present.
  - **Target:** 100%, verified by AC-3.4 plus the `cs-source-selection` and `cs-destination-selection` suites staying green against the new paths.
  - **Type:** guardrail-not-to-regress — this is the defect described in §2, and it must not come back.
- **G-5:** Post-launch adoption and time-to-find.
  - **Metric:** `TBD` — not measurable at launch (PQ-2).
  - **Target:** `TBD` (PQ-2).
  - **Type:** leading indicator.

G-1 through G-4 are deliberately verified by acceptance tests rather than by production metrics. For an internal tool with no telemetry, a passing test is the only honest evidence available, and claiming otherwise would produce numbers nobody collects.

## 5. Non-goals

See [feature.md §5](./feature.md), which now leads with organization scoping itself as an explicit non-goal.

Product-side scope cuts that surfaced during this prioritization:

- **The organization switcher is gone, not deprioritized.** The previous revision had it at P1. It is now out of scope entirely, and so is the UC it served.
- **The user avatar is P2.** It is the only element on the page that needs an endpoint of its own. If that is inconvenient, the avatar is the correct thing to drop — losing it costs nothing functional. Note this is a *weaker* reason to drop it than in the previous revision, where the avatar was also the sole justification for a breaking change; that breaking change is now reverted.
- **The error state is P1.** A failed list load currently produces nothing at all, so any error state is an improvement; a polished one is not launch-blocking.
- **Verbatim design copy is not negotiable where the design specifies it**, but the states the design omits (loading, first-run empty, error) and the top bar's substitute for the organization block ship with copy drafted by engineering and reviewed after launch (PQ-1).

## 6. Requirements (prioritized)

Every `FR-*` from [feature.md §8](./feature.md), with a priority. Full text lives in the spec; these are one-line reminders. Renumbered by the 2026-08-05 revision — this table follows the new set.

### Top bar

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-1.1 | Top bar: product mark, `Migrate to Contentstack`, avatar | P0 | Page frame. Substitutes for the design's organization block (Q-16) |
| FR-1.2 | Avatar shows the user's initials | P2 | Cosmetic; the only thing requiring the endpoint in FR-1.3 |
| FR-1.3 | Name/email come from a dedicated user endpoint | P2 | Constrains *how* FR-1.2 is built; moot if FR-1.2 drops |
| FR-1.4 | Avatar fallback chain (initials → one name → email → icon) | P2 | Ships with FR-1.2 or not at all |
| FR-1.5 | Avatar never renders as an empty circle | P2 | Ships with FR-1.2 or not at all |
| FR-1.6 | This bar is not the wizard chrome's app bar component | P0 | Architectural; they now show the same name but serve different pages |

### Title row

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-2.1 | Literal heading `Migration Projects` | P0 | Design copy |
| FR-2.2 | Back control rendered disabled, out of tab order | P2 | Confirmed decision; a dead control, so lowest priority |
| FR-2.3 | Search field with placeholder `Search projects` | P0 | UC-2 |
| FR-2.4 | Primary action labelled `New Project` | P0 | UC-4 |
| FR-2.5 | `New Project` is a single control, not a dropdown | P1 | Follows from import being out of scope |
| FR-2.6 | `New Project` hidden when the list is empty | P1 | Prevents two create affordances; FR-8.4 covers the empty case |
| FR-2.7 | `New Project` shown whenever ≥1 project is loaded | P0 | Without it there is no way to create a second project |

### Project list and grid

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-3.1 | Request the list once on mount, with no organization parameter | P0 | UC-1, and G-4 |
| FR-3.2 | Re-rendering never re-issues the request | P1 | NFR-2 |
| FR-3.3 | Keep the unfiltered list separate from the filtered view | P0 | The only way to distinguish the two empty states |
| FR-3.4 | Exactly one card per project in the filtered view | P0 | UC-1 |
| FR-3.5 | Grid reflows without a horizontal page scrollbar | P1 | Design uses auto-fill; degradation is cosmetic |
| FR-3.6 | No pagination | P0 | Scope statement — bounds FR-3.1 and NFR-1 |

### Project card

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-4.1 | Card renders the project name | P0 | Without it the card is unidentifiable |
| FR-4.2 | Long names truncate visually only; full name stays in the DOM | P1 | Correctness of copy/paste; not launch-blocking |
| FR-4.3 | Literal `Source` label above literal `Contentstack` | P1 | Fixed value; informative, not functional |
| FR-4.4 | Literal `Project Status` label above the badge | P0 | The at-a-glance signal the page exists for |
| FR-4.5 | Footer clock indicator and last-modified time | P1 | Secondary information |
| FR-4.6 | Relative under 7 days, `MMM D, YYYY` at or beyond | P1 | Ships with FR-4.5 |
| FR-4.7 | The whole card is one activatable control | P0 | UC-3 |
| FR-4.8 | Activating navigates into the wizard | P0 | UC-3 |
| FR-4.9 | Opens the furthest step reached, derived | P0 | G-2 — the differentiator over a plain list |
| FR-4.10 | No navigation for a project with no valid id | P1 | Defensive |
| FR-4.11 | Target identifies project + step only, no organization | P0 | G-4 |
| FR-4.12 | Cards are keyboard-reachable and activatable | P1 | NFR-5 |

### Status badge

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-5.1 | Derived per render, never read from a stored field | P0 | Confirmed decision; the anti-staleness property |
| FR-5.2 | `Draft` when nothing is persisted | P0 | One of only two reachable states |
| FR-5.3 | `In Progress` when source or destination is persisted | P0 | The other reachable state |
| FR-5.4 | Distinct icon per status | P1 | NFR-6 wants text as the primary signal, so the icon is secondary |
| FR-5.5 | `Completed` implemented though currently unreachable | P1 | Avoids rework when Migrate lands; ships no user-visible change |
| FR-5.6 | Undeterminable status falls back to `Draft` | P1 | Defensive |

### Search

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-6.1 | Filter the loaded list with no network request | P0 | UC-2 |
| FR-6.2 | Case-insensitive substring match on name only | P0 | UC-2 |
| FR-6.3 | Initial value from the `search` query parameter | P2 | Convenience on back-navigation |
| FR-6.4 | Clearing restores the full list | P0 | Without it search is a trap |
| FR-6.5 | Visible clear control when non-empty | P2 | FR-6.4 is reachable by selecting and deleting |
| FR-6.6 | Whitespace-only search treated as empty | P1 | Prevents a confusing empty state |

### Create project

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-7.1 | Modal with a name field and a description field | P0 | UC-4 |
| FR-7.2 | Name required | P0 | A nameless project defeats the whole page |
| FR-7.3 | Name at most 200 characters | P1 | Matches v2; guards storage and layout |
| FR-7.4 | Name may not begin with whitespace | P2 | Matches v2; cosmetic |
| FR-7.5 | Description optional | P0 | Making it required would be a regression from v2 |
| FR-7.6 | Description at most 255 characters | P1 | Matches v2 |
| FR-7.7 | Submit inoperative while the name is invalid | P1 | FR-7.2 is the real gate; this is the affordance |
| FR-7.8 | Send only name and description; server owns the rest | P0 | Security — client must not set owner or region |
| FR-7.9 | Discard leftover wizard state before navigating | P0 | Otherwise the previous project's state leaks into the new one |
| FR-7.10 | Navigate to the wizard's first step | P0 | G-3 |
| FR-7.11 | Cancel (control, close, or overlay) creates nothing | P0 | Creation is irreversible; v3 has no delete |
| FR-7.12 | A second submit cannot start a second creation | P0 | Same reason — a duplicate project cannot be removed |
| FR-7.13 | Failure keeps the modal open and preserves input | P1 | Retypability; not launch-blocking |
| FR-7.14 | Modal visuals follow the existing v3 modals | P1 | The design has no modal (PQ-1 / spec Q-3) |

### Loading, empty and error states

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-8.1 | Placeholder cards while loading, same footprint as real ones | P1 | Prevents layout shift; a bare wait is survivable |
| FR-8.2 | Placeholders are not activatable | P2 | Defensive |
| FR-8.3 | First-run empty state when zero projects and no search | P0 | The most common state for a brand-new feature |
| FR-8.4 | First-run empty state contains a create control | P0 | With FR-2.6, the only create affordance in that state |
| FR-8.5 | Search-empty state with the design's exact copy | P0 | UC-2; verbatim design copy |
| FR-8.6 | The two empty states are mutually exclusive | P0 | Showing the wrong one misreports the situation |
| FR-8.7 | Error state with retry on a failed list load | P1 | UC-6 (P1) |
| FR-8.8 | Retry re-issues the request without a page reload | P1 | Ships with FR-8.7 |
| FR-8.9 | Drafted states flagged for design sign-off | — | No code change — a process obligation, tracked as PQ-1 |

### Data and scoping

| ID | Requirement (short) | Priority | Rationale / notes |
|----|---------------------|----------|-------------------|
| FR-9.1 | Project record carries a name | P0 | Nothing on the card works without it |
| FR-9.2 | Project record carries an optional description | P1 | Collected by FR-7.1 but displayed nowhere (PQ-3) |
| FR-9.3 | Project record carries its region | P0 | Required by the FR-9.6 filter |
| FR-9.4 | Project record carries its owner | P0 | Required by the FR-9.6 filter |
| FR-9.5 | Soft-delete marker, excluded from the list | P1 | No delete action exists yet (spec Q-6), so nothing sets it |
| FR-9.6 | List filters on region + owner + not-deleted | P0 | Security and correctness |
| FR-9.7 | No organization field on the record | P0 | The core of this revision |
| FR-9.8 | No stored status field | P0 | Enforces the derived-status decision |
| FR-9.9 | Both endpoints require a valid session | P0 | Security |
| FR-9.10 | `name`, `region`, `owner` are required, not optional | P0 | What prevents another nameless record being created as a side effect |
| FR-9.11 | Single-project reads apply the same three-way scope | P0 | Without it the URL bypasses FR-9.6 entirely |
| FR-9.12 | A scope miss answers "not found", never "forbidden" | P0 | Does not confirm existence of projects the caller cannot see |
| FR-9.13 | No v3 endpoint path contains an organization segment | P0 | G-4; the requirement that touches two shipped features |
| FR-9.14 | Pre-existing unscoped records stay invisible; no relaxation | P0 | Enforces the Q-7 decision as a negative requirement |

**Priority definitions:**
- **P0** — must ship for launch; the feature does not work without it.
- **P1** — should ship for launch; missing degrades but doesn't block.
- **P2** — nice to have; fast-follow acceptable.

**Distribution:** 39 P0, 26 P1, 14 P2, 1 no-code. The P2 group is dominated by the avatar (FR-1.2–1.5) and the three conveniences (FR-2.2, FR-6.3, FR-6.5) — all droppable without touching a use case.

## 7. User experience

See [feature.md §6](./feature.md) (use cases) and [§7](./feature.md) (flows).

Product-side UX decisions the spec does not cover:

- **Copy tone.** Where the design specifies a string, it is used verbatim and is not open to interpretation — `Migration Projects`, `Search projects`, `New Project`, `Source`, `Project Status`, `Contentstack`, `Draft`, `In Progress`, `Completed`, `No projects match your search`, `Try a different name or clear the search.` Note that the design's badge reads `In Progress` with a capital P while v2's equivalent reads `In progress`; the design wins on this page.
- **The one string that is NOT from the design** is the top bar's `Migrate to Contentstack`, which replaces the organization block. It is taken from the wizard chrome's app bar rather than invented, so the two surfaces read as one product. Flagged as PQ-1.
- **Copy for the three states the design omits** (loading, first-run empty, error) is drafted by engineering in the design's voice — plain, second person, no exclamation marks, no illustrations, because v3 owns no image assets. Reviewed after launch (PQ-1).
- **First-run guidance.** The first-run empty state is the entire onboarding. There is no tour, no tooltip sequence, no sample project. Rationale: the page has three controls and the operator already knows the v2 equivalent.
- **Error copy standard.** State what failed and what the user can do, in that order, and offer the action as a control rather than an instruction ("Retry", not "please try again"). Never surface a raw status code or an exception message.
- **Empty-state approach.** Two distinct states, never a shared one — a first-time user and a user whose search missed are in completely different situations, and v2 already treats them separately.
- **i18n.** Out of scope. Every string is hardcoded English, matching all three sibling v3 features. v2's Projects page fetches its copy from Contentstack entries; v3 deliberately does not (feature.md C-3), so this page introduces no localization surface and also no path to one.
- **Irreversibility disclosure.** Creating a project cannot be undone in v3, because nothing in v3 can delete a project (spec Q-6). The create modal does **not** warn about this, on the grounds that a stray project is inert clutter rather than a destructive act — unlike creating a stack, which the Destination panel does warn about because it touches the customer's Contentstack organization.

## 8. Non-functional requirements

See [feature.md §9](./feature.md) for NFR-1 through NFR-9.

Product-side additions:

- **Brand guidelines.** The page must read as Contentstack: the design's violet gradient product mark and the `--brand-strong` primary action are load-bearing brand elements, not decoration.
- **Accessibility is a launch requirement, not a fast-follow.** NFR-5 and NFR-6 (keyboard operability, visible focus, status not conveyed by color alone) are P0-equivalent even where the requirement they serve is P1. The whole-card-as-a-button pattern in FR-4.7 makes keyboard access easy to get wrong, which is why FR-4.12 exists as its own requirement.
- **Launch-market i18n scope:** English only. See §7.
- **Licensing / compliance sign-off:** none required. No new third-party dependency, no new data category, no new data residency surface. The only new personal data touched is the user's own name and email, read for display and never persisted (feature.md §10).

## 9. Launch & rollout plan

- **Rollout mechanism:** **Same as all three sibling features** — gated purely by the `/v3` route existing and by which entry points are linked. There is no feature-flag system in this repository. (Confirmed decision.)
- **Feature flag name:** none (see [trd.md §14](./trd.md)).
- **Cohort staging:**
  - **Stage 1 (internal):** the page ships with the new list and create endpoints deployed, and **the organization segment removed from every v3 project path in the same deployment**. The team reaches the page at the v3 projects route and uses it as the real entry point, replacing hand-typed URLs. Entry criteria: all P0 requirements green, and the full existing v3 suite green — including `cs-source-selection` and `cs-destination-selection`, whose paths change here.
  - **Stage 2 (opt-in):** the v3 entry point is linked for selected users and self-hosters — the same cohort the three sibling features assume, since all four are reached through this page.
  - **GA:** part of v3 becoming the default migration entry point. Not owned by this feature alone; it is the same GA decision as Source, Destination and the chrome.
  - **Note this revision collapsed the previous three stages into two.** The old Stage 2 existed to switch the wizard's organization source gradually, with `?orgId=` retained as a fallback. There is no longer anything to switch gradually: the segment is removed, so client and server must deploy together. That is a real loss of gradualism, and [trd.md §15](./trd.md) records what it costs on rollback.
- **Kill switch:** stop linking the v3 projects route, and/or revert the deployment. No runtime toggle. **Asymmetry worth stating:** once Stage 1 has shipped, this page is the only producer of a valid project id, so removing it leaves the wizard reachable but unusable by anyone without a saved URL.
- **Comms plan:** changelog entry plus an internal note when the page ships. The note must say explicitly that **existing `?orgId=` URLs stop working**, because that is the only user-visible break in this feature. A short internal walkthrough is worth doing, since this is the first v3 surface anyone outside the authors can use. Owner: `TBD` (PQ-4).

## 10. Analytics & instrumentation

**No events are specified, and this is a deliberate decision, not an omission.** There is no analytics or telemetry layer anywhere in v3 or in v2's UI — no event pipeline, no product analytics SDK, no client-side collection of any kind. Specifying an event table against infrastructure that does not exist would produce a document that reads as though the metrics were live.

| Event | Trigger | Properties | Metric it feeds |
|-------|---------|------------|-----------------|
| — | — | — | G-1 · G-2 · G-3 · G-4 — measured by automated acceptance tests at build time (see §4), not by events |
| — | — | — | G-5 — `TBD`, blocked on PQ-2 |

What **is** available at launch, without new infrastructure:

- **Server-side log of project creation** (feature.md NFR-9): the new project id, deliberately excluding the name and description because they are customer-supplied content. This yields creation counts and creation error rates from logs alone, which is the closest thing to an adoption signal this feature can produce. Note the previous revision also logged an organization id; there is no longer one to log.
- No client-side funnel, so "time to find a project" and "resume rate" are not measurable at launch. Both are recorded against PQ-2.

## 11. Post-launch success criteria

Because there is no telemetry (§10), these are stated as **observable outcomes checked by hand or read from server logs**, not as dashboard thresholds.

- **7 days:** every team member who has used v3 has stopped using hand-typed project URLs and reaches v3 through this page. Zero reports of a broken bookmark that cannot be recovered by going through the page — the `?orgId=` URLs that stop working are the expected break, and the recovery is "open it from the list".
- **30 days:** zero reports of a project that exists but does not appear in the list (guards G-1 and the FR-9.6 filter, which is the requirement most likely to hide something it should not). Zero reports of a project reopening at the wrong step (guards G-2).
- **60 days:** no project has been created that the user then wanted removed — or if any has, spec Q-6 (where a project gets deleted) is escalated from "open question" to scheduled work, since this feature adds the soft-delete field but no action that sets it.
- **90 days:** the median project count per user is known, so the pagination threshold in spec Q-10 can be answered with data instead of a guess. Read from the store.
- **Regression guardrails:**
  - The Destination panel's mount-time reads must not regress — G-4 exists precisely because they are currently broken without `?orgId=`. AC-3.4 is the automated guard.
  - **The `cs-source-selection` and `cs-destination-selection` suites must stay green**, since their route contracts change here. This is the primary risk this feature carries and the main thing to watch at Stage 1.
  - The 90 existing `migration-wizard-chrome` tests must stay green.
  - No project may become invisible other than the pre-existing unscoped records that feature.md FR-9.14 knowingly abandons.

## 12. Dependencies & stakeholders

Technical dependencies live in [feature.md §13](./feature.md) and [trd.md §7](./trd.md). Product-side ownership here.

- **Product stakeholders:**
  - **Product owner / Engineering lead:** Chirag Chavan (same person; this is a small internal tool).
  - **Design lead:** `TBD` (PQ-1) — owns the states the design omits, the create modal, the card hover treatment, and **what replaces the organization block in the top bar** (spec Q-16).
  - **QA:** `TBD` (PQ-4). The test-case matrix generated from feature.md is the QA artifact; who executes the manual (`Automated = N`) rows is unassigned.
  - **DocOps / Marketing / Support / Legal:** not involved. Internal tool, no external launch, no new data category.

- **Cross-team dependencies** — all inside this repository, which is why none has an external owner:
  - **`cs-source-selection`** — owns the persisted `source` document that the derived status and resume step read, **and the persistence routes that lose their organization segment**. Needed: agreement to change those route paths, and its suite green afterwards. By: Stage 1. Owner: Chirag Chavan. Realizes feature.md DEP-2.
  - **`cs-destination-selection`** — same, for the `destination` document and its own persistence routes, plus the removal of the `orgId` prop threaded into its panel. By: Stage 1. Owner: Chirag Chavan. Realizes DEP-3.
  - **`migration-wizard-chrome`** — its `?orgId=` handling is deleted rather than rewired, and it owns the step vocabulary the resume step is expressed in. Its 90 tests are the signal. Owner: Chirag Chavan. Realizes DEP-1.
  - **Contentstack Management API** — supplies the user's name and email via the new user endpoint. External, unversioned from our side, and already depended upon by all three sibling features. No SLA we control. Realizes DEP-7.

## 13. Risks & mitigations (product-side)

Technical risks live in [trd.md §16](./trd.md); feature.md §15 carries the spec-level risks R-1 through R-8. Product-side only here.

- **PR-1:** **Only two of three badges are reachable at launch**, so a stalled project and an active one look identical (feature.md R-1). An operator managing several migrations may read `In Progress` as "someone is working on this". Likelihood: certain. Impact: medium — it undercuts the at-a-glance value the page is largely for. Mitigation: accept for this release; the `Completed` path is implemented (FR-5.5) so the Migrate step adds a signal, not a rework. Revisit `Failed` with design (spec Q-4).
- **PR-2:** **The page ships a visibly dead control** — the disabled back button (FR-2.2), which users may reasonably read as a bug. Likelihood: medium. Impact: low. Mitigation: confirmed decision, taken to keep the design's layout intact; revisit when a path-chooser page exists.
- **PR-3:** **The first-run empty state — the state every new user sees first — ships without design review** (PQ-1, feature.md R-6). Likelihood: certain. Impact: medium, because it is a first impression and first impressions of internal tools set expectations for the whole of v3. Mitigation: draft it in the design's established voice, and treat design sign-off as a launch-week task rather than a launch blocker.
- **PR-4:** **This feature changes route contracts in two already-shipped features**, so a regression in Source or Destination would be attributed to this page — and it now does so without the gradual fallback the previous revision had. Likelihood: medium. Impact: high — it would erode confidence in v3 at exactly the moment the page makes v3 demoable. Mitigation: those features' existing suites are the acceptance signal (§11 guardrails); the change is mechanical rather than behavioural; and client and server must deploy together, which [trd.md §15](./trd.md) states plainly rather than leaving to be discovered.
- **PR-5:** **Existing `?orgId=` URLs stop working.** Anyone who bookmarked a wizard URL loses it. Likelihood: certain. Impact: low — the affected population is the authors, and the recovery is opening the project from the list. Mitigation: name it explicitly in the Stage 1 comms (§9) rather than letting someone discover it as a bug.
- **PR-6:** **No adoption data will exist** to justify further v3 investment, because there is no telemetry (§10, PQ-2). Likelihood: certain. Impact: medium — decisions about v3's roadmap will be made on anecdote. Mitigation: the server-side creation log gives at least creation counts; escalate PQ-2 if v3 investment needs defending.
- **PR-7:** **The description field is collected and never displayed** (FR-9.2, PQ-3). A user who writes a careful description will never see it again, which teaches them the field is pointless. Likelihood: certain. Impact: low. Mitigation: keep it for v2 parity and future use; decide with design whether the card or a future project-settings surface should show it.
- **PR-8:** **The top bar visibly differs from the design** (FR-1.1), so a reviewer comparing the two will find a discrepancy that is intentional. Likelihood: certain. Impact: low. Mitigation: it substitutes the wizard chrome's own product name rather than something invented, and it is flagged for design review as spec Q-16.

## 14. Timeline & milestones (high level)

No dates are committed. This is an internal tool with a single engineer and no external launch, so a date-based plan would be fiction. Milestones are stated as ordered gates, each with a concrete entry criterion.

- **Spec approved:** [feature.md](./feature.md), revised 2026-08-05 to remove organization scoping.
- **PRD / TRD approved:** this document and [trd.md](./trd.md).
- **Design approved:** blocked on PQ-1 (the omitted states, the create modal, card hover, and the top bar substitute). Not a blocker for engineering start — the affected requirements are P1/P2 and are drafted in the interim.
- **Engineering start:** on TRD approval. First phase is the data model, the two endpoints, and the path change ([trd.md §9](./trd.md)).
- **Feature-complete:** all P0 requirements green, full v3 suite green including the two features whose routes change.
- **Stage 1 (internal), Stage 2 (opt-in), GA:** §9.

Engineering-level task breakdown lives in [trd.md §17](./trd.md).

## 15. Open questions

Product-side. Items in [feature.md §16](./feature.md) that are design- or product-owned are carried here; engineering-owned ones stay in the spec or move to [trd.md §18](./trd.md).

- **PQ-1:** Who is the design owner for this page, and can they sign off on the five things the design does not specify or that this feature deviates from — the first-run empty state copy, the loading placeholder treatment, the create-project modal, the card's hover values, and **the top bar's substitute for the organization block**? Carries feature.md Q-1, Q-3, Q-15 and Q-16. — owner: `TBD` — needed by: launch week (not engineering start).
- **PQ-2:** Should v3 acquire any analytics or telemetry, and if so what? Without it G-5 has no metric, and no adoption or funnel data will exist for any v3 feature. Carries feature.md Q-11. — owner: product — needed by: whenever v3 investment needs justifying.
- **PQ-3:** The description is collected at creation and displayed nowhere (FR-9.2, PR-7). Should the card show it, should a future project-settings surface show it, or should the field be dropped? — owner: design — needed by: post-launch.
- **PQ-4:** Who owns QA execution for the manual (`Automated = N`) test rows, and who owns the comms/changelog entries in §9 — including the note that `?orgId=` URLs stop working? — owner: `TBD` — needed by: Stage 1.
- **PQ-5:** Should the create modal warn that a project cannot be deleted (§7, spec Q-6)? Deciding "no" is fine, but it should be a decision rather than an oversight, since v3 genuinely cannot remove a project today. — owner: product — needed by: launch week.

Deliberately **not** carried here, because they are engineering-owned and belong to the TRD: feature.md Q-10 (pagination threshold), Q-12 (browsers), Q-13 (duplicate names), and Q-6 (where a project gets deleted, which is a scoping question for a future feature).

## 16. References

- [feature.md](./feature.md) — the spec this PRD elaborates, revised 2026-08-05.
- [trd.md](./trd.md) — the technical counterpart.
- Claude Design project `132abb68-eaa7-494b-9820-3f9cf5fa6f15`, page **"CS to CS Dashboard"** — the page this feature implements. Its top bar's organization block is deliberately not implemented (FR-1.1, spec Q-16). Reference only; not mirrored into the repository.
- Claude Design project `132abb68-eaa7-494b-9820-3f9cf5fa6f15`, page **"Choose Migration Path"** — the page the disabled back control (FR-2.2) points at, not implemented here.
- [../cs-source-selection/feature.md](../cs-source-selection/feature.md) · [../cs-destination-selection/prd.md](../cs-destination-selection/prd.md) · [../migration-wizard-chrome/prd.md](../migration-wizard-chrome/prd.md) — the three sibling v3 features. Their §9 rollout sections establish the no-feature-flag staging model this PRD follows; the first two also own route contracts this feature changes.
- `ui/src/pages/Projects/index.tsx` · `ui/src/components/ProjectsHeader/index.tsx` · `ui/src/components/Card/index.tsx` · `api/src/services/projects.service.ts` — the v2 implementation whose functionality this feature reproduces. v2 scopes projects by organization; this feature deliberately does not. Reference only.
