# Feature Spec: <Feature Name>

- **Slug:** `<slug>`
- **Status:** Draft
- **Author:** <name>
- **Created:** <YYYY-MM-DD>
- **Last updated:** <YYYY-MM-DD>

## 1. Summary

One or two sentences. What the feature is, at the highest level. No jargon, no implementation details.

## 2. Problem statement

What problem does this solve? Who feels the pain today, and what does the current (broken/absent) experience look like? Quantify if possible ("Users abandon migration ~40% of the time at step 3 because…").

## 3. Target users / personas

Who is this for? List each persona with a one-line description of their role and what they care about. If more than one, note the primary vs secondary.

- **Persona A** — role, context, primary goal.
- **Persona B** — role, context, primary goal.

## 4. Goals & success metrics

What outcomes count as "this worked"? Each goal should be measurable.

- **G-1:** <goal statement> — measured by: <metric + threshold, or `TBD — Open Question`>
- **G-2:** …

## 5. Non-goals / out of scope

Explicitly what this feature will **not** do. This bounds the PRD/TRD and prevents scope creep. Do not leave empty.

- <thing we are not doing, and briefly why>
- …

## 6. Use cases

Each use case is a numbered, self-contained scenario. Every use case must have at least one acceptance criterion in §11.

### UC-1: <short title>

- **Actor:** <persona>
- **Trigger:** <what starts this flow>
- **Preconditions:** <state the system/user must be in>
- **Main flow:**
  1. <step>
  2. <step>
  3. <step>
- **Postconditions / success state:** <what's true when this completes successfully>
- **Alternate flows:**
  - <alt path or variant>
- **Priority:** P0 / P1 / P2

### UC-2: <short title>

…

## 7. User flows (optional detail)

If any UC has a non-obvious multi-screen flow, describe the step-by-step here or link to design. Reference `UC-*` IDs. If none, write `Covered inline in §6.`

## 8. Functional requirements

Numbered, atomic, testable statements. One requirement per bullet. If a bullet contains "and", split it.

- **FR-1:** The system MUST <do X> when <condition>.
- **FR-2:** The system MUST <do Y>.
- **FR-3:** …

Group by area if long:

### FR — Data
- **FR-1.1:** …

### FR — UI
- **FR-2.1:** …

## 9. Non-functional requirements

Concrete numbers or `TBD — Open Question`. Do not write "fast" or "secure".

- **NFR-1 (Performance):** <e.g. p95 response < 500ms for X operation on N=1000 items>
- **NFR-2 (Security):** <e.g. all endpoints require valid session; PII must not appear in logs>
- **NFR-3 (Accessibility):** <e.g. WCAG 2.1 AA for all new screens>
- **NFR-4 (Reliability):** <e.g. no data loss on browser refresh mid-flow>
- **NFR-5 (Compatibility):** <browsers, OS, API versions>
- **NFR-6 (Observability):** <what must be logged/metric'd>

## 10. Data & entities

Key data model changes: new entities, new fields, ownership, retention. Focus on WHAT, not HOW (schema/migrations belong in TRD).

- **Entity: `<name>`** — purpose, key fields, lifecycle.

## 11. Acceptance criteria

Given/When/Then form. One or more per use case. Each `AC-<UC>.<n>` maps to at least one automated test.

### AC for UC-1

- **AC-1.1:**
  - **Given** <initial state>
  - **When** <action>
  - **Then** <observable outcome, with concrete values>
- **AC-1.2:** …

### AC for UC-2

- **AC-2.1:** …

## 12. Edge cases & error scenarios

Explicit failure modes. Each becomes a negative test.

- **EC-1:** <condition> → <expected system behavior + user-visible message>
- **EC-2:** Empty / missing input → …
- **EC-3:** Invalid input → …
- **EC-4:** Permission denied → …
- **EC-5:** Network / timeout / server error → …
- **EC-6:** Concurrent edit / stale data → …
- **EC-7:** Large payload / N=max → …

## 13. Dependencies & integrations

What this feature depends on or touches. Include internal modules, external APIs, other in-flight features, feature flags.

- **DEP-1:** <name> — nature of dependency (blocking? read-only? contract owner?)

## 14. Assumptions & constraints

What we're assuming to be true, and what we can't change.

- **A-1:** <assumption>
- **C-1:** <constraint (regulatory, technical, timeline, org)>

## 15. Risks

- **R-1:** <risk> — likelihood/impact — mitigation.

## 16. Open questions

Things not resolved yet. Every `TBD` above should have a matching entry here.

- **Q-1:** <question> — owner: <who will answer> — needed by: <milestone>
- **Q-2:** …

## 17. Out-of-band references

Links to designs, tickets, prior discussions, related specs. **Reference only — do not copy design files into the repo.** For a multi-page design project, list the specific pages being cited so downstream readers know what to open.

- <link or filename> — <one-line context: which screens/flows this covers>

---

**Downstream contract:** IDs in this document (`UC-*`, `FR-*`, `AC-*`, `EC-*`, `NFR-*`, `DEP-*`) are stable references. The PRD/TRD creator skill and test-case creator skill will cite them. Do not renumber without updating consumers.
