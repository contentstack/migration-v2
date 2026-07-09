# Branch & commit workflow for Snyk fixes

## Branch base = PR target (the senior's rule)
Whatever branch the fix will be merged into is the branch you cut from:

| Target | Cut from | Prefix | Example |
|---|---|---|---|
| `main`  | `origin/main` | `hotfix/`  | `hotfix/eslint-cve-fix` |
| `dev`   | `origin/dev`  | `feature/` | `feature/eslint-cve-fix` |

The SRE batch (CMG-983 subtasks) lives on the existing branch `cmg-983-sre-fixes-1.0.1`.

## Husky branch-name hook → use `--no-verify`
A pre-commit hook enforces the branch pattern
`/^(feature|bugfix|hotfix)\/[a-z0-9-]{5,30}$/g`. `cmg-983-sre-fixes-1.0.1` does NOT match,
so commits on it must use `--no-verify`:

```bash
git add ui/package.json ui/eslint.config.js ui/.eslintrc.json
git commit --no-verify -m "fix(ui): upgrade eslint 8.x to 10.x to fix SNYK-JS-ESLINT-15102420"
```

On a properly-named `feature/…` or `hotfix/…` branch, drop `--no-verify` and let the hook run.

## Batch the push — don't push per fix
This team pushes all SRE fixes together at the end. Commit each fix locally as you go; push
once when the batch is done:

```bash
git push origin cmg-983-sre-fixes-1.0.1
```

## Never stage secrets
These are gitignored / untracked on purpose — keep them out of every `git add`:
- `api/production.env` — environment secrets
- `upload-api/src/config/index.ts` — AWS credentials written at runtime
- `app.json`, `api/manifest.json` — contain encrypted/secret manifest values
- any `.env`

Prefer explicit paths in `git add` (as above) over `git add -A`, so a stray secret file
never sneaks into a commit. Check `git status` before committing.

## Commit message shape
`fix(<project>): <what> to fix <SNYK-ID>` — e.g.
`fix(ui): add minimatch override to fix SNYK-JS-MINIMATCH-xxxx`. One commit per finding (or
per tightly-related group) keeps the ticket ↔ commit mapping clean.

## Checkout gotchas seen on this repo
- An untracked `api/production.env` blocks `git checkout` of another branch. Temporarily
  `mv api/production.env /tmp/production.env.bak`, switch, then restore.
- Uncommitted edits to `ui/src/utilities/constants.ts` block checkout — commit them on their
  own branch first, then `git cherry-pick` onto the other branch.
