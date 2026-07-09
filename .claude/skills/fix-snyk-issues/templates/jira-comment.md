# Jira comment templates (copy-paste; the user posts it)

Plain English, no Jira wiki markup. Fill the <placeholders>. Keep it to: what the vuln is →
why it happened → what was fixed → files changed → impact.

---

## Standard fix

**Vulnerability:** `<SNYK-ID>` — <vulnerability type> in `<package>@<version>` (CVSS
<score>, <Severity>). <One line: e.g. "No patched version exists in the current major
(isFixable: false), so the fix requires a major upgrade." OR "Patched in <fixed-version>.">

**Fix applied on branch `<branch>`:**

- <bullet: the version bump / override / config change>
- <bullet: any peer/plugin bumps or added deps>
- <bullet: any config migration or removed dead config>
- <bullet: any script/rule changes>

**Files changed:** `<path>`, `<path>` (new), `<path>` (deleted)

**Impact:** <e.g. "Dev dependency only — no effect on application runtime or build output."
OR "Runtime dependency — verified build + smoke test pass after upgrade.">

---

## Transitive dependency (override) fix

**Vulnerability:** `<SNYK-ID>` — <type> in `<package>@<version>` (CVSS <score>, <Severity>).
This is a transitive dependency (pulled in by `<parent-package>`), not a direct one.

**Fix applied on branch `<branch>`:**

- Forced the patched version via an `overrides` entry in `<project>/package.json`:
  `"<package>": ">=<fixed-version>"`
- Ran `npm install`; confirmed the resolved version with `npm ls <package>`.

**Files changed:** `<project>/package.json`, `<project>/package-lock.json`

**Impact:** Transitive dependency only. No source changes; resolved version verified.

---

## Already resolved transitively (no code change)

**Vulnerability:** `<SNYK-ID>` — <type> in `<package>@<version>` (CVSS <score>, <Severity>).
This is a transitive dependency.

**Finding:** The vulnerable version `<package>@<version>` is no longer present in the
dependency tree — it was eliminated when `<sibling-package>` was upgraded via the existing
`overrides` in `<project>/package.json`. Verified with `npm ls <package>` / lockfile search
(0 occurrences of the vulnerable version).

**Action:** No code change required. Ticket can be closed once the current branch is merged.

---

## Duplicate ticket

Duplicate of `<other-key>` — same vulnerability (`<SNYK-ID>`, `<package>@<version>`), same
project file. The fix committed for `<other-key>` on branch `<branch>` resolves this ticket
as well. No separate code change needed; can be closed once the branch is merged.

---

## No fix available (ignore-with-justification)

**Vulnerability:** `<SNYK-ID>` — <type> in `<package>@<version>` (CVSS <score>, <Severity>).
Snyk lists no fixed version in any release.

**Action taken on branch `<branch>`:**

- <e.g. "Added a `.snyk` ignore policy with justification: the vulnerable code path
  (<function>) is not reached in our usage; dev-only dependency." + expiry date>
- <OR "Flagged for package replacement — needs owner decision; see thread.">

**Impact / residual risk:** <state honestly what remains and who needs to sign off.>
