---
name: test-case
description: Turns a PRD/TRD into a structured test-case matrix, delivered as three files — a .md document, a .csv (for import into spreadsheets/QA tools), and a standalone .html report. Use whenever a PRD/TRD exists and a QA-ready test-case matrix is needed before development starts. Fully generic — works for any feature, any project, any domain. Callable standalone by pointing it at a PRD/TRD file, or as the second stage in a larger pipeline (after a use-case/PRD-TRD skill, before a test-development skill).
---

# Test Case Generation Skill

## Purpose

Convert a PRD/TRD into a complete, structured list of test cases — nothing more. This skill's only deliverable is that test-case data, rendered as three files (`.md`, `.csv`, `.html`). It does not write test code, does not execute anything, and does not touch any codebase.

Every test case this skill produces must be traceable back to something explicitly stated in the PRD/TRD it was given. This skill never invents requirements, assumes unstated behavior, or fills gaps with guesses. If the input document is ambiguous or silent on some point, that goes into a "Gaps / Needs Clarification" section instead of becoming a fabricated test case.

This skill has **no knowledge of, and must not reference, any specific codebase, existing test files, existing skills, or prior project conventions.** It works from the PRD/TRD text alone, every time, for any feature in any domain. Treat every invocation as if it's the first time this skill has ever been run.

## Input

Accept the PRD/TRD in whichever form is given:
- A file path (or multiple file paths — e.g. a separate PRD file and TRD file) passed as the skill's arguments.
- Pasted PRD/TRD text directly in the prompt.
- If invoked with no input at all, ask the user for the PRD/TRD file path(s) or to paste the content before doing anything else. Do not proceed on assumptions.

If given multiple files (e.g. a PRD and a separate TRD), read and treat them as one combined source of requirements.

## Process

1. **Read the entire PRD/TRD.** Identify:
   - The feature name / title (used to derive a test-case ID prefix and the output file basename).
   - Every discrete functional requirement, UI/interaction behavior, business rule, and stated constraint.
   - Any explicitly stated non-functional requirements (performance targets, load expectations, security requirements) — only include these test types if the document actually states them. Do not invent performance numbers or security requirements that aren't in the source.
   - Explicit edge cases, error states, or negative scenarios the document calls out.

2. **Derive a short ID prefix** from the feature name (2–6 uppercase letters, e.g. a feature called "Audit Logs Page" → `AL`, "Checkout Flow" → `CO`). Use this prefix consistently for every test case ID: `TC_<PREFIX>_001`, `TC_<PREFIX>_002`, etc., zero-padded to 3 digits.

3. **For every requirement identified in step 1, generate one or more test cases.** Deliberately cover multiple test types, not just the happy path — for each requirement, actively ask "what UI case, what functional case, what negative/error case, what usability case applies here?" rather than writing one test case per requirement and moving on. Test types to consider (use only the ones relevant to what the PRD/TRD actually describes):
   - **UI** — visual/structural checks (element loads, is visible, is positioned/labeled correctly).
   - **Functional** — the feature does what it's supposed to do given valid input.
   - **Negative** — invalid input, missing input, disallowed actions; the system should fail gracefully, not crash.
   - **Usability** — interaction quality, clarity of states, responsiveness of controls (these are typically the manual/non-automatable cases).
   - **Performance** — only if the PRD/TRD states a load, scale, or speed requirement.
   - **Security** — only if the PRD/TRD states an auth/permission/data-access requirement.
   - Add other test types only if the source document clearly calls for them (e.g. Accessibility, Compatibility). Never add a type just to pad coverage.

4. **For each test case, define:**
   - **Test Case ID** — `TC_<PREFIX>_###`.
   - **Module/Scenario** — the PRD/TRD section or feature area this case belongs to.
   - **Test Type** — from the list in step 3.
   - **Sub-Type** — a finer label grouping related cases (e.g. under "Functional": "Filter", "Search", "Dropdown Selection") — derive these from the structure of the PRD/TRD, not from any fixed list.
   - **Test Case** — the specific action/scenario to perform, worded so it can be followed without re-reading the PRD/TRD (include the concrete input/condition, not just a vague topic).
   - **Expected Result** — the specific, checkable outcome, taken directly from what the PRD/TRD states or logically requires — never vague ("should work correctly"), always specific enough that pass/fail is unambiguous.
   - **Automated (Y/N)** — `Y` for deterministic, scriptable checks (most Functional/Negative/UI-structural cases), `N` for cases that need human judgment (most Usability cases, visual/subjective checks, exploratory scenarios).
   - **Status** — always `Not Run` (this skill never executes anything, so every case starts unexecuted).

5. **Flag anything you couldn't turn into a solid test case** — a requirement stated ambiguously, a behavior implied but not confirmed, contradictory statements in the document — under a separate "Gaps / Needs Clarification" list. Do not silently skip these and do not guess an answer to resolve them.

## Output — three files, same underlying data

Generate all three every time this skill runs — never just one, unless the user explicitly asks for a single format. All three must contain the exact same test cases (same IDs, same content), just rendered differently:

### 1. `.md` — the readable/editable source of truth

```md
# Test Cases — <Feature Name>

Source: <PRD/TRD file name(s) or "pasted content, <short description>">
Generated from: PRD/TRD only — no codebase or implementation was referenced.

| Test Case ID | Module/Scenario | Test Type | Sub-Type | Test Case | Expected Result | Automated | Status |
|---|---|---|---|---|---|---|---|
| TC_XX_001 | ... | ... | ... | ... | ... | Y/N | Not Run |
| TC_XX_002 | ... | ... | ... | ... | ... | Y/N | Not Run |

## Gaps / Needs Clarification

- <Anything in the PRD/TRD that was too ambiguous to turn into a confident test case, and why.>
- (Omit this section entirely if there are no gaps.)
```

### 2. `.csv` — for import into spreadsheets / QA tools

- Header row exactly: `Test Case ID,Module/Scenario,Test Type,Sub-Type,Test Case,Expected Result,Automated,Status`
- One row per test case, same data and same order as the `.md` table.
- Standard CSV escaping: wrap any field containing a comma, double quote, or newline in double quotes, and double up any internal double quotes (`"` → `""`).
- Do **not** include the "Gaps / Needs Clarification" content in the CSV — it's tabular test-case data only, nothing else. Prose notes don't belong in a row-based import format.

### 3. `.html` — a standalone, self-contained report for quick human viewing

A single `.html` file with everything inlined (CSS and JS in the file itself — no external stylesheets, fonts, or CDN scripts, since this must open standalone with no network access). Keep it simple and neutral — clean typography, generous spacing, a plain readable palette. Do not apply any specific brand's colors or styling; this skill is generic and must not assume which project/company it's running for.

Structure:
- A header with the feature name and the source PRD/TRD reference.
- The full test-case table, one row per case, with:
  - A small colored tag/badge for **Test Type** (a distinct neutral color per type is fine — just keep it consistent, not garish).
  - A colored badge for **Automated** (Y/N) and **Status**.
- A plain-text **search/filter input** above the table (vanilla JS, no dependencies) that filters visible rows by matching against any column's text — this is the one interactive convenience worth including, since these tables can get long.
- The **Gaps / Needs Clarification** section rendered below the table as a plain list, if present.
- Must render correctly with zero setup: opening the file directly in a browser (no server, no build step) should show a complete, working report.

## Output location

- If the PRD/TRD was given as a file path, write all three outputs in the **same directory** as that file, using a shared basename derived from the feature name (e.g. `checkout-flow-test-cases.md` / `.csv` / `.html`). If files with that basename already exist there, append a numeric suffix to all three (e.g. `-2`) rather than silently overwriting a previous run.
- If the PRD/TRD was pasted as text with no file path, ask the user where to save the output before writing anything.
- Always write all three formats to the same folder, using the same basename — never scatter them across different locations.

## Explicit non-goals (do not do these, even if it seems helpful)

- Do not write any test code (no `.spec.ts`, no test scripts, no automation of any kind). The `.html` file's filter box is a display convenience only — it is not a test, and must not call, mock, or reference anything in any codebase.
- Do not execute or attempt to run anything.
- Do not read or reference any existing codebase, repository structure, or existing test files — even if they're available in the working directory.
- Do not read or reference any other skill's instructions or output format.
- Do not invent requirements, numbers, or behavior that isn't stated in the PRD/TRD.
- Do not create Jira tickets, PRs, or any other artifact — the `.md`, `.csv`, and `.html` files are the only deliverables.
- Do not brand or theme the `.html` output for any specific company/product — keep it neutral and generic.
