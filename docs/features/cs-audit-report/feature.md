# Feature Spec: Audit Report (source stack health check)

- **Slug:** `cs-audit-report`
- **Status:** Draft
- **Author:** Chirag Chavan
- **Created:** 2026-08-05
- **Last updated:** 2026-08-05

## 1. Summary

Step 2 of the migration wizard. After a source export completes, this page reads the exported data on disk, runs four health checks over it, and reports what is unused or left behind — unpublished entries, unreferenced assets, empty content types, unreferenced global fields. Everything is included in the migration by default; the user switches off whole categories or individual items to leave them behind, and those decisions are recorded for the later steps to honour.

## 2. Problem statement

The Audit step exists in the wizard tracker but has no body — `ui/v3/pages/Migration/index.tsx` renders the literal text *"The Audit step is not built yet."* for it. So today a user goes from Source straight to Destination with no visibility into what they are about to migrate.

The consequence is that everything comes across indiscriminately. On the real stack exported on 2026-08-05 (`blt42a635a271789809`) that means **55 of 249 entry records are published nowhere** — drafts, abandoned translations, half-finished pages — and they would migrate into the destination stack alongside the content that matters, where someone then has to identify and clean them up by hand in a system they have just started using.

There is also no way to answer "is this stack healthy enough to migrate?" before committing. A migration engineer discovers the junk after the fact, in the destination, rather than before, in a review step.

## 3. Target users / personas

- **Migration engineer (PRIMARY)** — runs the migration end to end, usually against a stack they did not author. Cares about: not importing garbage, being able to justify what was left behind, and not having to open Contentstack in another tab to understand a flagged item.
- **Content operations owner (SECONDARY)** — knows the content and which drafts are dead. Cares about: seeing what would be dropped before it is dropped, and being able to change their mind without redoing anything.

## 4. Goals & success metrics

- **G-1:** A user can see, without leaving the page, every item the four checks flagged — measured by: 100% of flagged items reachable through the table's filters, search and pagination.
- **G-2:** Excluding content is reversible at every point before Continue — measured by: every exclusion action has an inverse reachable in ≤ 2 clicks, and "Include everything" restores the exact pre-audit state.
- **G-3:** The page never reports a clean result for a check it could not actually run — measured by: 0 cases where an unavailable check renders as `0` or "All clean" (see FR-2.7, EC-4, EC-5).
- **G-4:** Decisions survive leaving and returning to the step, and survive a re-export — measured by: exclusions persisted on the project record are reapplied on revisit (AC-7.1) and after a re-export (AC-8.3).
- **G-5:** Reduce post-migration cleanup in the destination stack — measured by: `TBD — Open Question` (Q-1).
- **G-6:** Users act on the audit rather than skipping it — measured by: `TBD — Open Question` (Q-1).

## 5. Non-goals / out of scope

- **Generating content mappings.** The design's disclosure copy says continuing "pre-fills Content mapping". This feature does not build mapping documents; it records exclusion decisions only, and the Content mapping step reads them to decide what to show. Content mapping's data model does not exist yet, so writing to it now would guarantee rework.
- **Modifying the source stack.** Nothing is published, unpublished, edited or deleted in Contentstack. The audit is read-only over exported files on disk.
- **Deleting anything from the export folder.** An excluded item stays on disk; exclusion is a decision recorded elsewhere, not a file operation.
- **Excluding content types or global fields.** Those two checks are informational only and always migrate (confirmed 2026-08-05). Only unpublished entries and unused assets are excludable.
- **Checks beyond the four.** No taxonomy, workflow, extension, webhook, label, role or personalization auditing, and no schema-validity or field-level analysis.
- **Fixing remaining export gaps.** `environments/` and `taxonomies/` are still not captured by the export (see DEP-1, Q-4, Q-5). This feature reports honestly around them rather than fixing them.
- **Moving the export to the Contentstack CLI.** Evaluated and deliberately deferred — see R-2.
- **Playwright / e2e specs.** A separate stage.

## 6. Use cases

### UC-1: The audit runs automatically on arriving at the step

- **Actor:** Migration engineer
- **Trigger:** The user navigates to the Audit step of a project whose source export has succeeded.
- **Preconditions:** A project exists; its source export completed; the export folder is readable.
- **Main flow:**
  1. The page opens in its analyzing state and starts the scan without any user action.
  2. Four checks are listed, each showing one of `Queued`, `Checking…`, `Done`.
  3. A counter reads "{n} of 4 checks".
  4. When all four resolve, the page switches to its ready state.
- **Postconditions / success state:** The findings are computed and cached; the ready state renders the impact panel, category cards, informational cards and the flagged-items table.
- **Alternate flows:**
  - Findings are already cached for this export → the ready state renders immediately, without re-scanning.
  - A check has no data to run against → it resolves to `Unavailable` rather than `Done` (UC-9).
- **Priority:** P0

### UC-2: Exclude a whole flagged category

- **Actor:** Migration engineer
- **Trigger:** The user toggles the switch on a "Worth a look" card.
- **Preconditions:** The audit is in its ready state; the category has at least one flagged item.
- **Main flow:**
  1. The user reads the card's title, count and guidance.
  2. The user clicks the switch, which moves from `Included` to `Excluded`.
  3. The card's border turns to the danger colour and a strip appears stating the count that will not be migrated.
  4. The impact panel's count, percentage bar and impact line update.
  5. A toast confirms the action.
- **Postconditions / success state:** Every item in that category is excluded, and any per-item overrides in that category are cleared (FR-7.2a). The decision is held in the page's working state and written when the user continues (FR-7.5).
- **Alternate flows:**
  - Toggling back to `Included` restores the category and clears the strip.
- **Priority:** P0

### UC-3: Exclude or include a single item

- **Actor:** Content operations owner
- **Trigger:** The user clicks the Include? checkbox on a table row.
- **Preconditions:** The audit is ready; the row belongs to an excludable category.
- **Main flow:**
  1. The user finds the item, using filters, search or pagination.
  2. The user clicks its checkbox.
  3. The row's state label flips between `Included` and `Excluded`, and the row is restyled.
  4. The impact panel updates.
- **Postconditions / success state:** That one item's decision is recorded as an override, interpreted relative to its category's state, and written when the user continues (FR-7.5).
- **Alternate flows:**
  - The category is bulk-excluded → clicking a row re-includes just that item.
  - The row belongs to a non-excludable category → the checkbox is disabled and explains that the item is always included.
- **Priority:** P0

### UC-4: Inspect the flagged inventory

- **Actor:** Migration engineer
- **Trigger:** The user wants to see the individual items behind a headline count.
- **Preconditions:** The audit is ready and at least one item is flagged.
- **Main flow:**
  1. The user opens the "All flagged items" table (open by default).
  2. The user narrows by filter pill, by search text, or moves between pages.
  3. Each row shows its include state, type, title, uid, content type, locale and status.
- **Postconditions / success state:** The user has seen the specific items, not just the counts.
- **Alternate flows:**
  - "Review items ↓" on a category card opens the table pre-filtered to that category.
  - The user collapses the table and the page keeps every decision already made.
- **Priority:** P0

### UC-5: Exclude everything flagged, or restore everything

- **Actor:** Migration engineer
- **Trigger:** The user clicks the table header's bulk button.
- **Preconditions:** The audit is ready.
- **Main flow:**
  1. With nothing excluded, the button reads "Exclude all flagged"; clicking it excludes every flagged item in every excludable category, across all pages and regardless of the active filter.
  2. With anything excluded, the button reads "Include everything"; clicking it clears every category switch and every per-item override.
- **Postconditions / success state:** All decisions are set to one extreme and the impact panel reflects it; the set is written when the user continues (FR-7.5).
- **Alternate flows:** None.
- **Priority:** P1

### UC-6: Continue to Destination with the decisions recorded

- **Actor:** Migration engineer
- **Trigger:** The user clicks the footer's primary action.
- **Preconditions:** The audit is in its ready state.
- **Main flow:**
  1. The footer status line summarises what will migrate and what was excluded.
  2. The user clicks the primary action.
  3. The decisions are persisted, and the wizard advances to the Destination step.
- **Postconditions / success state:** The exclusion set is durably stored against the project and readable by later steps.
- **Alternate flows:**
  - The audit is still analyzing → the action is disabled with an explanation.
  - Persisting fails → the wizard does not advance and the error is shown.
- **Priority:** P0

### UC-7: Resume a project that was already audited

- **Actor:** Migration engineer
- **Trigger:** The user returns to the Audit step of a project where decisions were previously made.
- **Preconditions:** The project has persisted audit decisions.
- **Main flow:**
  1. The findings load (from cache when valid).
  2. Previously persisted decisions are reapplied to the category switches and the rows.
  3. The impact panel opens showing the previously chosen numbers, not the defaults.
- **Postconditions / success state:** The user sees the state they left.
- **Alternate flows:**
  - A persisted override refers to an item that no longer exists in the export → it is ignored (EC-8).
- **Priority:** P0

### UC-8: Re-run the audit

- **Actor:** Migration engineer
- **Trigger:** The user clicks "Re-run audit".
- **Preconditions:** The audit is in its ready state.
- **Main flow:**
  1. The page returns to its analyzing state and recomputes the findings, ignoring any cache.
  2. The four checks run again.
  3. The ready state returns with fresh counts.
- **Postconditions / success state:** The findings reflect the export as it is now; the user's decisions are preserved.
- **Alternate flows:** None.
- **Priority:** P1

### UC-9: Audit a partial export

- **Actor:** Migration engineer
- **Trigger:** The user reaches the Audit step for a project whose export does not contain every module — because the Source step selected a subset, or because the source was an uploaded file containing only some modules.
- **Preconditions:** The export folder exists but one or more modules are absent.
- **Main flow:**
  1. Checks whose module is present run normally.
  2. Checks whose module is absent report `Not present` and are visually distinguished from a clean result.
  3. The impact panel's denominator counts only what is actually in the export.
- **Postconditions / success state:** The user can tell the difference between "we checked and found nothing" and "there was nothing to check".
- **Alternate flows:**
  - The module is present but a required field is missing (e.g. entries with no `publish_details` from an older export) → that check reports `Unavailable`, not `0` (EC-5).
- **Priority:** P0

## 7. User flows (optional detail)

Covered inline in §6. Two cross-step interactions are worth stating explicitly:

1. **Entering the step.** The wizard chrome owns the app bar, tracker and footer. This feature supplies only the panel body plus the footer's state inputs (`auditReady`, `excludedCount`, `migratingCount`), which the chrome's step definition already declares and which nothing currently produces.
2. **Leaving the step.** The footer's primary action is the chrome's step gate. This feature's advance function persists decisions and returns success or failure; the chrome navigates only on success.

## 8. Functional requirements

### FR — Reading the export

- **FR-1.1:** The findings MUST be computed server-side by reading the project's export folder; the browser MUST NOT read the filesystem.
- **FR-1.2:** The reader MUST accept an export whose modules sit directly in the export root, and one where they sit inside a branch sub-folder.
- **FR-1.3:** The reader MUST accept entry files named `<locale>.json` and entry files named `<uuid>-entries.json`.
- **FR-1.4:** The reader MUST treat each entry record as the pair (entry uid, locale), because the export stores one record per locale under `entries/<contentTypeUid>/<locale>/`.
- **FR-1.5:** The reader MUST NOT fail the whole audit because one file is unreadable; it MUST report the affected check as `Unavailable` and complete the others.
- **FR-1.6:** The reader MUST determine module presence from the export folder's contents, not from the project's stored module selection.
- **FR-1.7:** The reader MUST ignore **fallback records** — a record read from `entries/<contentTypeUid>/<locale>/` whose own `locale` field is not `<locale>`. Such a record MUST be excluded from every check, from every count, from the denominator and from the table.

  Contentstack answers a request for an unlocalized locale with the master-locale entry, marked by `entry_locale` inside its `publish_details` rows. Those records represent content that is *served* in that locale by fallback, not content that exists in it — migrating them as localized entries would turn untranslated pages into translated ones and destroy the fallback relationship. The Contentstack CLI omits them; this repository's exporter currently writes them (125 of 249 records on the 2026-08-05 reference export, e.g. `entries/page/de/de.json` holding entry `bltdffbe49e924fbcc3` with `locale: "en"`).

  This requirement exists so the audit is correct on exports produced **before and after** that exporter bug is fixed: with it, the reference export yields 8 unpublished records rather than 55, and continues to yield 8 once the exporter is corrected.

### FR — The four checks

- **FR-2.1:** The system MUST run exactly four checks, labelled: "Unused assets — referenced by any entry?", "Unpublished entries — has publish details?", "Empty content types — any entries at all?", "Unused global fields — referenced by a schema?".
- **FR-2.2:** **Unpublished entries.** An entry record MUST be flagged as unpublished when its `publish_details` contains no row whose `locale` equals **the locale of the folder the record was read from** (`entries/<contentTypeUid>/<locale>/`). A record whose `publish_details` is empty MUST be flagged.

  The comparison is against the **folder** locale and explicitly **NOT** against the record's own `locale` field. For a genuinely localized record the two are identical; for a fallback record they differ, and comparing against the record's field yields the wrong answer — that mistake alone reported 55 unpublished records on the reference export where the true count is 8. Fallback records are excluded before this check runs (FR-1.7), so the two readings cannot diverge in practice; the comparison is specified against the folder locale anyway, so that a regression in FR-1.7 cannot silently change this check's result.
- **FR-2.3:** An entry record MUST **still** be flagged as unpublished when its `publish_details` is non-empty but contains no row for its folder locale. A non-empty list is not evidence of publication in the locale being assessed.

  *Corrected 2026-08-05.* This requirement previously read "MUST NOT be flagged … merely because its `publish_details` is non-empty for other locales", which contradicted FR-2.2: a German record carrying only an English publish row satisfies FR-2.2's flag condition, while the old wording forbade flagging it. The intent was always to reinforce FR-2.2 — guard against reading a non-empty list as "published" — and the wording inverted it. Its former justification (44 of 194 records carrying rows for other locales) is also withdrawn: that observation was an artefact of the fallback records FR-1.7 now discards, not Contentstack behaviour.
- **FR-2.4:** The unpublished check MUST NOT use `_in_progress` as a substitute for publish state; `_in_progress` means "has unpublished changes", not "never published".
- **FR-2.5:** **Unused assets.** An asset MUST be flagged as unused only when no entry in the export references it. The scan MUST cover: file fields, fields nested inside groups, fields inside modular blocks, assets embedded in rich-text and JSON rich-text fields, and asset URLs appearing in text fields.
- **FR-2.6:** When the asset scan cannot determine whether a reference exists, the asset MUST be treated as **used** and therefore not flagged. Under-reporting unused assets is required behaviour; over-reporting is a defect, because a user acting on a false "unused" label drops an asset that live content depends on.
- **FR-2.7:** **Empty content types.** A content type MUST be flagged when it has no entry records in any locale in the export.
- **FR-2.8:** **Unused global fields.** A global field MUST be flagged when no content type schema in the export references it.
- **FR-2.9:** Asset entries whose `is_dir` is true MUST be excluded from the asset count and from the unused-asset check; a folder is not migratable content.
- **FR-2.10:** Each check MUST resolve to exactly one of: `Done` (ran, with a count), `Not present` (its module is absent from the export), or `Unavailable` (its module is present but the data needed to run it is not).
- **FR-2.11:** A check that resolves to `Not present` or `Unavailable` MUST NOT render a count of `0`, a clean state, or an "All clean" label.
- **FR-2.12:** **Entry variants.** The unused-asset scan MUST also read variant entry files under `entries/<contentTypeUid>/<locale>/variants/` when that directory is present, and MUST count any asset they reference as used.

  When the directory is absent, the unused-assets card MUST state in its guidance text that variant content was not inspected. On the 2026-08-05 reference stack, 7 of the 10 referenced assets are referenced **only** from variant files — so an export without them makes those 7 appear unused, and a user acting on that label deletes assets that live variant content depends on. This repository's exporter does not currently fetch variants, which is precisely why the caveat is required rather than optional.

### FR — Impact panel

- **FR-3.1:** The panel MUST show the number of items that will migrate, the total number of items in the export, a percentage progress bar, and an impact line.
- **FR-3.2:** The total MUST be the sum of: content types + global fields + assets + entry records, where entry records count each locale version separately.
- **FR-3.3:** The migrating number MUST be the total minus the number of currently excluded items.
- **FR-3.4:** The excluded count MUST be derived from the resolved per-item decisions only, never by adding category totals to per-item counts. (The reference prototype double-counts this way and reports 63 excluded where the correct answer is 51.)
- **FR-3.5:** With nothing excluded, the impact line MUST read "Nothing excluded yet — everything migrates unless you skip it."
- **FR-3.6:** With one or more items excluded, the impact line MUST state the excluded count and that those items will not be migrated, pluralised correctly for a count of 1.
- **FR-3.7:** All four values MUST update within the same render as any exclusion change.

### FR — Category cards ("Worth a look")

- **FR-4.1:** The system MUST render one card per **excludable** flagged category: unpublished entries, unused assets.
- **FR-4.2:** Each card MUST show an icon, a title carrying the flagged count, guidance text, a "Review items ↓" action, and an include/exclude switch.
- **FR-4.3:** The switch MUST read `Included` or `Excluded` and MUST be operable by keyboard.
- **FR-4.4:** An excluded card MUST render its border in the danger colour and MUST show a strip stating "**{count} {noun}** will **not** be migrated."
- **FR-4.5:** "Review items ↓" MUST open the table if collapsed, set the filter to that category, and scroll the table into view.
- **FR-4.6:** A category with zero flagged items MUST NOT render a card.

### FR — Informational cards ("Just so you know")

- **FR-5.1:** The system MUST render one card per **non-excludable** category: empty content types, unused global fields.
- **FR-5.2:** These cards MUST NOT offer a switch, checkbox or any other means of exclusion.
- **FR-5.3:** A card whose count is greater than zero MUST show a "Keeping" pill; a card whose count is zero MUST show an "All clean" pill.
- **FR-5.4:** A card whose check resolved to `Not present` or `Unavailable` MUST show that state instead of either pill.

### FR — Flagged items table

- **FR-6.1:** The table MUST be expanded by default and collapsible, with the control reading "Hide table" or "Show table".
- **FR-6.2:** The table MUST show these columns: Include?, Type, Title / UID, Content type, Locale, Status.
- **FR-6.3:** The table MUST be paginated at 50 rows per page, with controls to move between pages and an indication of the current page and total.
- **FR-6.4:** Filtering, searching and pagination MUST be applied server-side, because the client holds only the current page.
- **FR-6.5:** The system MUST offer filter pills for: all items, entries, assets, content types, global fields — each labelled with its count.
- **FR-6.6:** Search MUST match against an item's title, uid, type and content type, and MUST be case-insensitive.
- **FR-6.7:** A row in an excludable category MUST expose a checkbox that toggles that single item, labelled `Included` or `Excluded`.
- **FR-6.8:** A row in a non-excludable category MUST render its checkbox disabled, with an explanation that the item is always included.
- **FR-6.9:** An excluded row MUST be visually distinguished from an included one.
- **FR-6.10:** When no items match the current filter and search, the table MUST show "No items match your filters."
- **FR-6.11:** The bulk button MUST read "Exclude all flagged" when nothing is excluded and "Include everything" when anything is excluded.
- **FR-6.12:** The bulk button MUST act on every flagged item in every excludable category — across all pages, and regardless of the active filter or search.
- **FR-6.13:** "Include everything" MUST clear both the category switches and every per-item override.

### FR — Decisions and persistence

- **FR-7.1:** Every flagged item MUST be included by default; the audit MUST NOT exclude anything without a user action.
- **FR-7.2:** Decisions MUST be stored as a category-level state per excludable category, plus per-item overrides interpreted relative to that category state.
- **FR-7.2a:** Toggling a category's switch MUST clear every per-item override belonging to that category (resolved 2026-08-05).

  "Exclude this whole category" must mean exactly that, with no invisible exceptions carried over from a choice the user made and then undid. Preserving overrides produces the surprising outcome: excluding a category, re-including one item, returning the category to included, then excluding it again would silently leave that one item included with nothing on screen explaining why. Clearing them makes each toggle a clean statement of intent and makes EC-9's determinism requirement trivially satisfied.
- **FR-7.3:** Each per-item override MUST be keyed so that keys cannot collide across item types: entry records by content type uid, entry uid and locale; assets by asset uid.
- **FR-7.4:** A category state MUST behave as a standing policy, not a snapshot: if a category is excluded and a later export flags more items in it, the additional items MUST also be excluded.
- **FR-7.5:** Decisions MUST be persisted against the project, scoped so that only the owning user in the owning region can read or write them. The write happens **once, when the user continues** — not on each toggle (resolved 2026-08-05).

  Toggling a switch or a row updates the page's working state only. This makes FR-8.4 and AC-6.5 coherent — there is one write, at one moment, whose failure has one meaning — and matches how the Source and Destination steps already behave. The accepted cost: a browser refresh before continuing discards unsaved toggles, which is why NFR-10 is scoped to decisions that have already been persisted.
- **FR-7.6:** Decisions MUST survive navigating away from the step, and MUST survive a re-export of the source.
- **FR-7.7:** A persisted override that no longer matches any item in the current findings MUST be ignored when resolving decisions, and MUST NOT be dropped from storage as a side effect of rendering.
- **FR-7.8:** Findings MUST be cached so that returning to the step does not re-scan, and the cache MUST be invalidated when the export is replaced.
- **FR-7.9:** The findings cache MUST NOT be stored in the project record, because the project list returns whole project records to the browser and a large findings blob would be sent on every list request.

### FR — Footer gate and chrome

- **FR-8.1:** The footer's primary action MUST be disabled while the audit is analyzing, and MUST carry an explanation of why.
- **FR-8.2:** The footer status line MUST read "Generating audit — you can continue once it finishes" while analyzing; "Audit complete — nothing excluded" when ready with nothing excluded; and "Audit complete — {excluded} excluded, {migrating} will migrate" when ready with exclusions.
- **FR-8.3:** The primary action's label, the app bar title and the step position MUST come from the shared wizard step definition, not from strings local to this page.
- **FR-8.4:** Clicking the primary action MUST persist the decisions before the wizard advances, and MUST NOT advance if persisting fails.

### FR — Toast

- **FR-9.1:** A shared toast MUST be added to the wizard chrome, not to this page, so later steps can reuse it.
- **FR-9.2:** A toast MUST appear on: excluding a category, including a category, "Exclude all flagged", "Include everything", and starting a re-run.
- **FR-9.3:** A toast MUST dismiss itself after 2600ms and MUST NOT require interaction.
- **FR-9.4:** A toast MUST NOT be the only indication of a state change; the impact panel and the affected control MUST also reflect it.

### FR — States and errors

- **FR-10.1:** The analyzing state MUST show a spinner, the four check rows with their individual states, and a "{n} of 4 checks" counter.
- **FR-10.2:** The analyzing state MUST state that the audit runs automatically and that results are cached until the export changes.
- **FR-10.3:** The ready state MUST show a "Re-run audit" action; the analyzing state MUST NOT.
- **FR-10.4:** When the export folder cannot be read at all, the page MUST show an error state explaining that the exported data could not be read, MUST offer an action that returns the user to the Source step, and MUST leave the footer's primary action disabled.
- **FR-10.5:** The error state MUST NOT be presented as a completed audit, and MUST NOT show an impact panel, category cards or a table.
- **FR-10.6:** The page MUST NOT display any Contentstack asset binary, entry body content or other customer content beyond the fields named in FR-6.2.

## 9. Non-functional requirements

- **NFR-1 (Performance):** Computing the findings for an export of 400 entry records, 100 assets, 25 content types and 15 global fields MUST complete in under 10 seconds on the api server.
- **NFR-2 (Performance):** A findings read served from cache MUST respond in under 500ms p95.
- **NFR-3 (Performance):** A page of 50 table rows MUST respond in under 800ms p95, including filtering and search.
- **NFR-4 (Performance):** Persisting decisions MUST respond in under 500ms p95.
- **NFR-5 (Scale):** The findings computation MUST complete without exhausting memory for an export of up to 50,000 entry records; the exact ceiling and the behaviour beyond it are `TBD — Open Question` (Q-6).
- **NFR-6 (Security):** Every endpoint this feature adds MUST require a valid session and MUST scope reads and writes to the requesting user's region and ownership, taken from the verified token and never from the request path, body or query string.
- **NFR-7 (Security):** Entry titles, uids and asset filenames are customer content and MUST NOT be written to logs. Log lines MUST carry identifiers only — project id, check name, counts.
- **NFR-8 (Accessibility):** WCAG 2.1 AA. Every switch, checkbox, filter pill, pagination control and the bulk button MUST be reachable and operable by keyboard with a visible focus indicator, and each MUST have an accessible name that does not rely on colour or position.
- **NFR-9 (Accessibility):** Include/exclude state MUST be conveyed by text as well as colour, so that an excluded row is distinguishable without colour perception.
- **NFR-10 (Reliability):** No decision may be lost by a browser refresh after it has been persisted.
- **NFR-11 (Reliability):** A failed findings computation MUST leave no partial cache that a later read could mistake for a complete result.
- **NFR-12 (Compatibility):** Latest two versions of Chrome, Edge, Firefox and Safari. The api runs on Node 24.
- **NFR-13 (Observability):** The system MUST log, per audit run: the project id, each check's resolved state, each check's flagged count, and the total duration.

## 10. Data & entities

- **Entity: `AuditFindings`** — the computed inventory for one export. Purpose: the expensive, derived result of scanning the export. Key contents: per-check state (`Done` / `Not present` / `Unavailable`) and flagged count; the flagged item inventory; the module presence map; the denominator components. Lifecycle: written after a successful scan, read on revisit, discarded when the export it describes is replaced. Stored alongside the export it derives from — not in the project record (FR-7.9).

- **Entity: `AuditDecisions`** — the user's include/exclude choices for one project. Purpose: the only part of the audit the user authored, and the part later steps consume. Key contents: a state per excludable category; a map of per-item overrides keyed per FR-7.3; a last-updated timestamp. Lifecycle: created on the first exclusion, updated on every change, persisted with the project, and preserved across re-exports (FR-7.6). Scoped with the project (NFR-6).

- **Entity: `AuditItem`** (within `AuditFindings`) — one flagged thing. Key fields: the key from FR-7.3, its category, its type label, title, uid, content type, locale, and a status label. Assets carry no locale; content types carry neither locale nor content type.

## 11. Acceptance criteria

Given/When/Then form. One or more per use case. Each `AC-<UC>.<n>` maps to at least one automated test.

### Fixtures

Every concrete number below refers to one of the fixtures defined here, **not** to any real stack. Real-stack figures are recorded in §17 for context only, and deliberately kept out of the acceptance criteria: the current exporter writes fallback records (FR-1.7) and omits variants (FR-2.12), so numbers measured from its output would encode two known defects into the test suite and then break when those defects are fixed.

**Fixture F1 — the default.** A well-formed export containing no fallback records:

| | count |
|---|---|
| content types | 4 |
| global fields | 2 |
| assets | 10 |
| entry records | 20 (12 `en`, 8 `de`) |
| **denominator** | **36** |

Flagged by the four checks: **6** unpublished entry records · **4** unused assets · **1** empty content type · **1** unused global field. So **12** flagged rows in the table, of which **10** are excludable (the entry records and the assets).

Derived values used below: excluding the unpublished category leaves 30 of 36 (83%); excluding everything flagged leaves 26 of 36.

**Fixture F2 — paging.** As F1 but with **120** excludable flagged items (100 unpublished entry records, 20 unused assets), used only where pagination or a whole-set bulk action must be exercised.

**Fixture F3 — partial export.** F1 with the `entries/` module absent entirely: 4 content types + 2 global fields + 10 assets, denominator **16**, and no entry data of any kind.

### AC for UC-1

- **AC-1.1:**
  - **Given** a project whose source export succeeded and whose export folder is readable, and no cached findings
  - **When** the user opens the Audit step
  - **Then** the analyzing state renders without any user action, showing four check rows and the counter "0 of 4 checks"
- **AC-1.2:**
  - **Given** the analyzing state with two checks resolved
  - **When** the page renders
  - **Then** the counter reads "2 of 4 checks", the two resolved rows read `Done`, the third reads `Checking…` and the fourth reads `Queued`
- **AC-1.3:**
  - **Given** all four checks have resolved
  - **When** the scan completes
  - **Then** the page switches to the ready state and renders the impact panel, the category cards, the informational cards and the flagged-items table
- **AC-1.4:**
  - **Given** valid cached findings exist for the current export
  - **When** the user opens the Audit step
  - **Then** the ready state renders and the export folder is not re-scanned

### AC for UC-2

- **AC-2.1:**
  - **Given** fixture F1 in the ready state with nothing excluded
  - **When** the user toggles the unpublished-entries card's switch to `Excluded`
  - **Then** the card's switch reads `Excluded`, its border renders in the danger colour, and a strip reads "**6 entries** will **not** be migrated."
- **AC-2.2:**
  - **Given** the state in AC-2.1 immediately after the toggle
  - **When** the impact panel renders
  - **Then** it shows 30 migrating of 36, the bar is at 83%, and the impact line reads "6 items excluded and will not be migrated."
- **AC-2.3:**
  - **Given** fixture F1 with the unpublished-entries category `Excluded`
  - **When** the user toggles the same switch back
  - **Then** the switch reads `Included`, the danger border and the strip are removed, and the impact panel shows 36 of 36 with the line "Nothing excluded yet — everything migrates unless you skip it."
- **AC-2.4:**
  - **Given** a category is toggled to `Excluded`
  - **When** the toggle completes
  - **Then** a toast appears naming the count and the category, and it disappears without interaction after 2600ms
- **AC-2.5:**
  - **Given** fixture F1 varied so that every asset is referenced, making the unused-assets check report 0 flagged
  - **When** the ready state renders
  - **Then** no "unused assets" card appears in "Worth a look"

### AC for UC-3

- **AC-3.1:**
  - **Given** fixture F1 with the unpublished-entries category `Included` and a row for entry `blt55e10ab` in locale `de` reading `Included`
  - **When** the user clicks that row's checkbox
  - **Then** the row reads `Excluded`, is visually distinguished from included rows, and the impact panel shows 35 migrating of 36
- **AC-3.2:**
  - **Given** fixture F1 with the unpublished-entries category `Excluded` and every one of its 6 rows reading `Excluded`
  - **When** the user clicks the checkbox on the row for entry `blt55e10ab` in locale `de`
  - **Then** that single row reads `Included`, the other 5 rows in the category still read `Excluded`, and the impact panel shows 31 migrating of 36
- **AC-3.3:**
  - **Given** a row whose category is empty content types
  - **When** the ready state renders that row
  - **Then** its checkbox is disabled and carries an explanation that the item is always included, and clicking it changes nothing
- **AC-3.4:**
  - **Given** entry uid `blt55e10ab` exists in locales `en` and `de`, and the `de` record is excluded
  - **When** the impact panel and the table render
  - **Then** the `en` record still reads `Included` and exactly one item is counted as excluded

### AC for UC-4

- **AC-4.1:**
  - **Given** fixture F2 in the ready state, with 120 flagged items
  - **When** the table renders its first page
  - **Then** exactly 50 rows are shown, and the pagination control indicates page 1 of 3
- **AC-4.2:**
  - **Given** the table showing all flagged items
  - **When** the user clicks the assets filter pill
  - **Then** only asset rows are shown and the pill is styled as selected
- **AC-4.3:**
  - **Given** the table showing all flagged items
  - **When** the user types `hero` into the search field
  - **Then** only rows whose title, uid, type or content type contains `hero`, case-insensitively, are shown
- **AC-4.4:**
  - **Given** a filter and a search that together match no items
  - **When** the table renders
  - **Then** it shows "No items match your filters." and no rows
- **AC-4.5:**
  - **Given** the ready state with the table collapsed
  - **When** the user clicks "Review items ↓" on the unused-assets card
  - **Then** the table expands, its filter is set to assets, and the table is scrolled into view
- **AC-4.6:**
  - **Given** the user has excluded three individual items
  - **When** the user collapses the table and expands it again
  - **Then** those three rows still read `Excluded`

### AC for UC-5

- **AC-5.1:**
  - **Given** fixture F1 in the ready state with nothing excluded, and 10 flagged items across the two excludable categories (6 unpublished entry records and 4 unused assets)
  - **When** the user clicks "Exclude all flagged"
  - **Then** every flagged item in both categories is excluded, both category switches read `Excluded`, and the impact panel shows 26 migrating of 36
- **AC-5.2:**
  - **Given** fixture F2 with the assets filter pill active and the first page of 50 rows displayed, and 120 excludable flagged items in total
  - **When** the user clicks "Exclude all flagged"
  - **Then** all 120 items are excluded — not only the 50 displayed, and not only the filtered assets
- **AC-5.3:**
  - **Given** fixture F1 with the unpublished-entries category excluded and three individual assets excluded
  - **When** the user clicks "Include everything"
  - **Then** both category switches read `Included`, all three individual overrides are cleared, and the impact panel shows 36 of 36
- **AC-5.4:**
  - **Given** nothing is excluded
  - **When** the table header renders
  - **Then** the bulk button reads "Exclude all flagged"; and after any exclusion it reads "Include everything"

### AC for UC-6

- **AC-6.1:**
  - **Given** the audit is analyzing
  - **When** the footer renders
  - **Then** the primary action is disabled, carries an explanation of why, and the status line reads "Generating audit — you can continue once it finishes"
- **AC-6.2:**
  - **Given** the audit is ready with nothing excluded
  - **When** the footer renders
  - **Then** the primary action is enabled and the status line reads "Audit complete — nothing excluded"
- **AC-6.3:**
  - **Given** fixture F1 in the ready state with all 10 flagged items excluded
  - **When** the footer renders
  - **Then** the status line reads "Audit complete — 10 excluded, 26 will migrate"
- **AC-6.4:**
  - **Given** the audit is ready and one category is excluded
  - **When** the user clicks the primary action and persisting succeeds
  - **Then** the decisions are persisted before the wizard advances, and the wizard moves to the Destination step
- **AC-6.5:**
  - **Given** the audit is ready
  - **When** the user clicks the primary action and persisting fails
  - **Then** the wizard stays on the Audit step and the failure is shown to the user

### AC for UC-7

- **AC-7.1:**
  - **Given** a project whose persisted decisions exclude the unused-assets category and include one override re-including asset `blt4973c80`
  - **When** the user returns to the Audit step
  - **Then** the unused-assets switch reads `Excluded`, the row for `blt4973c80` reads `Included`, and the impact panel reflects both
- **AC-7.2:**
  - **Given** a project with no persisted decisions
  - **When** the user opens the Audit step and the ready state renders
  - **Then** every category switch reads `Included`, every row reads `Included`, and the impact line reads "Nothing excluded yet — everything migrates unless you skip it."

### AC for UC-8

- **AC-8.1:**
  - **Given** the ready state with cached findings
  - **When** the user clicks "Re-run audit"
  - **Then** the page returns to the analyzing state, the cache is ignored, and the export is scanned again
- **AC-8.2:**
  - **Given** a re-run has completed
  - **When** the ready state returns
  - **Then** the counts reflect the current export contents
- **AC-8.3:**
  - **Given** the unused-assets category is excluded, and a re-export has increased its flagged count from 4 to 9
  - **When** the audit is re-run and the ready state renders
  - **Then** the switch still reads `Excluded` and all 9 items are excluded

### AC for UC-9

- **AC-9.1:**
  - **Given** fixture F3, whose export contains content types but no `entries/` folder
  - **When** the ready state renders
  - **Then** the unpublished-entries check reads `Not present`, no unpublished-entries card appears in "Worth a look", and no count of `0` is shown for that check
- **AC-9.2:**
  - **Given** fixture F3 — 4 content types, 2 global fields, 10 assets and no entries
  - **When** the impact panel renders
  - **Then** the total reads 16, counting only what the export contains
- **AC-9.3:**
  - **Given** an export whose entry records carry no `publish_details` key
  - **When** the ready state renders
  - **Then** the unpublished-entries check reads `Unavailable` with an explanation that a re-export is needed, and does not read `0` or "All clean"
- **AC-9.4:**
  - **Given** fixture F1 varied so that both global fields are referenced by a content type schema
  - **When** the informational cards render
  - **Then** the unused-global-fields card shows a count of 0 with an "All clean" pill

## 12. Edge cases & error scenarios

- **EC-1:** The export folder for the project does not exist → the error state per FR-10.4: an explanation that the exported data could not be read, an action back to the Source step, and a disabled primary action. No impact panel, cards or table.
- **EC-2:** The export folder exists but is half-written (an export crashed mid-run) → treated as EC-1. The audit MUST NOT present a partial folder as a complete result.
- **EC-3:** A single module file is unreadable or contains invalid JSON while the rest of the export is intact → that check reports `Unavailable`; the other three run and report normally (FR-1.5).
- **EC-4:** A module is absent from the export because the Source step did not select it, or because an uploaded file did not contain it → that check reports `Not present`, never `0` (FR-2.11, AC-9.1).
- **EC-5:** Entry records exist but carry no `publish_details` (an export predating the 2026-08-05 export fix) → the unpublished check reports `Unavailable` with a re-export explanation, never `0` (AC-9.3).
- **EC-6:** No check flags anything — the stack is clean → the ready state renders with an empty "Worth a look" section, informational cards showing "All clean", a table showing no items, and the impact panel showing everything migrating. The primary action is enabled.
- **EC-7:** Every flagged item is excluded → the impact panel shows a reduced count and a non-zero remainder; the audit MUST NOT block Continue on the grounds that items were excluded.
- **EC-8:** A persisted override refers to an item absent from the current findings, because the source was re-exported and the item was deleted → the override is ignored when resolving decisions and MUST NOT be treated as an error or cause a render failure (FR-7.7).
- **EC-9:** A category is excluded, then re-included, then excluded again, with per-item overrides created in between → every override in that category was cleared by each toggle (FR-7.2a), so the second exclusion excludes every item in the category with no surviving exceptions. The resolved state matches what the controls display.
- **EC-10:** The findings request fails with a network error or a server 500 → the page shows a retryable error rather than an empty ready state, and the primary action stays disabled.
- **EC-11:** Persisting decisions fails → the wizard does not advance, the failure is surfaced, and the user's on-screen decisions are not silently reverted (AC-6.5).
- **EC-12:** Two browser tabs edit the same project's decisions → last write wins. No merge and no conflict warning; recorded as an accepted limitation (A-5).
- **EC-13:** A flagged category contains more items than one page → pagination applies; the category switch and the bulk button still act on the whole set, not the visible page (FR-6.12, AC-5.2).
- **EC-14:** An export with tens of thousands of flagged entry records → the table paginates and the counts remain correct; the memory ceiling for the scan is `TBD — Open Question` (Q-6).
- **EC-15:** An asset is referenced only by an entry the user has excluded → the asset remains classified as used and is not flagged. The flagged set is computed from the export, not recomputed against the user's exclusions.
- **EC-16:** A request for another user's project, or for a project in another region → treated as not found, indistinguishable from a project that does not exist (NFR-6).
- **EC-17:** The user opens the Audit step for a project whose export has not run or did not succeed → the wizard's own step gate governs entry; if the step is reached, the page renders the EC-1 error state rather than an empty audit.

## 13. Dependencies & integrations

- **DEP-1:** **Source export** (`cs-source-selection`) — blocking. The audit reads the folder the export writes. As of 2026-08-05 the export captures all locales and `publish_details`; it still does not capture `environments/` or `taxonomies/` (Q-4, Q-5). Contract owner: the export services.
- **DEP-2:** **Migration wizard chrome** (`migration-wizard-chrome`) — blocking. Owns the app bar, tracker and footer, and provides the step gate this page's advance function plugs into. This feature supplies `auditReady`, `excludedCount` and `migratingCount`, which the chrome's step definition already declares and nothing currently produces. This feature also adds the shared toast to the chrome (FR-9.1).
- **DEP-3:** **v3 project store** — blocking. Holds the persisted `AuditDecisions` and provides the region/owner scope predicate.
- **DEP-4:** **Content mapping (step 4)** — downstream, not blocking. Will read `AuditDecisions` and hide excluded items. This feature must therefore persist decisions in a form keyed the way Content mapping identifies items (FR-7.3). Contract owner: the Content mapping feature, not yet built.
- **DEP-5:** **Contentstack Management API** — none. The audit performs no network calls; it reads only exported files on disk.

## 14. Assumptions & constraints

- **A-1:** The export on disk is the authoritative subject of the audit. The audit does not consult the live source stack, so content changed in Contentstack after the export is not reflected until a re-export.
- **A-2:** An entry record is published for a locale when `publish_details` carries a row for that locale, regardless of which environment. An entry published only to a non-production environment counts as published (confirmed 2026-08-05).
- **A-3:** The denominator counts entry records per locale, so one entry existing in four locales contributes four items (confirmed 2026-08-05).
- **A-4:** Content types and global fields are never excludable (confirmed 2026-08-05).
- **A-5:** Concurrent editing of one project's decisions from two sessions is out of scope; last write wins (EC-12).
- **A-6:** The wizard step definition, not the reference design's copy, is authoritative where the two disagree — the design's footer label ("Continue to content mapping"), its app bar step number ("Step 3 of 7") and its post-continue toast all contradict its own tracker, which places Destination immediately after Audit.
- **C-1:** The api may not read the export folder from the browser; all scanning is server-side (FR-1.1).
- **C-2:** The project store is a single JSON file rewritten in full on every write, and the project list returns whole records to the browser — so the findings cannot live in the project record (FR-7.9).
- **C-3:** Both test suites require Node 24; the api and ui suites fail at startup on earlier versions.
- **C-4:** The reference design's numbers (1,204 items, 47 unpublished, 4 unused assets, 53 flagged) are illustrative sample data, not requirements.

## 15. Risks

- **R-1:** **Incomplete asset-reference detection.** If the scan misses a place assets are referenced — rich-text embeds, JSON rich-text, URLs in text — a referenced asset is labelled "unused" and a user drops it in good faith, breaking content in the destination. Likelihood: medium. Impact: high, and invisible until after migration. Mitigation: FR-2.6 requires treating uncertainty as "used", making the count conservative rather than wrong; plus explicit test coverage per reference location.
- **R-2:** **The export is hand-rolled rather than the Contentstack CLI.** The two bugs fixed on 2026-08-05 — dropped locales, missing publish details — were both "we did not know to ask for that", and the CLI had both right. Further gaps (`environments/`, `taxonomies/`) are already known. Likelihood: high that more surface. Impact: medium; each shows up as a check that is wrong or unavailable. Mitigation: FR-1.2 and FR-1.3 make the reader tolerant of the CLI's export shape as well as ours, so a later switch does not require reworking the audit. A move to the CLI was evaluated and deferred: the CLI's region and credential configuration is global machine state, which would force every export on a shared server to serialise.
- **R-3:** **Category state as a standing policy.** Because decisions persist and findings do not, "exclude all unused assets" set when 4 were flagged will exclude 9 after a re-export finds 9 (FR-7.4, AC-8.3). This is the intended reading, but a user may expect their decision to have applied only to the items they saw. Likelihood: medium. Impact: low, and reversible. Mitigation: the impact panel always shows the current excluded count, so the effect is visible before Continue.
- **R-4:** **Scan cost on large stacks.** The findings computation reads every entry file to resolve asset references and publish state. On a very large export this may exceed NFR-1. Likelihood: medium. Impact: medium. Mitigation: findings are cached (FR-7.8); the ceiling is Q-6.
- **R-5:** **A check that silently degrades.** The `Not present` and `Unavailable` states exist precisely so an unrun check is never read as a clean one, but they are easy to regress into rendering `0`. Likelihood: medium. Impact: high — a user acts on a health report that did not look. Mitigation: FR-2.11 and FR-5.4 are stated as explicit prohibitions with paired negative acceptance criteria (AC-9.1, AC-9.3).

## 16. Open questions

- **Q-1:** What post-launch metrics quantify G-5 and G-6 — reduced destination cleanup, and audit engagement? Thresholds unknown. — owner: product — needed by: post-launch review, not build.
- **Q-2:** ~~When a category switch is toggled, should its per-item overrides be cleared or preserved?~~ **Resolved 2026-08-05: cleared** — see FR-7.2a and EC-9. The reference prototype preserves them; that behaviour is deliberately not copied.
- **Q-3:** Should items excluded in a previous audit that no longer exist in the export be surfaced to the user (e.g. "3 previously excluded items no longer exist"), or silently ignored as FR-7.7 currently requires? — owner: Chirag — needed by: implementation of FR-7.7.
- **Q-4:** The export does not capture `environments/`, so `publish_details` environment uids cannot be resolved to names. Should the audit show which environments an entry is published to, which would require adding environments to the export? The chosen unpublished rule (A-2) does not need it. — owner: Chirag — needed by: whether FR-6.2 gains a column.
- **Q-5:** `taxonomies/taxonomies.json` is written as an empty object and never fetched, so taxonomy data is absent for every export. Out of scope for the four checks, but it means the audit cannot state anything true about taxonomies. Fix in the export, or leave unreported? — owner: Chirag — needed by: not blocking.
- **Q-6:** What is the maximum export size the findings computation must handle, and what should happen beyond it — refuse, sample, or stream (NFR-5, EC-14)? — owner: Chirag — needed by: implementation of the scan.
- **Q-7:** Is 50 rows per page (FR-6.3) the right size, and should it be user-adjustable? — owner: Chirag — needed by: implementation of FR-6.3.
- **Q-8:** The reference design's informational cards carry a "Keeping" pill. Is that copy verbatim-required, given these categories can never be anything but kept? — owner: design — needed by: implementation of FR-5.3.

## 17. Out-of-band references

- Claude Design project `132abb68-eaa7-494b-9820-3f9cf5fa6f15`, page **"Audit Report Step - Prototype copy copy"** — the reference design for this feature: the analyzing state and its four check rows, the impact panel, the "Worth a look" and "Just so you know" sections, the flagged-items table with its filters and search, the auto-seed disclosure, the sticky footer and the toast. Note that the same project also contains an earlier page named "Audit Report Step - Prototype", which is **not** the reference.
- Claude Design project `132abb68-eaa7-494b-9820-3f9cf5fa6f15`, page **"Content Map and Audit"** — the sibling page whose visual language this design shares.
- `/Users/chirag.chavan/Documents/cs_ui_published` — a Contentstack CLI export of stack `bltef5ad9f8875c3145`, supplied 2026-08-05 as the reference for what a complete export looks like. Source of the branch-folder layout, the `<uuid>-entries.json` filename form, the `locales.json` / `master-locale.json` split, and the `publish_details` shape. Basis for FR-1.2, FR-1.3, FR-2.2 and FR-2.3.
- `api/v3/cmsMigrationData/blt42a635a271789809` — the export produced by this repository on 2026-08-05 after the all-locales and publish-details fixes. Source of every concrete number used in the acceptance criteria, all measured against that folder rather than derived:
  - denominator: 23 content types + 14 global fields + 80 assets + 249 entry records (`de` 64, `fr` 64, `es` 63, `en` 58) = **366**
  - unpublished entry records (no publish row for their own locale): **55**
  - unused assets, counting any mention of an asset uid in any entry file as "used" per FR-2.6: **77** of 80 (no folder assets present)
  - empty content types: **1** (`flights`) · unused global fields: **1** (`landing_page_image_grid`)
  - flagged total shown in the table: **134** · excludable subset acted on by "Exclude all flagged": **132**
- `docs/features/migration-wizard-chrome/feature.md` — the wizard chrome this page renders inside; owns the app bar, tracker and footer, and defines the step copy that A-6 makes authoritative.
- `docs/features/cs-source-selection/feature.md` — the source export this audit reads (DEP-1).

---

**Downstream contract:** IDs in this document (`UC-*`, `FR-*`, `AC-*`, `EC-*`, `NFR-*`, `DEP-*`) are stable references. The PRD/TRD creator skill and test-case creator skill will cite them. Do not renumber without updating consumers.
