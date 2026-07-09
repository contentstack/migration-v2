# Change report template (paste into the Jira ticket)

Generated on every run from the real `git diff`. Keep it copy-paste clean — tables + short
bullets, no raw diff hunks unless a code/SAST change needs an exact before/after. Fill the
`<placeholders>`; drop sections that don't apply.

---

## Snyk fix — change report

**Ticket(s):** <CMG-xxx[, CMG-yyy]>  ·  **Date:** <YYYY-MM-DD>  ·  **Branch:** <branch>
**CVE(s) fixed:** <SNYK-ID> (<package>@<version>)[, ...]

### Files changed
| File | Change |
|---|---|
| `<project>/package.json` | <N deps bumped, M overrides added/raised> |
| `<project>/package-lock.json` | regenerated |
| `<path>` | <e.g. flat config added / code edited at line NN> |

### `<project>/package.json`
**Direct dependency upgrades**
| Package | From | To |
|---|---|---|
| `<pkg>` | `<old>` | `<new>` |

**Overrides (transitive fixes)**
| Package | Change |
|---|---|
| `<pkg>` | added `>=<fixed>` / raised `<old>` → `<new>` |

<repeat per project touched>

### Code / config changes (only if any)
- `<file>`: <what changed and why> (before → after if a SAST/code fix).

### Impact & verification
- <e.g. "Dependency-only — no application source changed."> / <"Config migrated: .eslintrc.json → eslint.config.js.">
- Verified: `npm install` + <build/lint/test> pass; Snyk reports the CVE(s) resolved (or fixed-in-version reasoning for ticket mode).

---

## Short variant (single dependency fix)

**`<SNYK-ID>` — `<package>@<version>` (<severity>)** fixed in `<project>/package.json`:
`<pkg>` <bumped `<old>`→`<new>` / override added `>=<fixed>`>. Lockfile regenerated.
Dependency-only change; build + tests pass. Files: `<project>/package.json`, `<project>/package-lock.json`.
