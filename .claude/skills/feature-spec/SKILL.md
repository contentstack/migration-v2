---
name: feature-spec
description: Capture a new feature or use case as a structured specification document. Use when the user wants to define, describe, scope, or spec out a new feature, use case, capability, or user story before design/implementation. This is step 1 of the development flow — its output feeds into the PRD/TRD creator skill and the test-cases creator skill, so it must produce complete, unambiguous, testable content. Trigger on phrases like "new feature", "define feature", "spec this out", "capture use case", "feature brief", "let's plan a feature", "before we build X".
---

# feature-spec

You are producing the **canonical feature specification** that downstream skills (PRD/TRD creator, test-case creator) will consume. Everything you write here becomes source-of-truth for design and testing. Missing or fuzzy content here will cascade into bad PRDs, wrong tests, and wasted implementation. Optimize for **completeness, unambiguity, and testability** — not brevity.

## Workflow

### 1. Gather input (hybrid)

- Accept whatever the user provided upfront — a one-line idea, a paragraph, a Jira link, whatever.
- Parse it and fill as many template sections as you confidently can.
- Then ask **targeted follow-up questions ONLY for missing/ambiguous fields that are load-bearing** for downstream skills. Do not re-ask what the user already answered.
- Prefer `AskUserQuestion` with 2–4 grouped questions per round. Do at most 2 rounds — if something is still unclear after that, mark it as an **Open Question** in the doc rather than blocking.

**Fields that MUST be non-empty before writing the doc** (ask if missing):
- Feature name + one-line summary
- Problem statement (the "why")
- Target users / personas
- At least one primary use case
- Explicit in-scope vs out-of-scope boundary
- At least one acceptance criterion per use case (Given/When/Then)

**Fields you may leave as "TBD — Open Question"**: metrics thresholds, exact NFR numbers, downstream integrations the user doesn't know yet. Never invent these.

### 2. Derive a slug

`<slug>` = kebab-case, ≤ 40 chars, derived from the feature name. Ask the user to confirm if ambiguous. Examples: `bulk-entry-migration`, `content-type-mapping-preview`, `save-selection-gate`.

### 3. Write the doc

- Path: `docs/features/<slug>/feature.md`
- Create the directory if it doesn't exist.
- Use the exact structure in `TEMPLATE.md` (same section order, same IDs). Downstream skills key off these section headings and ID prefixes — do not rename them.
- Every use case, functional requirement, and acceptance criterion **must have a stable ID** (`UC-1`, `FR-1.2`, `AC-1.1`). Downstream test cases and TRD tasks will reference these IDs — they are the contract.

### 4. Self-check before handing back

Before telling the user the spec is done, verify each item:

- [ ] Every use case (`UC-*`) has at least one acceptance criterion (`AC-*.*`) in Given/When/Then form.
- [ ] Every functional requirement (`FR-*`) is testable — a QA engineer could write a pass/fail test from it without asking questions.
- [ ] Non-goals section is non-empty (writing "N/A" is a smell — push the user).
- [ ] Edge cases and error scenarios section lists at least the obvious failure modes (empty input, invalid input, permission denied, network failure, concurrent edits — whichever apply).
- [ ] No pronouns without antecedents ("it", "this", "the system") that a fresh reader couldn't resolve.
- [ ] Open Questions section captures everything you couldn't nail down. If it's empty, double-check you didn't invent an answer.

If any check fails, fix it before ending the turn.

### 5. Report back

End the turn with:
- The path to the written file (as a markdown link).
- A one-line list of any Open Questions still outstanding.
- The next step: "Run the PRD/TRD creator skill on `docs/features/<slug>/feature.md`."

Do **not** produce a summary of the doc's contents — the user can open the file.

## Rules

- **Do not invent facts.** If the user hasn't said it, either ask or mark it `TBD — Open Question`. Fabricated requirements poison every downstream artifact.
- **Do not skip sections.** If a section genuinely doesn't apply, write `None.` and briefly say why. Empty section headings break downstream parsers.
- **Keep IDs stable and dense.** Don't leave gaps (`UC-1, UC-2, UC-5`). If you delete one during editing, renumber.
- **Acceptance criteria are the test contract.** Write them so a test-case generator can produce one automated test per criterion. Use concrete values, not "reasonable" or "appropriate".
- **Prefer numbered lists over prose** for use cases, requirements, criteria, edge cases — they're what downstream skills iterate over.
- **One feature per doc.** If the user's ask spans multiple features, list them and ask which to spec first.

## Handling designs, mockups, and references

When the user gives you a design link (Figma, Claude Design, Zeplin, screenshot, prototype URL, etc.), **do not download, mirror, or copy the design files into the repo**. The `feature.md` is the sole deliverable of this skill.

Instead:

1. **Read the design** (fetch the pages, view the screenshot, etc.) to understand the intended behavior — but keep the source-of-truth external.
2. **Record the reference** in §17 as: `<URL or filename> — <one-line context: which screens, which flow>`. If a design project has multiple pages, list the specific page names being cited (e.g. "Choose Migration Path", "Audit Report Step").
3. **Transcribe the behavior into the doc**, not the design:
   - Screen-by-screen flow steps → §7 User flows (or inline in §6 Main flow).
   - Visible states, controls, and their outcomes → §8 Functional requirements and §11 Acceptance criteria.
   - Empty states, error toasts, disabled/gated buttons → §12 Edge cases & error scenarios.
   - Copy strings that are load-bearing (button labels the user gates on, error messages, empty-state text) → quote them verbatim in the relevant AC.
4. **Never** create `docs/designs/`, `docs/mockups/`, or any similar folder. Never fetch and save `.html`, `.png`, `.fig`, or design system asset files as part of this skill. If the user explicitly asks for the designs to be imported locally, tell them that is a separate task outside this skill's scope.

Rationale: designs update independently and would rot; PRD/TRD and test-case generators read the doc's text and IDs, not markup; a stale local mirror is worse than no mirror. The doc must stand on its own so that a reader who can't open the design still gets an unambiguous, testable spec.
