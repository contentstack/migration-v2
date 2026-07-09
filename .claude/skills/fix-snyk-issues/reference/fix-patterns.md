# Snyk fix patterns — decision tree & recipes

Work top-down. The first row that matches the finding is the fix.

## 0. Is it even a Snyk dependency/code finding?
If the ticket is a **leaked secret** (GitHub secret scanning — `app.json`, `production.env`,
API keys), STOP. Wrong skill. That needs credential rotation + `git rm --cached` + history
cleanup, not a version bump.

## 1. Direct dependency, patched version exists in the SAME major → version bump (SAFE)
The package is in the project's `dependencies` / `devDependencies` and Snyk lists a fixed
version within the current major.

- Edit that project's `package.json`, raise the caret range to the fixed version.
- `npm install` to refresh the lockfile.
- Example: `"axios": "^1.6.0"` → `"^1.7.4"`.

## 2. Transitive dependency → npm `overrides` (SAFE)
The vulnerable package is NOT something you depend on directly — it's pulled in by another
package. You cannot bump it directly, so force it via the `overrides` block (npm 8.3+).

**FIRST — check if it's already resolved (do NOT add a redundant override).** A sibling
override often eliminates the vulnerable version as a side effect (e.g. bumping `minimatch`
/`glob` drops a vulnerable `@isaacs/brace-expansion`). Before editing anything, confirm the
vulnerable version is still actually in the tree:

```bash
cd <project>
grep -c '<exact-package-name>' package-lock.json        # scoped names: grep the full "@scope/name"
npm ls <exact-package-name>                              # shows resolved version(s), if installed
```

- **Vulnerable version is GONE from the lockfile** → the finding is already resolved (likely
  by an existing override). No code change. Comment that the vulnerable version is no longer
  in the dependency tree (resolved transitively via `<sibling override>`); the ticket can be
  closed. This is a real, common outcome — CMG-948 (`@isaacs/brace-expansion@5.0.0`) resolved
  exactly this way, with zero occurrences left after the `minimatch`/`glob` overrides.
- **Vulnerable version is still present** → add the override below.

`ui/package.json` already uses this pattern:

```json
"overrides": {
  "@babel/runtime": ">=7.26.10",
  "immutable": ">=5.1.5",
  "minimatch": ">=10.2.3",
  "rollup": ">=4.59.0"
}
```

- Add/raise the entry to the Snyk-recommended fixed version.
- `npm install`, then confirm the resolved version: `npm ls <package>`.
- Prefer a `>=fixed` range so future installs don't regress.

## 3. Direct dependency, fix ONLY in a new major (`isFixable: false` for current major) → major upgrade (RISKY — CONFIRM)
Snyk marks `isFixable: false` when no patched release exists in the installed major. The
only remediation is a major-version jump, which can carry breaking changes.

**This is the eslint case (CMG-968 / CMG-977).** The full recipe that worked:
1. Bump the dep major in `package.json` (`eslint ^8.51.0` → `^10.0.0`).
2. Bump peer plugins to compatible majors
   (`eslint-plugin-react ^7.37`, `eslint-plugin-react-hooks ^5`).
3. Add newly-required deps (`@typescript-eslint/eslint-plugin ^8`,
   `@typescript-eslint/parser ^8`, `globals ^15`).
4. Migrate config if the major changed the format: ESLint 9+ dropped `.eslintrc.*` →
   delete `ui/.eslintrc.json`, create flat `ui/eslint.config.js` with the same rules.
5. Remove dead config (`eslintConfig` block in `package.json`).
6. Fix scripts broken by the major (`lint:fix` lost the `--ext` flag in ESLint 9+).
7. Drop rules removed upstream (`@typescript-eslint/ban-types` gone in v8).

**Before applying:** read the target major's migration guide (WebFetch/WebSearch the
official upgrade doc), list the breaking changes and every file you'll touch, and get the
user's OK. Then `npm install` + build/lint to prove it still works.

## 4. No fixed version anywhere → ignore-with-justification or accept (RISKY — CONFIRM)
Snyk lists no fix in any version. Options, in order of preference:
1. **`.snyk` ignore policy** with a written reason + expiry, if the vuln isn't reachable in
   our usage (e.g. dev-only, or the vulnerable code path is never called). Document WHY.
2. **Replace the package** with a maintained alternative (bigger change — confirm scope).
3. **Accept the risk** — only with owner sign-off; note it on the ticket.
Never fabricate a version bump that doesn't fix anything.

## 5. Snyk Code / SAST finding → fix the flagged code (RISKY — CONFIRM)
Not a dependency — Snyk Code flags a code pattern (injection, hardcoded secret, weak
crypto, path traversal, etc.). Read the finding's file:line + remediation guidance, apply
the minimal code change, and confirm you haven't changed behavior beyond closing the hole.

## 6. Duplicate finding → no code change
The same package+CVE filed under a second Jira key (CMG-968 == CMG-977, both
`eslint@8.57.1`/`SNYK-JS-ESLINT-15102420`). Don't re-fix. Use the short duplicate comment
variant pointing at the key where the fix actually landed.

---

## Severity → urgency (from the ticket's CVSS)
- **Critical / High** — fix first, don't batch behind low-priority work.
- **Medium** (eslint was 4.6) — normal batch.
- **Low** — batch; fine to ignore-with-justification if the fix is disruptive.

## Always
- Fix in the project the ticket's `Project File` names (`ui` / `api` / `upload-api`).
- After ANY change, `npm install` so the lockfile matches — Snyk reads the lockfile.
- Match the file's existing style (caret ranges, alphabetical dep ordering, 2-space indent).
