---
name: fix-snyk-issues
description: Investigate and fix Snyk security vulnerabilities (SCA dependency CVEs and Snyk Code SAST findings) in the migration-v2 monorepo, then produce a plain-English Jira comment and guide the commit. DEFAULT mode is a live scan through the Snyk MCP (the recommended path — connect it if it isn't already); the Jira-ticket route (reading a Snyk-generated subtask like CMG-968/CMG-977 via the Atlassian MCP) is the FALLBACK for when the Snyk MCP can't be connected, or when the user explicitly pastes a ticket. Use when the user asks to "fix the Snyk issues / vulnerabilities", wants to scan and remediate dependency CVEs, or pastes a Snyk Jira ticket. For leaked-secret tickets (GitHub secret scanning) this is NOT the skill — those need credential rotation + git-history cleanup, not a dependency bump.
---

# Fix Snyk vulnerabilities (migration-v2)

Take a Snyk finding — by default from a **live Snyk MCP scan**, or (fallback) from a Jira
subtask — investigate it, apply the correct class of fix, verify it, hand back a
copy-paste Jira comment, and guide the branch/commit. This skill codifies the remediation
workflow the team runs against the SRE (CMG-983) subtasks; keep the output shape identical
so tickets stay consistent.

## Scope

**In scope:** Snyk **SCA** (open-source dependency CVEs — the common case, filed as
`SCA | Snyk | ... | package@version`) and Snyk **Code** (SAST) findings.

**Out of scope — do NOT use this skill:** GitHub **secret-scanning** tickets (leaked
`app.json` / `production.env` / API keys). Those are fixed by gitignoring + `git rm
--cached` + **rotating the real credential** + cleaning git history — not by a version
bump. If the ticket is a leaked secret, say so and stop.

## Repo shape you are fixing

Three independent npm projects, each its own Snyk project + `package.json`:

- `ui/package.json` — React/Vite front end (this is where the eslint CVE lived)
- `api/package.json` — main Express API
- `upload-api/package.json` — upload service (+ `upload-api/migration-<cms>/` parser packages, each with their own `package.json`)

A CVE is almost always scoped to **one** of these. Fix it in the project the Snyk ticket
names (the `Project File` field), not globally.

## Inputs you need

1. **A go-ahead to run a live Snyk MCP scan** (the default) — or, if the user prefers/has
   no MCP, a Snyk Jira key (e.g. `CMG-977`). If the user just says "fix the Snyk issues"
   with no ticket, take that as the go-ahead for a live scan.
2. Nothing else up front — everything else (package, version, `isFixable`, severity) comes
   from the finding itself.

## Workflow

### Step 0 — Determine the source (default: Snyk MCP live scan)
The **recommended, default path is a live Snyk MCP scan.** Resolve the source in this order:

1. **User explicitly pasted a Jira key** (e.g. `CMG-977`) → honor it: ticket mode via the
   Atlassian MCP (`getJiraIssue`). An explicit instruction always wins.
2. **Otherwise, go for a live scan.** Run `ToolSearch` for `snyk`:
   - **Snyk tools present** → live-scan mode. This is the default — proceed with it.
   - **Snyk tools absent** → the MCP isn't connected yet. **Offer to connect it** and walk
     the user through setup (see `reference/snyk-mcp-setup.md`) — this is the preferred
     resolution.
3. **Only if the Snyk MCP can't be connected** (no CLI/token, user declines setup) → fall
   back to ticket mode: ask the user for the relevant Snyk Jira key(s) and read them via the
   Atlassian MCP.

Never guess vulnerabilities — every finding must come from a live scan or a real ticket.

### Step 1 — Enumerate findings
- **Ticket mode:** pull `package`, `Vulnerable Version`, `isFixable`, `Severity`,
  `Vulnerability ID`, `Project File` straight from the ticket description. One finding.
- **Live-scan mode:** run the Snyk SCA test (and Code test if asked) against the project
  the user names — or each of `ui`/`api`/`upload-api` in turn. Collect every finding into a
  list: package, current version, fixed-in version, `isFixable`, severity, path.
- **Dedup:** the same package+CVE can be filed under multiple Jira keys (CMG-968 and
  CMG-977 were the identical `eslint@8.57.1` finding). If you have already fixed this exact
  package+CVE this session, mark the new one a **duplicate** — no code change, just a
  "resolved as part of <key>" comment.

### Step 2 — Classify the fix type (per finding)
Read `reference/fix-patterns.md` for the full decision tree. In short:

| Situation | Fix | Risk |
|---|---|---|
| Direct dep, patched version in **same major** | bump version in `dependencies`/`devDependencies` | **safe** |
| **Transitive** dep | add/raise an `overrides` entry forcing the patched version | **safe** |
| Direct dep, fix only in a **new major** (`isFixable:false` for current major) | major upgrade — may need code/config migration | **risky** |
| **No** fixed version anywhere | `.snyk` ignore w/ written justification, or accept — never fake a bump | **risky** |
| Snyk **Code** (SAST) | change the flagged code per the finding's guidance | **risky** |

### Step 3 — Apply fixes (auto-apply safe · confirm risky)
- **Safe** (patch/minor bump, `overrides` entry): apply directly, no prompt.
- **Risky** (major upgrade, no-fix ignore, any SAST code edit): **stop and show the plan**
  — old→new version, the breaking changes you expect, and every file you'll touch — then
  wait for an explicit yes. The eslint case is the archetype: 8→10 also required migrating
  `.eslintrc.json` → flat `eslint.config.js`, bumping plugins, adding
  `@typescript-eslint/*` + `globals`, and dropping the removed `ban-types` rule. A blind
  bump would have broken linting.

Apply the matching pattern from `reference/fix-patterns.md` exactly.

### Step 4 — Verify
- Reinstall the affected project: `cd <project> && npm install` (regenerates the lockfile).
- Typecheck/build if the fix touched a major dep or config:
  `npm run build` (ui) or `npx tsc --noEmit` (api/upload-api). Note: `api` has pre-existing
  errors in untouched files — success is **no NEW errors in your files**, not zero globally.
- **Re-scan** (live mode) or reason from the fixed-in version (ticket mode) to confirm the
  CVE is gone. Report honestly if it isn't.

### Step 5 — Produce the Jira comment
Fill `templates/jira-comment.md` — plain English, copy-paste ready. The user pastes it
themselves; **never** post to Jira from this skill. Structure: vulnerability → root cause →
fix applied (bulleted) → files changed → impact. For a duplicate, use the short
"resolved as part of <key>" variant.

### Step 6 — Generate the change report (ALWAYS — for the Jira ticket)
After the fixes are applied, ALWAYS produce a **change report** listing exactly what was
touched, so the user can paste it into the Jira ticket. This is mandatory on every run
(one report covering all findings fixed this run), not optional.

Build it from the **real diff**, not from memory:
- `git diff --stat -- <changed paths>` → the files-changed list + counts.
- `git diff -- <each changed source/config file>` → the exact line changes.
- For dependency files, translate the raw diff into human-readable rows (package: from → to
  for bumps; added/raised for `overrides`). Do NOT dump `package-lock.json` line noise —
  summarize it as "regenerated" (the lockfile changes are mechanical resolved-version updates).

Fill `templates/change-report.md`: a files-changed table, per-file line/dependency changes,
the CVE(s) each change fixes, and a one-line impact/verification note. Write it to
`docs/snyk-fix-report-<ticket-or-date>.md` AND surface it in chat so the user can copy it
straight into the ticket. Keep it copy-paste clean (tables + short bullets, no diff hunks
unless a code/SAST change needs the exact before/after).

### Step 7 — Branch & commit guidance (do not push per-fix)
Follow `reference/commit-workflow.md`. Key rules baked in from this team's setup:
- **Branch target = branch base.** Fix aimed at `main` → branch from `main` (`hotfix/...`);
  aimed at `dev` → branch from `dev` (`feature/...`). SRE batch lives on
  `cmg-983-sre-fixes-1.0.1`.
- **Husky branch-name hook** rejects `cmg-983-sre-fixes-1.0.1`; commit with `--no-verify`.
- **Batch the push** — the team pushes all SRE fixes together at the end, not per ticket.
- **Never stage secrets** — `api/production.env`, `upload-api/src/config/index.ts`,
  and other gitignored env/credential files stay out of every commit.

## Output
- The applied fix (edited `package.json` / config / code in the right project).
- A verification result (re-scan clean or fixed-in-version reasoning).
- A copy-paste Jira comment.
- **A change report** (`docs/snyk-fix-report-<ticket-or-date>.md`) — files + line/dependency
  changes, mapped to the CVE(s) — always generated, for pasting into the Jira ticket.
- Branch/commit commands — the user runs them.
