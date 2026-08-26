# Plan — Contentstack CLI v1 → v2

**Status:** Steps 0, 1, 2 done. **Step 3 in progress (2026-08-25): the version IS bumped —
`@contentstack/cli@2.0.0` is installed and every local check passes. What remains is the
real-export verification, which cannot be done from a test suite.**

**Written:** 2026-08-24

**Scope:** the v3 (Contentstack → Contentstack) export path only. Import is out of scope
and is flagged as an open question in §9.

---

## 1. What this is about, in one paragraph

Our export shells out to the Contentstack CLI. We are on **v1** (`@contentstack/cli@1.63.0`),
and **v2.0.0** is now the `latest` release on npm. v2 changes what the export leaves on
disk and how it reports progress. Several of those changes would make our code report an
export as *successful but empty* rather than fail loudly, so this cannot be done as a
version bump. This plan says what changes, where we touch, and in what order.

## 2. Why bother at all

Not urgent. v1 is still maintained on its own npm tag (`v1-x`, currently `1.68.0`), so we
are not stranded — we are five patches behind on a supported line.

The honest reason to move is that fixes will land in v2 from now on. A second reason
emerged during the investigation: v2 gives us a **much better integration surface** than
v1 does (§6), so moving lets us delete our most fragile code rather than adapt it.

## 3. How we know all this (evidence, not guesswork)

Three sources, in increasing order of trust:

1. Contentstack's own [v1→v2 migration guide](https://www.contentstack.com/docs/headless-cms/cli-v1-to-v2-migration-guide).
2. Reading the actual v2 package source (`@contentstack/cli-cm-export@2.0.0`,
   `cli-utilities@2.0.0`).
3. **Two real v2 exports run by hand**, which is what caught the biggest problem:
   - **the small stack** (`bltxxxxxxxxxxx`) — 6 content types, 15 assets, 0 global fields
   - **the big stack** (`bltxxxxxxxxxxx`) — 23 content types, 14 global fields, 80 assets, 62 MB

The guide and the source between them missed the single most important finding. **Only the
real exports revealed it.** Anyone continuing this work should assume the same is still
true and test against real stacks, not fixtures alone.

## 4. What actually changed

### 4.1 Summary files are gone

v1 wrote a few files that summarise the export. v2 writes only one file per item.

| File | v1 | v2 |
|---|---|---|
| `export-info.json` | ✅ | ❌ gone |
| `branches.json` | ✅ | ❌ gone |
| `content_types/schema.json` | ✅ (a list of all content types) | ❌ gone — per-item files only |
| `global_fields/globalfields.json` | ✅ (written even when there are 0) | ❌ gone — per-item files only |

**Why this is dangerous.** We read those summary files to count things. When a file is
missing we do not crash — `readJson` returns undefined and `countOf` turns that into
**0**. So a v2 export would be reported as finished, successful, and containing nothing.

Confirmed on real data: the big export has 23 content-type files and 14 global-field
files, and no summary file for either. Our counter would say 0 and 0.

### 4.2 No more branch subfolder

v1 put everything inside a `<branch>/` folder (so `.../main/content_types/...`). v2 writes
the module folders at the top level.

Good news: `resolveExportRoot` in `exportFolder.util.ts` already checks the given folder
*before* descending into a subfolder, so a flat v2 export hits its fast path and resolves
correctly with no change. What needs removing is the separate step that *moves* the
contents of `main/` up a level.

### 4.3 ⚠️ Assets can be in one of two completely different places

**This is the most important finding in this document.**

If the org's plan includes **asset spaces**, the export writes assets to
`spaces/<space-uid>/assets/`. If the plan does not, assets land in `assets/` exactly as
before.

On the big export that meant **no `assets/` folder at all** — its 80 assets and 61 of its
62 MB were under `spaces/`. Our asset counter only looks in `assets/`, so it would report
**0 assets** and the audit and content graph would show none either.

The full picture:

| CLI | Org plan | Assets land in |
|---|---|---|
| v1 | any | `assets/` |
| v2 | without asset spaces | `assets/` |
| v2 | with asset spaces | `spaces/<space-uid>/assets/` |

Two consequences that shape the whole design:

- **Both layouts are permanently valid.** There is no single correct shape to converge on.
  This is not "support the old shape during the migration".
- **We cannot know which one to expect in advance.** Not from the CLI version, not from
  config, not from anything available before the export runs. The code has to look at what
  is on disk and handle whichever it finds — including finding neither, which is a
  genuinely empty export and not a bug.

The mechanism, for anyone verifying this: v2's assets module reads
`branch.settings.am_v2.linked_workspaces` and takes the spaces path when there is at least
one, otherwise what its own comment calls the *"legacy asset export"*. v1 has no such
branch. In the big export's log: `Found 1 linked workspace(s) for branch main`.

### 4.4 The chunk-index trap, now in three more places

We have been bitten four times by **a bookkeeping file read as data**. v2 adds more of them.

A folder like `assets/` contains `assets.json`, which is *not* the assets — it is a list of
the filenames that hold them: `{"1":"<uuid>-assets.json"}`. Count it and you get 1 instead
of 80. `metadata.json` maps a filename to an *array*, so treating its values as objects
inflates the count by one.

Both still behave exactly this way in v2 — our existing fixes stay correct and stay
necessary. But `spaces/` brings two new instances:

- `spaces/fields/fields.json` → a list pointing at `<uuid>-fields.json`
- `spaces/asset_types/asset-types.json` → a list pointing at `<uuid>-asset_types.json`

Note the naming flips between hyphen and underscore between the list and the files it
points at. Anything matching on filename needs to be careful.

### 4.5 Progress on screen is gone — but the logs are better

v1 printed a line per step, which we parse off stdout. v2 draws animated progress bars
instead and suppresses the informational lines by default. So there is nothing for our
parser to read.

But v2 writes proper structured log files, which are strictly better for us:

```
<log dir>/
  info.log      one JSON object per line
  error.log     0 bytes on a clean run
  warn.log
  debug.log
  session.json  includes CLI_VERSION, so we can detect the version
```

Each `info.log` line looks like this (trimmed):

```json
{"module":"assets","level":"success","message":"Asset '…' downloaded successfully","timestamp":"…"}
```

Verified on both real exports:

- All **17 modules** announce as `Exporting module: '<name>'...`, with names matching our
  existing `CLI_EXPORT_MODULE_TYPES` list **exactly** — same 17, same order.
- There is a dedicated `module` field, so we would not need the message regex at all.
- `error.log` was 0 bytes on both successful runs.

**How we find that folder — resolved during Step 2, and NOT by the means first proposed
here.** Parsing the CLI's "The log has been stored at …" line was rejected: v1 prints the
BASE directory with a trailing period, v2 the SESSION directory without one, so the parse
would have to differ per version — the exact coupling this step removes.

Instead the spawned child gets `CS_CLI_LOG_PATH` pointing at a directory we own, one per
run. That variable is the FIRST branch of `getLogPath()` in **both** majors'
`cli-utilities`, ahead of user config, so the location is deterministic and
version-independent. Set on the child only; putting it in our own environment would
redirect every later export in the same server process.

This is why moving is attractive. It lets us delete three fragile things at once:

1. ANSI colour-code stripping.
2. Dependence on the CLI's exact `[timestamp] LEVEL: message` wording.
3. Dependence on stdout being present at all.

⚠️ It does **not** fix failure detection. Both majors exit 0 on a hard failure, and
`error.log` being non-empty is **not** a failure signal — it collects partial failures too.
See §4.6, which also documents a live bug in what we do today.

### 4.6 Failure semantics — and a bug we already have on v1

Investigated from source after the question "what does a v2 failure look like?" came up.
The answer turned out to apply to **v1 as well**, and it is a live bug.

#### How the CLI reports failure (both majors)

There are two very different kinds of failure and the CLI does not distinguish them for us:

| | What happens | Export folder |
|---|---|---|
| **Fatal** | A module throws. The chain aborts, remaining modules never run. The command catches it, logs it, and **exits 0**. | incomplete |
| **Partial** | A single item fails — one asset download, one entry, one locale. It is logged, the counter increments, and **the module carries on**. | complete except that item |

Both call `handleAndLogError`, which logs at **ERROR** level. So *"an ERROR was logged"*
does not mean the export failed — it can mean 1 of 80 assets did not download while
everything else succeeded. Verified in v1's `assets.js` (a failed download calls
`handleAndLogError` with `ASSET_DOWNLOAD_FAILED`) and in v2's equivalent.

v2 additionally counts them: the end-of-run summary reads
`Items Processed: 71 success, 0 failed of 71 total`.

#### ⚠️ The bug this exposes in our current code

`cliExport.service.ts` treats **any** declared `ERROR` line as a failed run:

```ts
if (level === "ERROR" && !firstError) firstError = message;      // line 187
…
if (firstError) return resolve({ ok: false, error: firstError }); // line 228
```

v1's console logging is unconditional, so a single failed asset download prints an ERROR
line, which sets `firstError`, which returns `ok: false`. **We discard a 99%-complete
export and tell the user it failed.**

Not hypothetical — the code path is `assets.js:264` / `:291` in the version we ship today.
It has not bitten us because individual item failures are rare on small test stacks. It is
most likely on exactly the exports that cost the most: large stacks, slow networks.

This is **independent of the v2 migration** and worth fixing on its own.

#### The signal we should key on instead

Both majors log one definitive line, and only after the module chain completes without a
fatal error:

```
The content of the stack <apiKey> has been exported successfully!
```

(v1: `export.js:28`. v2: the equivalent `log.success` call.) So:

- **Fatal** = that line never appears → fail the job, as now.
- **Partial** = the line appears but errors were logged → **succeed**, and surface the
  problems. Keep the export; the operator decides whether one missing asset matters.

That is strictly better than what we do today on v1, and it is the same rule under v2 —
which is the useful part: the error handling stops being version-specific.

⚠️ Do **not** replace this with "error.log is non-empty" under v2. That file collects
partial failures too, so it would reproduce the same bug with a different mechanism.

### 4.6b ⚠️ Errors are in `error.log`, never in `info.log` — and the first fix missed it

Found 2026-08-25 by running a deliberately broken v2 export (`-k blt0000000000000000`).
Observed, not inferred:

- **exit code 0** on a hard failure — confirming what §4.6 predicted from source
- `info.log` **0 bytes**, `error.log` **807 bytes**, data directory empty
- the closing line absent, so the §4.6 rule classifies it fatal — correctly

But it exposed a defect in the Step 2 log reader. The CLI keeps a **separate logger per
level**, each writing to its own file:

| level | file |
|---|---|
| `error` | `error.log` only |
| `warn` | `warn.log` only |
| `info`, `success` | `info.log` |

An ERROR line **never appears in `info.log`**. The first reader polled `info.log` alone, so
`logProblems` could never be populated. On a realistic failure — a few modules succeed,
then one throws — that produced: log active, zero errors seen, no closing line, and the
"errors AND no closing line" rule evaluating **false**. The run resolved as **success**: a
failed export reported complete, stamped, and moved into place.

The deliberate-failure test did not catch it on its own. That failure happened during branch
resolution, before any info line existed, so `info.log` was empty, `logActive` stayed false,
and the stdout fallback caught the error instead. **The fallback masked the bug** — which is
why it needs its own test rather than relying on the end-to-end one.

Fixed: the poller reads `info.log`, `error.log` and `warn.log`, each with its own offset.
`debug.log` is deliberately skipped — same content at ten times the volume (3,569 lines
against 278 on a real export).

⚠️ **The test fixtures were part of the problem.** They wrote errors into `info.log`, a
shape the CLI never produces, so a reader that polled only `info.log` passed them. They now
write each level to the file the CLI actually uses. Reverting the reader to `info.log`-only
is now caught by **six** tests instead of one. This is the fifth instance of the failure
family in §4.4: *a fixture that invents a shape lets the bug through*.

### 4.7 Smaller changes

- **Node ≥ 22 required.** We run 24, so nothing to do — but it must hold in CI and any
  Docker image too.
- **`--module` lost its short form.** We pass `-m` for partial exports; it must become
  `--module`. `-k`, `-d` and `-y` are all still there (the migration guide's flag table
  says `--data-dir` lost its `-d`; the source says otherwise, and the source wins).
- **`@contentstack/cli-config` is still not importable** as a library at 2.0.0 (no `main`,
  `module` or `exports`). The `getContentstackEndpoint` workaround in `cliAuth.util.ts`
  stays.
- **Tokens carry over.** Both majors read the same token store, so rollback is cheap and
  nobody has to log in again.

### 4.8 What did NOT change

Worth stating so nobody re-investigates:

- The 17 module names and their order.
- `assets.json` is still a chunk index; `metadata.json` still maps a filename to an array.
- Entries are still per-content-type then per-locale.
- The log line format itself (`[timestamp] LEVEL: message`) is unchanged — it is just not
  printed for export any more.

## 5. Where we touch

### 5.1 The counting

**`api/v3/utils/exportFolder.util.ts`**

- Count content types and global fields from the per-item files instead of the summary
  file. Content types are easy — v1 writes per-item files *as well as* the summary, so one
  code path covers both. Global fields genuinely need two paths: v1 writes **only** the
  summary, v2 writes **only** per-item files.
- Look for assets in `assets/` **or** under `spaces/`. The chunk-counting logic itself is
  already correct and is reused as-is.
- `stampExportedAt` currently merges a timestamp into the CLI's `export-info.json`. That
  file is gone, so write our own small stamp file instead. It exists so the Audit page can
  tell a fresh scan from a stale one; that requirement does not change.

### 5.2 The audit and the graph

**`api/v3/services/auditReader.service.ts`** — same two fixes: per-item files, and both
asset locations. This file has its own copy of the asset chunk-merging logic.

**`api/v3/services/auditScan.service.ts`** — reads `export-info.json` for the same
freshness check; move it to our own stamp file.

### 5.3 The content-type list for mapping

**`api/v3/services/contentTypeInventory.service.ts`** — reads the summary file to list
content types for the mapping screen. Missing file means an empty list, which means
mapping is unusable. Read the per-item files.

### 5.4 Progress and failure detection

**`api/v3/services/cliExport.service.ts`** — stop parsing stdout for progress. Read the
log path from stdout, then read `info.log` for module progress and `error.log` for
failure. Keep the argv-array-with-no-shell rule exactly as it is; that is a security
property, unrelated to the version.

**`api/v3/utils/cliProgress.util.ts`** — barely changes. The module list is unchanged and
the announcement wording still matches, so `parseModuleAnnouncement` keeps working; it just
reads its lines from `info.log` instead of stdout.

⚠️ **Keep matching the `Exporting module: '<name>'...` message. Do NOT switch to the
`module` field**, even though it looks like the tidier option. Measured on the big export:

- There are **21** distinct `module` values but only **17** announcements. The extras
  (`projects`, `attributes`, `audiences`, `events`, `experiences`, `variant-entries`) are
  personalize sub-modules, so counting distinct values overshoots and the bar stalls near
  the end.
- On the announcement line itself the field carries the *previous* module's name — the line
  `Exporting module: 'entries'...` is tagged `module: "experiences"`. The field and the
  message disagree exactly where we would rely on it.

### 5.4b What the user sees during an export — unchanged

Worth stating plainly, because "v2 has progress bars" invites the wrong conclusion.

**We do not render the CLI's progress bars.** They are terminal-only: box-drawing
characters and colour codes redrawn in place with carriage returns. In a browser they are
noise, and v2 draws them even when output is not a terminal.

The Source page keeps exactly what it has now — the live log, our own progress bar, the
stage caption. Only the data source changes, and the live log improves: `info.log` lines
are clean text already tagged with their module, so no colour-stripping and no parsing.

**Progress stays module-level (17 steps).** Finer progress is not available: log lines carry
only `module`, `level`, `message`, `timestamp` — there is no percent, total or current
field. The item counts visible in the terminal bars are held in memory by the CLI's progress
manager and never written to the log. Counts do appear inside message *text*
(`Exported 120 shared asset type(s)`, `Total attributes: 13`, `Found 4 taxonomies`), but
the phrasing varies per module and parsing prose is the brittleness we are removing.

Final tile numbers keep coming from counting the folder on disk, which is authoritative.

### 5.4c Optional — could we show progress bars like the terminal?

**Not required for this migration.** Recorded here because it was asked, the investigation
is done, and the answer is non-obvious. Nothing below blocks §7.

Three genuinely different approaches, in ascending order of how much I would recommend
them.

#### Option A — mirror the CLI's real bars in the browser (not recommended)

Feasible, and the blocking question turned out to be favourable: there is **no `isTTY`
guard anywhere in `cli-utilities`**, so v2 draws its bars whether or not stdout is a
terminal. The migration guide says the same, listing it as a CI annoyance ("progress bars
render anyway, producing escape codes"). So the bars *do* reach the stdout we already
capture.

What it would cost:

- Embed a terminal emulator (xterm.js, ~250 KB) in a product whose design is not a terminal.
- Stop stripping ANSI and stream raw bytes.
- Replace polling with SSE/WebSocket. Carriage-return redraws do not survive being sampled
  every couple of seconds — you get torn frames.
- Hand over the layout: their column widths, their colours, changing whenever they change
  them.

Possible, but it inverts the point of the migration — we would be taking on the CLI's most
unstable output instead of its most stable.

#### Option B — scrape the counts out of the bar lines (recommended against)

The counts (`100% | 15/15`) are on stdout, in the live bar lines and again in the end-of-run
summary table. They could be regexed out.

This is parsing ANSI-laden redraw output — precisely the fragility §4.5 exists to remove.
It would trade a stable log file for the least stable stream the CLI produces. Do not do
this.

#### Option C — build real bars from data we already hold (the one worth doing)

The counts are absent from the log file because they only ever live in memory in
`CLIProgressManager` and go straight to the console. But **we can compute the same
numerators ourselves, and already do**: `readExportCounts` runs *during* the export (see its
own "Safe to call MID-export" note) and is what drives the live tiles today.

So we already have "42 assets so far". The only missing half is the denominator.

That is obtainable — we have management API access, and the destination flow already calls a
stack-stats endpoint. Fetch the stack's content-type / asset / entry totals before the
export starts, and every tile becomes a real per-module bar, in our own design, from data
that depends on parsing nothing.

This would be **better than the terminal**, not a copy of it: same numbers, our layout, no
scraping.

Honest caveats:

- Denominators would not always be exact. Entries multiply per locale, assets can have
  versions, and a scoped partial export changes what "total" even means. A bar could sit at
  96%, or briefly exceed 100%, unless those cases are handled.
- It is real work, not a UI tweak: an extra API call, totals plumbed through the job, and
  the tiles reworked into bars.

#### Option D — the cheap middle ground (available today)

If the appeal is the *look* — one row per module, each with its own bar — that needs no new
data at all. Seventeen rows driven by the module announcements we already parse, each
pending / running / done. Every row is 0% or 100% rather than 12/15, but it reads like the
terminal's structure.

That is a design decision, not a data problem, and it is independent of the CLI version.

**Suggested order:** D if the look is what is wanted, C if the substance is, B never, A no.

### 5.5 The folder-shuffling step

**`api/v3/services/export.service.ts`** — `finaliseExportFolder` moves the contents of
`main/` up a level. With v2 there is nothing to move. Skip it rather than rewrite it.

### 5.6 Uploaded zip files — deliberately different

**`api/v3/services/bundle.service.ts`** parses export zips that **users upload**, which
will be v1-shaped for a long time. This one must understand **both** shapes permanently.
It gets slightly more complex rather than changing over. Do not "migrate" it.

### 5.7 The version bump

**`api/package.json`** — `@contentstack/cli` from `^1.61.1`.

⚠️ **`@contentstack/cli-utilities` is a separate direct dependency at `^1.18.3`, and the
legacy (v2-app) code uses it too** — `api/src/utils/config-handler.util.ts`. v2's CLI pins
`~2.0.0` for it. So either bump both and retest the legacy paths, or carry two majors of
the same package in one tree. This is a decision about the older codebase, not about the
v3 export, and should be sized separately.

### 5.8 Tests

139 tests across the CLI-facing files:

| File | Tests |
|---|---|
| `export.service.test.ts` | 48 |
| `cliExport.service.test.ts` | 39 |
| `exportFolder.util.test.ts` | 19 |
| `cliAuth.util.test.ts` | 16 |
| `cliProgress.util.test.ts` | 12 |
| `cliPresence.util.test.ts` | 5 |

The fixtures build fake export folders, and they are all v1-shaped. They need v2-shaped
counterparts — **including a spaces-shaped one**, which nothing currently covers.

This is the largest part of the work by volume and the most valuable part. Every one of our
four past bugs in this area got through because a fixture invented a folder shape that did
not match reality.

## 6. What we are NOT doing

- Not touching the import path (`bundleWriter.service.ts` and anything downstream). If v2's
  import expects the spaces asset layout, that is its own piece of work — see §9.
- Not switching `bundle.service.ts` over to v2-only.
- Not changing the argv/no-shell invocation rule.
- Not turning the CLI's console logging back on. We could
  (`configHandler.set('log', { showConsoleLogs: true })`), but reading the log file is
  better and does not depend on a global setting shared with the user's own CLI.
- Not changing how progress is displayed. The Source page keeps its current three parts
  (§5.4b). Richer or terminal-style progress bars are investigated in §5.4c and are
  explicitly **not** part of this migration.

## 7. Order of work

The point of this order is that **the risky part is separated from the part that could
quietly break existing projects.**

**Step 0 — ✅ DONE (2026-08-25) — fix the partial-failure bug (§4.6). Independent of this migration.**
Key success on the CLI's own success line instead of on "no ERROR was logged", so one failed
asset download stops discarding an otherwise complete export. Applies to v1, which is what
we ship today, and is the same rule we need under v2 — so it is not throwaway work. Do this
first because it is a live defect, not preparation.

**Step 1 — ✅ DONE (2026-08-25) — make the readers understand both shapes, while still on v1.**

Verified against the real reference pair: the v1 and v2 exports of the same stack now read
**identically** — 23 content types, 14 global fields, 80 assets, 124 entries, every module
reported present, from both. Before this, the v2 export read as 0 / 0 / 0.

Two findings that changed the plan:

- `auditScan.service.ts` needed **no change**. We *write* `export-info.json`; we never read
  the CLI's. Under v2 it simply does not exist yet, so `stampExportedAt` creates it. The
  only thing lost is inheriting `contentVersion`, which is an import-side concern (Q-2).
- Content types need only **one** code path, not two: v1 writes per-item files *alongside*
  its aggregate, so counting files works for both. Only global fields genuinely need two
  readers, because v1 has only the aggregate and v2 only the per-item files.

Also fixed en route: six tests in `auditChecks.service.test.ts` and
`auditReader.service.test.ts` that had been failing since commit 0a7b1331 added the
`unusedTaxonomies` check. See §9 Q-6 — the spec was never updated and still contradicts the
code.
Counting, audit reader, audit scanner, content-type inventory. Both folder layouts, both
asset locations, our own stamp file. Nothing changes for users, the whole suite stays
green, and it is all verifiable against exports we already have. If we stopped here, we
would still be better off.

**Step 2 — ✅ DONE (2026-08-25) — move progress and failure detection onto the log files.**
Still on v1, which also writes those log files. Prove the new path works before the
version changes underneath it.

**Step 3 — ⏳ IN PROGRESS (2026-08-25) — bump the version and export for real.**

Done, and verified locally:

- `package.json`: `@contentstack/cli` `^1.61.1` → `^2.0.0`; `csdx --version` reports 2.0.0.
- **`cli-utilities` deliberately left at `^1.18.3`.** npm resolves this correctly: our own
  code imports the top-level 1.18.4, while the CLI and its export plugin each get a nested
  2.0.0. Verified with `require.resolve` from the plugin's own directory.
- **The two copies agree on the config store**, which is what makes that split safe:
  `CONFIG_NAME`, `ENC_CONFIG_NAME`, the encryption-key default and the path prefix are
  identical in both majors (the only diff in `config-handler.js` is how chalk is imported).
  So the region and token our `cliAuth.util.ts` writes are what v2's CLI reads.
  `auth:whoami` confirms the existing login carried over.
- `--module` replaces `-m` (v2 dropped the short alias). Changed and verified while still on
  v1, which accepts both.
- Every flag we pass — `-k`, `-d`, `--branch`, `-y`, `--module` — is present in v2's
  `--help`.
- Full api suite green on v2 (1567 tests), `tsc` clean, the CLI-presence probe still finds
  `node_modules/.bin/csdx`.

**No server restart is needed for the CLI change:** the CLI is a fresh child process per
run, so the next export already uses v2. Our own `configHandler` import is 1.x either way.

⚠️ **Still outstanding — the part that matters most.** Real exports, which no test can
substitute for, given that every significant finding in this document came from a real
export and not from source or docs:

1. ✅ **DONE** — a stack on an org **with** asset spaces (the big stack, `bltxxxxxxxxxxx`,
   exported through the app 2026-08-25). Folder held 23 content-type files, 14 global-field files,
   no aggregates, and 80 assets under `spaces/`. The app recorded **23 / 14 / 80 / 124** —
   exact match. Audit read it correctly (`unusedAssets` 77 of 80), and its cache key is our
   own stamp. Before Step 1 this same export would have reported 0 / 0 / 0.
2. ⏳ A stack on an org **without** asset spaces → assets under `assets/`, counts must
   match. Lower risk (that path is unchanged and unit-tested against the v1 reference) but
   still unexercised on v2 through the app.
3. ✅ **DONE, and it found a bug** — see §4.6b.

The check that matters in each case: **the numbers on screen match the numbers in the
folder.** That is what would have caught the original `assets: 1` bug immediately.
A large stack **on an org with asset spaces** and one **without**. The check that matters:
the numbers on screen must match the numbers in the folder. That is the check that would
have caught the original `assets: 1` bug immediately.

**Step 4 — the `cli-utilities` question for the legacy code** (§5.7), sized on its own.

## 8. Reference exports — the regression baseline

⚠️ Do not keep test exports under `api/v3/exportData`. Deleting a project removes its export
folder by design, so ordinary testing wipes them.

We have a matched pair of the **same stack** exported under both majors, which is the ideal
baseline: a both-shapes reader must produce **identical numbers from both**.

| | v1 | v2 |
|---|---|---|
| Path | `~/Documents/cs_chirag_demo` | `~/Documents/demo cli v2` |
| Layout | `main/` subfolder + `branches.json` | flat |
| `export-info.json` | present (89 B) | absent |
| `content_types/schema.json` | present (151 KB, 23 entries) | absent |
| `global_fields/globalfields.json` | present (20 KB, **14** entries) | absent |
| Per-file global fields | **0** | **14** |
| Per-file content types | 23 | 23 |
| Assets | `assets/` — 80 | `spaces/<uid>/assets/` — 80 |

**Expected result either way: 23 content types, 14 global fields, 80 assets.**

Two things this pair proves, on real data rather than by argument:

- **Content types** can be counted from per-item files in both majors (23 files in each), so
  one code path covers both.
- **Global fields cannot.** v1 has the aggregate and **zero** per-field files; v2 has 14
  per-field files and no aggregate. This is the one place two code paths are unavoidable.

## 9. Open questions

**Q-1 — Can `assets/` and `spaces/` both appear in the same export? — ✅ RESOLVED: no.**
Confirmed 2026-08-25: it is always one or the other, decided by the org plan. So the counter
**picks whichever exists** and must never add them. Corroborated by the reference v1 export
in §8, which has `assets/` and no `spaces/`.

**Q-2 — Does the import side care?**
We build a bundle for import in `bundleWriter.service.ts` and write assets to
`assets/files/...`. If CLI v2's import expects the spaces layout for a spaces-enabled org,
that is a second migration. Not investigated.

**Q-3 — `composable-studio` and authentication.**
The migration guide says v2 skips this module when authenticating with a management token
or OAuth, and that Basic Auth is the only supported path. Both test exports used Basic Auth
and produced an empty `composable_studio/` folder, so we cannot tell from them whether
that is "nothing to export" or "skipped". Matters only if we need that module.

**Q-4 — Does `--module` still cover everything we scope?**
v2 validates module names up front and renamed one value (`studio` → `composable-studio`).
Our list already uses the new name, but the validation is new and stricter, so partial
exports need a real test rather than an assumption.

**Q-6 — `feature.md` for cs-audit-report contradicts the shipped code. ⚠️ NOT a migration
issue; found while clearing a red baseline for Step 1.**
Commit 0a7b1331 added a fifth audit check, `unusedTaxonomies`. But
`docs/features/cs-audit-report/feature.md` still says "four checks" in five places, and its
§Non-goals lists taxonomy auditing as explicitly **out of scope** — because Q-5 there
recorded that taxonomy data was absent from every export. The CLI switch changed that (a
real CLI export does contain `taxonomies/`), which is presumably why the check became
possible. Neither the spec nor the test-case matrix caught up: the matrix has **zero** rows
mentioning taxonomies, so the check has no QA coverage at all. The six stale unit tests were
updated to match the shipped code; the spec and matrix were left alone, since neither is
this work's to change. Needs an owner decision: update the spec, or remove the check.

**Q-5 — Are `spaces/fields` and `spaces/asset_types` things we need?**
The big export produced 120 shared asset types. Today we do not read them. If the audit or
mapping should account for them, that is new scope, not migration work.

## 10. Recommendation

**Do not bump to v2 yet.**

Do Step 1 now if there is appetite — it is pure risk reduction, it needs no version change,
and it fixes a real latent problem: the readers currently assume one folder shape and one
asset location, and both assumptions are already wrong for some orgs.

Separately, bump v1 `1.63.0 → 1.68.0`. It stays within the major, picks up five patches,
and carries none of the above risk.

Then treat v2 as its own scoped piece of work with real exports in the loop. The reason to
be careful is not that v2 is bad — it is that **the failure mode is silence**. A botched
migration would not throw; it would quietly produce empty migrations, which is the worst
possible outcome for this tool.
