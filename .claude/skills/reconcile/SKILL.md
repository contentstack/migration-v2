---
name: reconcile
description: Verify a SAP SmartEdit migration by comparing the source export against what is ACTUALLY live in the destination Contentstack stack right now — not local staging files. Use this whenever the user invokes /reconcile, asks to "reconcile" a migration/stack, wants to verify or double-check a completed migration against the real/live Contentstack data, or asks whether a migration "actually worked" / "really landed" / "matches what's in Contentstack." This is distinct from checking local `cmsMigrationData` output — it proves the real Contentstack import succeeded, which local-only checks cannot do.
---

# Reconcile a migration against the live Contentstack stack

## What this proves that other checks can't

This repo already has a reconciliation check that runs automatically after every
migration (`api/src/services/sap-smartedit-reconcile.service.ts`, driven by
`runSapReconciliation` in `migration.service.ts`), plus a manual script
(`api/scripts/reconcile-sap.ts`). Both of those compare the source export against
our OWN generated staging files under `api/cmsMigrationData/<stackId>/` — the
files our connector writes locally, before Contentstack's import CLI ever touches
them.

That is a real, useful check, but it has a hard ceiling: it can never catch a bug
in the import step itself, or content that Contentstack silently dropped or
transformed during import, because it never looks at Contentstack at all. This
skill closes that gap by exporting the stack's ACTUAL live content and comparing
against that instead. Confirmed live during development: a `ContentPage` entry's
`masterTemplate` reference field was present and correct in our local staging
file, but completely absent from the real, imported Contentstack entry — a
class of bug the local-only check has no way to ever see.

## Invocation

```
/reconcile <sourcePath> <stackId>
```

Both arguments are required and come directly from the user — do not try to
guess or look up the source path yourself. Example:

```
/reconcile docs/features/sap-smartedit/scripts/edge-cases/edge-cases.impex blt8c4ba20ee575289e
```

If the user invokes this without both arguments, ask for whichever is missing
rather than guessing — a wrong source path produces a report that looks
authoritative but is silently comparing against the wrong thing.

## Steps

### 1. Run the comparison script

From the `api/` directory of this repo:

```bash
npx tsx scripts/reconcile-live.ts "<sourcePath>" "<stackId>" --json /tmp/reconcile-live-<stackId>.json
```

This script (`api/scripts/reconcile-live.ts`) already does the hard part — do
not reimplement any of this logic inline:

- Authenticates using the app's OWN stored Contentstack credentials (the same
  `AuthenticationModel` + region/auth-config pattern `runCli.service.ts` uses
  for real imports). If the user hasn't logged in through the app, this step
  fails with a clear message — relay it, don't try to work around it.
- Exports the live stack fresh into a throwaway temp directory (deleted
  automatically when the script finishes).
- Translates Contentstack's REAL, reassigned uids back onto the connector's
  own deterministic uids before comparing. This step exists because a real
  Contentstack import does NOT keep the uid our connector computed for an
  entry or asset — it assigns a new one of its own. The script uses the same
  uid-translation record (`uid-mapper.json`, keyed by project + iteration)
  that the delta/update feature already relies on, so if you ever wonder "why
  does this need a uid map at all," that's why: without it, every comparison
  would look wrong even for a perfectly correct migration, because the
  entries just wouldn't share any common key to match on.
- Runs the exact same `reconcile()` logic the local-only check already uses.

Exit codes: `0` clean, `1` there are CRITICAL or ERROR findings (this is the
normal "found real problems" case, not a crash), `2` a setup/usage problem
(missing credentials, bad arguments, or no project found for that stack id —
the uid translation is filed per PROJECT, so the script needs to find which
project this stack belongs to). On exit code 2, relay the printed error
message directly to the user and stop — don't retry, and don't attempt to
interpret a report that was never produced.

### 2. Read the structured JSON, not the terminal output

Read the `--json` output file rather than parsing the human-readable stdout —
the JSON is a stable, typed shape and won't drift if the terminal formatting
ever changes. Its shape (from `ReconcileReport` in
`api/src/services/sap-smartedit-reconcile.service.ts`):

```ts
{
  sourcePath: string;
  migrationDir: string;
  typeMappingSource: 'authoritative' | 'heuristic';
  summary: {
    sourceTypes: number; sourceRows: number; contentTypes: number;
    entriesWritten: number; localesDeclared: string[];
    assetsDeclared: number; assetsWritten: number;
    critical: number; error: number; warning: number;
  };
  perType: Array<{ sourceType: string; sourceRows: number; entries: number; contentTypeUid: string | null }>;
  findings: Array<{
    severity: 'critical' | 'error' | 'warning' | 'info';
    check: string; sourceType?: string; id?: string; locale?: string; detail: string;
  }>;
}
```

### 3. Build the Excel report

Load the `xlsx` skill for the actual spreadsheet-building mechanics (library
choice, styling, column widths). Structure the workbook as three sheets:

- **Summary** — every field from `summary`, plus `typeMappingSource`,
  `sourcePath`, `migrationDir`, and the stack id the user passed in. This is
  the "read this in ten seconds" sheet.
- **Per Content Type** — one row per `perType` entry: source type, source
  rows, entries found live, content type uid (or blank if unmapped).
- **Findings** — one row per finding, in FULL, no truncation, no sampling.
  This is the whole point of a spreadsheet output over a chat summary: someone
  triaging a real migration needs every row, not "and 15 more." Columns:
  severity, check, sourceType, id, locale, detail. Sort critical first, then
  error, then warning, then info — so the sheet reads worst-to-best from the
  top.

Use clear header formatting (bold, a light fill) and size columns to their
content — this mirrors the existing Word-doc report
(`api/src/utils/reconcile-report-docx.utils.ts`) that the automatic,
local-only check already produces, just as a spreadsheet instead of a
document, and built by you + the xlsx skill rather than a new dependency in
the `api` package.

### 4. Save it next to the stack's own migration data

Save the workbook to
`api/cmsMigrationData/<stackId>/live-reconciliation-report.xlsx` if that
directory exists — it's where the automatic docx report for this same stack
already lives, so anyone looking at one will find the other. If that
directory doesn't exist (e.g. this stack's local staging data was cleaned up,
or this check is being run from a different machine than the one that ran the
migration), save to the current working directory instead and say so plainly
— don't fail the whole check over a missing folder that isn't actually needed
for the comparison itself.

### 5. Report back in chat

Keep this short — the spreadsheet is where the detail lives:

- Pass or fail, and the critical/error/warning counts.
- If there are findings, name 2-3 of the most significant ones in plain
  language (not the raw `check` code) — enough for the user to know whether
  this needs urgent attention without opening the file.
- Where the Excel file was saved.
- If `typeMappingSource` came back `"heuristic"` (no `--content-types` was
  passed to the script), mention that a "type went missing" finding under
  heuristic mode could be a renamed content type rather than real loss — the
  same caveat the local-only check already carries.

Don't dump the full findings list into chat. If the user wants to discuss a
specific finding, they'll ask — read it back out of the JSON or the
spreadsheet at that point, not preemptively.
