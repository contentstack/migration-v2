# Plan — Source Export Revamp: API calls → Contentstack CLI

- **Status:** Approved. Phases 1 and 3 complete (2026-08-11); Phase 2 blocked on capturing real CLI output, Phases 4–6 outstanding.
- **Author:** Chirag Chavan
- **Created:** 2026-08-10
- **Scope:** the v3 Source step's *stack-mode* export only.
- **Deployment context:** this tool runs **locally, single-user** — the repo is pulled and run on one machine. It is not hosted and not multi-tenant. That fact is load-bearing for §7 Impact 4 and for R-1/R-1b, and if it ever changes those must be revisited.

---

## 1. What changes, in one paragraph

Today v3 exports a source stack by making its own Contentstack Management API calls and writing the results to disk itself. This plan replaces that with a spawned `csdx cm:stacks:export`, so the exported folder is produced by the same tool Contentstack ships and supports. The Source step keeps its live log — now showing the **real CLI output** — and keeps its progress bar, derived from actual module completion rather than from our own call sequence. Everything downstream of the export (Audit, Content mapping, Destination, the file-upload path) keeps working against the same folder location.

## 2. Why

| Reason | Detail |
|---|---|
| **Completeness** | The CLI exports 17 modules; we export 6. It captures `environments`, `extensions`, `webhooks`, `workflows`, `labels`, `custom-roles`, `marketplace_apps`, `personalize` and `studio` — none of which we produce today. |
| **Entry variants** | Our exporter never fetches them. The Audit page has to disclose *"Variant content was not inspected in this export"* (`cs-audit-report` FR-2.12) purely because of this gap. |
| **Known export defects disappear** | Four deferred bugs are ours, not the CLI's: fallback records written into the wrong locale folder, missing variants, non-atomic writes, and the stack-api-key folder naming. Three are solved by delegating. |
| **Supportability** | An export produced by `csdx` is one Contentstack support can reason about. Ours is a reimplementation that has already drifted from the real format twice (missing locales, missing `publish_details`). |
| **Import symmetry** | v2 already imports with `csdx cm:stacks:import`. Exporting with the matching command means both halves of the migration speak one format. |

## 3. What already exists in our favour

These are the four facts that make this a moderate change rather than a large one. All verified in the repo:

1. **`@contentstack/cli` is already a dependency** — `api/package.json` pins `^1.61.1`, and `@contentstack/cli-cm-export` is installed. `csdx cm:stacks:export --help` runs today. **No new runtime dependency.**
2. **The auth problem is already solved, in v2.** [`api/src/utils/config-handler.util.ts`](../../api/src/utils/config-handler.util.ts) has `setOAuthConfig` / `setBasicAuthConfig`, which write *our* stored token into the CLI's own config handler (`oauthAccessToken` + `authorisationType: 'OAUTH'`, or `authtoken` + `'BASIC'`). [`api/src/services/runCli.service.ts`](../../api/src/services/runCli.service.ts) pairs that with `config:set:region` before spawning. **We do not need `csdx auth:login`.**
3. **The spawn + log-streaming pattern is already proven** in `runCli.service.ts` (used for `cm:stacks:import`).
4. **The UI already enforces and displays a dependency closure.** `moduleSelection.ts`'s `toggleModule` + `forcedKeys` are live in both `StackPanel` and `FilePanel`, and a forced module renders **disabled with a "required by entries" hint** (`StackPanel.tsx:33`). §5.4's closure is therefore a data change to `MODULE_DEFS.dependsOn`, not new UI work — which is the single biggest reason this lands without touching the picker.
5. **Our readers already tolerate the CLI's folder layout.** `auditReader.service.ts`'s `resolveModuleRoot` and `contentTypeInventory.service.ts`'s `findSchemaFile` both descend one level to find the module root, which is exactly the CLI's `<branch>/` subfolder.

## 4. The layout difference (measured, not assumed)

Compared against a real CLI export the user supplied (`~/Documents/cs_chirag_demo`):

| | CLI | Ours today |
|---|---|---|
| Root | `branches.json` + `<branch>/` subfolder | modules flat at the root |
| Modules | 17 | 6 (`content_types`, `entries`, `assets`, `global_fields`, `locales`, `taxonomies`) |
| Entries | `entries/<ct>/<locale>/<uuid>-entries.json` + `index.json` | `entries/<ct>/<locale>/…` — **same shape** |
| Assets | `assets/<uuid>-assets.json` + `assets.json` + `files/` + `folders.json` | `assets/assets.json` + `files/` + `index.json` |
| `export-info.json` | `{contentVersion, logsPath}` — **no timestamp** | `{contentVersion, exportedAt}` |

Two consequences worth stating plainly: the entries shape is already identical, and **`exportedAt` disappears**, which matters (§7, Impact 2).

## 5. Invocation strategy — RESOLVED

### 5.1 The command

```
csdx cm:stacks:export -k <stackApiKey> -d <tmpDir> --branch <branch> -y [-m <module>]
```

- **`--branch` must be passed explicitly.** Omitting it exports *every branch of the stack*, producing several branch folders and far more data than the user asked for.
- `-y` suppresses the Marketplace prompts (otherwise the process blocks forever waiting on stdin).
- `-m/--module` is `flags.string` with **no `multiple: true`** — verified in `export.js`'s flag definition, and confirmed by contrast with `content-types`, which *does* declare it. **One module per invocation, definitively.**

### 5.2 Rejected alternatives, and why

| Approach | Verdict |
|---|---|
| **`filteredModules` in a `-c` config file** | **Rejected.** It works mechanically (`merge.recursive` lands anything on the config, and `export-config-handler.js:102` reads it) but it is absent from `cli-cm-export`'s own type definitions and is only ever *set* by `cli-cm-clone` for a structure-only export. It is an internal hand-off between two plugins, not a supported export option. |
| **Export everything, then delete unselected folders** | **Rejected.** The waste it was meant to avoid still happens — `assets.js`'s `start()` calls `getAssets()` then `downloadAssets()` **unconditionally**, so there is no metadata-only mode and every binary lands on disk before any deletion. It also adds a destructive step whose only possible outcome is losing data we needed. |
| **Chain a run per module, always** | **Rejected as the default.** ~0.85s of oclif boot per invocation (measured), dependencies re-fetched, and — the real problem — it multiplies the credential-clobber window (R-1) from one to N. |

### 5.3 The resolved rule

Two strategies, chosen from the selection. **The existing module picker keeps working; only what happens underneath changes.**

| Selection | Strategy | Runs | Binaries |
|---|---|---|---|
| **Whole stack** | one invocation, no `--module` | **1** | yes |
| **Anything else** | chain the resolved closure | 1–6 | only if `assets` is in the closure |

### 5.4 Dependency closure — enforced by us, not the CLI

The CLI declares only `entries → locales, content-types`. It does **not** auto-pull `global-fields`, `taxonomies` or `extensions`, even though content types reference all three. **So we resolve the closure ourselves.**

| Selected | Expands to |
|---|---|
| `content-types` | `content-types`, `global-fields`, `taxonomies`, `locales`, `extensions` |
| `entries` | the `content-types` closure **plus** `assets`, `environments`, `entries` |
| `assets` | `assets` |
| `webhooks`, `workflows`, `publishing-rules`, `custom-roles`, `labels`, `marketplace-apps`, `personalize`, `composable-studio` | themselves only — freely choosy |

`stack` is never selectable: `exportSingleModule` prepends it to every run.

**Where this lives.** `MODULE_DEFS` in `api/v3/services/bundle.service.ts` already carries a `dependsOn` array, already surfaced through `source.controller.ts`'s `listModules` and already consumed by the UI's `toggleModule`/`forcedKeys`. Encoding §5.4 there means the server closure and the UI's locked rows come from **one source of truth**. Two consequences to handle deliberately:

- `MODULE_DEFS` currently lists `entries → ["contentTypes", "assets"]` and everything else as `[]`. It needs `contentTypes → [globalFields, taxonomies, locales, extensions]` and `entries → [..., assets, environments]`.
- `MODULE_DEFS` is **shared with the file-upload path** (`bundle.service.ts` builds the upload manifest from it). Widening `dependsOn` therefore changes what the *file* picker forces too. That is arguably correct — the same referential facts hold for an uploaded bundle — but it is a behaviour change outside stack mode and must be verified, not assumed (see Q-8).

**Also needed: a name map.** Our keys are camelCase (`contentTypes`, `globalFields`); the CLI's `--module` values are kebab-case (`content-types`, `global-fields`). One mapping table, one place.

**Grounded in the real export** (`~/Documents/cs_chirag_demo`, 23 content types): 51 fields across **11 distinct extensions**, 6 taxonomy fields, 4 global-field references, 66 file fields. Dropping `extensions` would strip custom UI from a fifth of the schema's fields; dropping `content-types` breaks our own Content mapping and Audit pages, which read `content_types/schema.json` directly.

`environments` sits with `entries` because entry `publish_details` reference environment UIDs, and the Audit page's unpublished-entries check reads that field. It is also a module we do not export today at all.

### 5.5 Run ordering — every closure member gets its own run

Order the chain as:

1. **`entries` first** when present.
2. Then the rest of the closure.
3. **`assets` last** — the only module that downloads binaries, so everything cheap gets a chance to fail first. A bad credential should not cost a gigabyte of downloads.

**Every closure member gets an explicit run. We deliberately do NOT skip the ones the CLI would auto-pull.**

*Revised during Phase 1a implementation.* An earlier draft planned 5 runs for the entries case by relying on the CLI to bring `locales` and `content-types` along with `--module entries`. That dependency is real and is even typed (`dependencies?: Modules[]` in `cli-cm-export/lib/types/default-config.d.ts`, with `entries: { dependencies: ['locales', 'content-types'] }` in `config/index.js`) — better standing than the `filteredModules` seam rejected in §5.2.

It was still the wrong thing to lean on. If that table changes in a CLI upgrade, we silently produce a bundle **missing `content-types`** — and that is the one module Content mapping and Audit read directly, so the failure would surface as those pages breaking, not as an export error. The cost of not relying on it is ~1.7s of extra process boot and a re-fetch of two cheap modules (a locale list and a schema). **Correctness over 1.7 seconds.**

Consequence: the entries case is **8 runs, not 5**. `stack` repeats per run, which stays negligible.

## 6. Files touched

### 6.1 New files

| File | Purpose |
|---|---|
| `api/v3/services/cliExport.service.ts` | Spawns the CLI, streams stdout/stderr line by line, resolves/rejects on exit code. The single new boundary — and the one the tests will mock. |
| `api/v3/utils/cliAuth.util.ts` | v3's own region + token injection into the CLI config, mirroring v2's `setOAuthConfig` / `setBasicAuthConfig`. Deliberately **not** an import from `api/src` — v3 is standalone (C-1). No isolation machinery (Impact 4). |
| `api/v3/services/cliProgress.service.ts` | Turns CLI output + folder state into `progress` (0–100) and per-module counts. Isolated so the brittle part is one small, well-tested unit. |
| `api/tests/unit/v3/services/cliExport.service.test.ts` | New tests for the spawn boundary. |
| `api/tests/unit/v3/services/cliProgress.service.test.ts` | New tests for progress derivation. |
| `api/tests/unit/v3/utils/cliAuth.util.test.ts` | New tests for token injection + locking. |

### 6.2 Modified — server

| File | Change | Risk |
|---|---|---|
| `api/v3/services/export.service.ts` (406 lines) | `runStackSource` and `writeStackBundle` are replaced by a CLI invocation. The job registry, `Job`/`JobLogLine`/`LiveCounts` shapes, `startExportJob` and `getJob` are **kept as-is** so the HTTP contract and the UI do not move. | **High** — the heart of the change |
| `api/v3/services/graph.service.ts` (107 lines) | Must build from `content_types/schema.json` on disk instead of an in-memory `contentTypes` array. | Medium |
| `api/v3/services/bundleWriter.service.ts` (255 lines) | Becomes **largely dead** for stack mode. `splitLocales` and the folder writer are superseded. Retained only if the file-upload path still needs it — to be confirmed, not assumed. | Medium |
| `api/v3/utils/assetDownload.util.ts` | Superseded — the CLI downloads binaries into `assets/files/` itself. Currently untested (a known gap), so deleting it removes untested code rather than losing coverage. | Low |
| `api/v3/services/export.service.ts` → post-run step | Write `export-info.json` with `exportedAt` **after** the CLI finishes, merging rather than overwriting the CLI's file. | Low but load-bearing |
| `api/v3/controllers/source.controller.ts` | Likely unchanged. Confirm `startExport` / `getExportStatus` still satisfy the same shapes. | Low |
| `api/v3/routes/source.routes.ts`, `projectSource.routes.ts` | **No change expected.** | None |
| `api/package.json` | Possibly none — the CLI is already a dependency. | None |

### 6.3 Modified — UI

| File | Change | Risk |
|---|---|---|
| `ui/v3/components/source/ExportLogView.tsx` | Must render raw CLI lines legibly: longer lines, ANSI escape codes stripped, no assumption of our `LEVEL: message` shape. | Medium |
| `ui/v3/store/slice/source.slice.ts` | Only if `LiveCounts` changes shape (see the open question in §9). | Low |
| `ui/v3/components/source/StatTiles.tsx` | Only if the five counters change semantics. | Low |
| `ui/v3/components/source/SourcePanel.tsx` | Only if the module-selection UI changes for the one-module-per-invocation constraint. | Low |

**Explicitly untouched:** `GraphView.tsx`, `FilePanel.tsx`, `StackPanel.tsx`, `RegionLoginModal.tsx`, `V3Select.tsx`, and every Audit / Content-mapping / Destination / Projects file.

### 6.4 Tests to re-point — 44 existing

| File | Tests | Why |
|---|---|---|
| `api/tests/unit/v3/services/export.service.test.ts` | 25 | Mocks `csManagement`; must mock the spawn boundary instead |
| `api/tests/unit/v3/services/bundleWriter.folder.service.test.ts` | 7 | Covers a writer that no longer runs in stack mode |
| `api/tests/unit/v3/services/bundleWriter.service.test.ts` | 4 | Same |
| `api/tests/unit/v3/routes/source.routes.test.ts` | 8 | Endpoint contract — should mostly survive; verify |

**Rule for this work: no test gets deleted to make the suite green.** A test covering behaviour that genuinely moves gets re-pointed at the new boundary with the reason recorded in the file, exactly as `TC_MWC_040` was handled during `cs-content-type-selection`. A test covering behaviour that ceases to exist gets removed **only** with an explicit note naming what replaced it.

## 7. Impact analysis — what breaks, and the fix

### Impact 1 — the live log (the visible one) · **decided**

**Today:** `runStackSource` emits synthesised structured lines (`Exporting asset: hero.png`, `Discovered content type: Blog Article`) at a paced interval, plus five `liveCounts` that tick as each API call resolves.

**After:** the real CLI stdout/stderr, streamed line by line into `ExportLogView`.

**Decided with the user:** show the real CLI output. Our synthesised per-item lines go away.

**Work:** stream `child.stdout`/`child.stderr`, split on newlines, push each into `job.logs`. Strip ANSI colour codes — the CLI colourises by default and raw escape sequences would render as noise. Keep the existing `JobLogLine { ts, level, msg }` shape so the UI contract does not move; map CLI severity onto `level` where it is detectable and default to `INFO`.

**Residual risk:** the CLI can be verbose. `job.logs` is an unbounded in-memory array today — with CLI output on a large stack it could grow into thousands of lines per job. **Needs a cap** (keep the last N, or drop `DEBUG`), or memory grows with every export in a long-running process.

### Impact 2 — `exportedAt` disappears · **must fix, would fail silently**

The CLI's `export-info.json` is `{"contentVersion":2,"logsPath":"…"}` — no timestamp. The Audit page's cache key **is** `exportedAt` ([`auditScan.service.ts:106`](../../api/v3/services/auditScan.service.ts), `cacheKey: data.exportedAt`). Without it, `readCachedFindings` cannot tell a stale `audit.json` from a fresh one, so **the Audit page would keep showing findings from a previous export with no error and no visible symptom.**

**Fix:** after a successful CLI run, read the CLI's `export-info.json`, merge in `exportedAt: new Date().toISOString()`, write it back. Must be covered by a test that asserts the audit cache still invalidates across two exports.

### Impact 3 — "Specific module" selection · **needs a decision**

`--module` takes one module name. Our UI lets the user tick several.

Options: **(a)** run the CLI once per selected module, sequentially — preserves the UI, multiplies runtime and gives N progress segments; **(b)** always export everything and ignore the unselected modules — simplest, but exports more than the user asked for; **(c)** drop the module picker.

**Leaning (a)**, because it keeps a shipped UI intact and the sequential runs map cleanly onto the progress bar. Also note the CLI's module names differ from ours — `content-types` vs our `contentTypes`, `global-fields` vs `globalFields` — so a mapping table is needed either way.

### Impact 4 — shared CLI config · **scoped down: single-user, local-only**

**The mechanism.** `configHandler.set('authtoken', …)` writes to a **process-wide, host-level** config store, shared by every invocation. Two exports at once overwrite each other's region and credentials mid-run.

**Why this is not a security issue here.** The tool runs locally for one user. There is no second tenant to leak a credential to, and the token in question is already persistently present on that machine — in the CLI's own config from any prior `csdx` use, in our auth store, and in `app.json`.

**What we do NOT build, and why.** An earlier draft of this plan proposed per-invocation isolation via `CS_CLI_CONFIG_PATH` plus `ENCRYPT_CONF=false`, with a helper subprocess to write an encrypted store. **Dropped.** It is real complexity — a temp config dir, an env-var contract captured at module load, a second spawn, and cleanup — bought against a threat that does not exist in a single-user local tool. Recorded here so the reasoning is not rediscovered later:

- `CS_CLI_CONFIG_PATH` **does** work: `config-handler.js:22` reads it into `cwd`, which is passed to every `Conf` construction (lines 102, 127, 168, 178). If this tool is ever hosted or made multi-user, that is the mitigation, and it needs no code we would have to invent.
- Worth knowing regardless: the CLI's at-rest protection is **obfuscation, not encryption**. `getObfuscationKey()` stores its key as a random UUID in a *sibling plaintext file in the same directory* (line 102 constructs that store with no `encryptionKey`), so anyone who can read the directory can read both and decrypt. Setting a strong `ENC_KEY` improves only the fallback path.

**What we DO build: an in-process mutex serialising export jobs.** Not for security — for correctness. With chaining, a 5-run export leaves a wider window for a second export to interleave and swap the region or token mid-chain, producing a wrong-region export rather than a clean failure. A ~5-line mutex in `export.service.ts` removes a genuinely baffling class of bug for almost nothing.

### Impact 4b — region mismatch between v3 and the CLI · **found in Phase 1c, must fix**

`v3/config/cs.ts` picks its Management-API host from `NODE_ENV`:

```
PROD: NA → https://api.contentstack.io/v3
DEV:  NA → https://stag-api.csnonprod.com/v3
```

The CLI's own region map (`cli-config/lib/utils/region-handler.js`) contains **production hosts only** — `NA, AWS-NA, EU, AWS-EU, AU, AWS-AU, AZURE-NA, AZURE-EU, GCP-NA, GCP-EU`.

**So outside production, `config:set:region NA` would point the CLI at the production stack while the UI listed stacks from staging.** The export would silently come from a different Contentstack instance than the operator chose — the same api key exists in both, so nothing would error. This is the sharpest failure mode found so far, and today's exporter does not have it because it reads the host from `cs.ts` directly.

**Fix.** `config:set:region` accepts a custom region: `--cma`, `--cda`, `--ui-host` and `--name`, which must be supplied together. So:

- **production** → `config:set:region <REGION>` with the mapped name.
- **anything else** → `config:set:region --name v3-<region> --cma <host from cs.ts> --cda <…> --ui-host <…>`, so the CLI is pinned to exactly the host `cs.ts` resolved.

Either way the CLI's host is **derived from `cs.ts`**, never assumed, so the two can never diverge.

**Name mapping.** v3 uses underscores (`AZURE_NA`), the CLI hyphens (`AZURE-NA`). All seven of v3's regions have a CLI counterpart under `_ → -`, which is what v2's `.replace(/_/g, '-')` already does. Worth a test asserting every `CS_REGIONS` entry maps to a name the CLI knows, so adding a region to `cs.ts` cannot silently break the export.

**Also noted:** v3's `DEV` map omits `AZURE_EU` while `PROD` has it, so that region is unusable outside production today. Pre-existing, unrelated to this plan, reported not fixed.

### Impact 5 — the progress bar · **decided, needs honest derivation**

The CLI exposes no progress API. The bar must come from observable facts, never from a timer.

**Plan:** derive from module completion. With option (a) above, N modules give N segments; within a module, advance on the CLI's own module-start/finish lines and on the output folder gaining that module's directory. Coarser than today, but every increment corresponds to real completed work. **No fabricated progress.**

### Impact 6 — the graph

`graph.service.ts` builds from the in-memory `contentTypes` array that `runStackSource` returned. That array no longer exists. It must read `content_types/schema.json` from the export folder. Mechanically simple; `contentTypeInventory.service.ts` already does exactly this and can be the model (or the shared reader).

### Impact 7 — CLI availability on the host

`npx @contentstack/cli` resolves from `api/node_modules` today. In a container it must still be installed and executable, and `npx` must not attempt a network fetch. Add a startup check that fails loudly with a clear message rather than failing per-export with a spawn error.

### Impact 8 — exit codes and partial exports

The CLI can fail midway leaving a partially written folder. Today a bundle-write failure is logged but does **not** fail the job (the graph preview was still considered valid). That reasoning disappears — with the CLI the folder *is* the product.

**Plan:** a non-zero exit fails the job. Export to a temp dir and rename into `cmsMigrationData/<stackApiKey>` only on success — which also closes the deferred "atomic rename" defect for free.

### Impact 9 — what is definitively *not* affected

The file-upload path (`From a file`), Audit, Content mapping, Destination, the project dashboard, and all of v2. They read the folder; the folder keeps its location and a shape our readers already handle.

## 8. Sequencing

Ordered so each phase is independently verifiable and an interrupted run leaves something coherent.

| Phase | Work | Gate |
|---|---|---|
| **0 — spike** | ~~Config isolation~~ (resolved, Impact 4). Remaining: capture real CLI stdout for a small stack to learn the actual line format, and confirm export order within a chain does not matter (§5.5) | Both answered before Phase 2 |
| **1 — CLI boundary** | `cliExport.service.ts` + `cliAuth.util.ts` + tests. Spawn, stream, exit codes, region + token injection mirroring v2's `setOAuthConfig`/`setBasicAuthConfig`, and the serialising mutex. **No config isolation** (Impact 4) | New tests green; nothing wired in |
| **2 — progress + logs** ✅ | ANSI stripping (Phase 1), the log cap (Q-4), the stage caption (F-4), level parsing (F-6), and per-module progress from the CLI's own `Exporting module: 'X'...` announcements | **DONE 2026-08-11.** A whole-stack export now walks 10% → 71% across the CLI's 17 real modules, then 75% on run completion — previously 10 → 75 with nothing in between for the entire export. `cliProgress.util.ts`, 12 tests |
| **3 — swap the pipeline** ✅ | `export.service.ts` calls the CLI; temp dir + atomic rename; write `exportedAt`; `getCliCredential` resolves the token from the shared auth store | **DONE 2026-08-11.** 13 stack-mode tests re-pointed to 16 at the CLI boundary; full `api` suite green (114 files / 1260 tests) |
| **4 — graph from disk** | `graph.service.ts` reads `content_types/schema.json` | Graph tests green |
| **5 — UI** | `ExportLogView` renders raw CLI lines; counters/tiles per the §9 decision | Full `ui` suite green |
| **6 — end-to-end** ✅ | Real export of a real stack; Audit and Content mapping both read the CLI-produced folder | **DONE 2026-08-11.** Whole-stack export of `blt18229446c6d5ea6b` via the UI: 17 module folders, clean atomic finalise (no leftover `.partial-`), `exportedAt` merged into `export-info.json` with `contentVersion` preserved, graph persisted with counts matching the folder exactly (6 / 10 / 2 / 0, 5 reference edges). Audit reads it (`readable: true`, correct `exportedAt` cache key) and Content mapping reads 6 content types with real titles. Surfaced F-7 |

Phases 1–2 land no behaviour change, so they are safe to merge early.

## 9. Open questions

| # | Question | Blocks |
|---|---|---|
| ~~Q-1~~ | ~~The five live counters?~~ **RESOLVED — update per module, read from the exported folder after each chained run finishes.** Real numbers at a coarser cadence; nothing inferred or timed. | — |
| ~~Q-2~~ | ~~Module selection approach?~~ **RESOLVED — see §5.3–5.5.** | — |
| ~~Q-3~~ | ~~Per-invocation config path?~~ **RESOLVED — yes.** See Impact 4. | — |
| ~~Q-4~~ | ~~Cap on `job.logs` — last N lines, or drop `DEBUG`? What N?~~ **RESOLVED — last 2000 lines, oldest dropped, count surfaced.** `V3_MAX_LOG_LINES` overrides it, read per call so it is configurable without a restart. Dropping by LEVEL was rejected: with real CLI output we do not control the levels, and `DEBUG` is where the CLI says what it is doing. The OLDEST lines go because the end of the log holds the outcome — the final summary on success, the failing module's error on failure. `droppedLogs` is sent to the client (always, including `0`) and the log view renders "N earlier lines omitted", so truncation is visible rather than silent. |
| ~~Q-5~~ | ~~All 17 modules, or a subset?~~ **RESOLVED — whole-stack means all 17; otherwise the closure in §5.4.** | — |
| ~~Q-6~~ | ~~Does the file-upload path still need `bundleWriter.service.ts`?~~ **RESOLVED — the module stays, one of its two functions is now orphaned.** `writeUploadedBundleFolder` is still live for the FILE-upload path (an uploaded zip is already a real export, so no CLI is involved). `writeStackBundleFolder` has no production caller left. It is deliberately **kept, not deleted**, until the CLI path has run against real stacks — deleting it would also mean deleting its 11 passing tests, which is not a trade worth making before the replacement is proven. Marked in the source with a do-not-rewire note. | — |
| ~~Q-8~~ | ~~Shared closure table with the file-upload picker?~~ **RESOLVED — one shared table.** The referential facts hold for an uploaded bundle too, so the file picker widening is a correctness gain. Accepted behaviour change: picking `entries` on an upload now forces more modules than before. | — |
| ~~Q-7~~ | ~~Show the forced closure as locked, or enforce silently?~~ **RESOLVED — the UI already does this.** `ui/v3/utils/moduleSelection.ts` has `toggleModule` (auto-selects transitive dependencies, refuses to unselect one a dependent needs) and `forcedKeys`; `StackPanel.tsx`'s `ModuleRow` already renders a forced module as **disabled with a `required by entries` note**. So the closure is a **data change to `MODULE_DEFS.dependsOn`** and both the enforcement and the visible locking follow with no new UI logic. | — |

## 9b. Findings during implementation

Three things the plan did not anticipate, all found by running against real artefacts rather than fixtures.

| # | Finding | Where it came from | Status |
|---|---|---|---|
| **F-1** | **`assets/assets.json` is a chunk INDEX, not the asset list.** Its real shape is `{"1": "<uuid>-assets.json"}`; the assets live in the chunk file. Counting the index reported **1 asset for a real 80-asset export**. My fixture had invented the shape it expected, so 18 tests passed against a layout the CLI never produces. | Running `readExportCounts` against the real `cs_chirag_demo` export instead of the fixture | **Fixed.** Counts now sum the `*-assets.json` chunk files, entries use the same rule, and a test pins the index-vs-chunk distinction. Fixture corrected to the CLI's real shape |
| **F-2** | **The CLI exports entry VARIANTS; our own exporter never did.** A real export of the demo stack produced **7 `variants/` folders** under `entries/<ct>/<locale>/`. Nothing in `bundleWriter.service.ts` has any concept of them, so every variant was silently dropped. | Listing the real export tree | **Resolved by the revamp itself** — this is now a reason not to fall back to the old writer, recorded on `writeStackBundleFolder` |
| **F-3** | **`@contentstack/cli-config` cannot be imported at all.** It is an oclif PLUGIN: its package.json declares no `main`, `module` or `exports`. `applyCliRegion` imported `regionHandler` from it and would have thrown on load — every CLI export dead on arrival. All 15 `cliAuth` tests passed because they **mocked the very module that could not be imported**. | The full `api` suite: route tests load `export.service` transitively and failed to resolve the package | **Fixed.** Now reads the endpoint map from `@contentstack/utils` (`getContentstackEndpoint`) — which is what `region-handler.js` calls internally anyway — and writes `configHandler.set('region', …)`, exactly what `setRegion` did. The test no longer mocks the region map, so this class of bug fails loudly here rather than in a route test |

| **F-4** | **The UI's stage caption was left asserting work that was not happening.** `ExportLogView` derived it from the progress PERCENTAGE against a hardcoded table of the OLD pipeline's phase boundaries (`40 → Reading content types`, `65 → Assets & global fields`, `82 → Reading entries`). Stack exports now advance `10 + (i+1)/total × 65` per completed CLI run, so a whole-stack export sat at 75% and read **"Reading entries" for its entire duration**, while a content-types-only export walked through "Assets & global fields" without exporting any. | Reading `ExportLogView.tsx` after Phase 3 landed, when asked what remained | **Fixed.** The caption is now SERVER-provided (`Job.stage`), since only the job knows which module the CLI is on, and is announced BEFORE each run starts rather than on completion. The percentage table survives solely as the file-mode fallback, whose phases are unchanged. A whole-stack run is captioned "Exporting the whole stack" and never names a module it is not exporting |

| **F-5** ⚠️ | **The CLI exits 0 on a hard failure.** Measured: `csdx cm:stacks:export -k blt0000000000000000 -d /tmp/x --branch main -y` printed `ERROR: No branch found with the given name main` and **exited 0**. `runOne` trusted the exit code, so that export would have been reported SUCCESSFUL — after which the pipeline stamps `exportedAt` and renames an EMPTY folder into place, and Audit and Content mapping read it as a valid export. A silent empty migration, strictly worse than a crash. | Pre-flight check before the first real UI test | **Fixed.** A declared `ERROR:` line fails the run regardless of exit code, and stops the chain. Matching only the CLI's own declared level — not the substring "error" — because `INFO: The log has been stored at '/logs/error.log'` is a legitimate healthy line, and a substring match would abort good exports |
| **F-6** | **The real CLI output format, finally captured** — `[2026-08-11 18:11:42] SUCCESS: Exported content types!`. Levels are DEBUG / INFO / **SUCCESS** / WARN / ERROR (confirmed from a real run's `info.log`, which records `{"level":"success"}`). Everything goes to **stdout**; `stderr`, `error.log` and `warn.log` were all empty across captured runs. Per-module markers exist: `INFO: Exporting module: 'assets'...`. | The failed pre-flight run, plus `~/Documents/contentstack_export_logs/` from a real earlier export | **Partly used.** Level parsing is done — `parseCliLine` strips the prefix and reports the CLI's declared level, so errors render as errors and the log view's filter chips work instead of every line arriving as INFO. The per-module markers are the remaining input for finer progress, still Phase 2 |

| **F-7** | **Audit counted 11 assets for a real 10-asset export.** `auditReader.service.ts` merged every `assets/*.json` except `index.json`, keeping any value where `typeof value === "object"`. `metadata.json` is `{"<uuid>-assets.json": [ …versions… ]}` — an ARRAY value, which passes that guard — so its KEY, a filename, was merged in as an asset uid. One phantom asset per export, with a filename where a uid belongs. | The first real end-to-end run: Audit read the CLI folder and reported 11 against a folder holding 10 | **Fixed.** The merge is restricted to the `-assets.json` chunk suffix (same rule `exportFolder.util.ts` now uses) and rejects arrays. Chosen over blacklisting `assets.json`/`metadata.json` by name, since the CLI may add more bookkeeping files. Verified against the real export: 10, all keys `blt…` uids |

**F-3 and F-7 are the same lesson twice, and F-1 a third time:** all three read a CLI *bookkeeping* file as data, and all three were invisible against fixtures that only ever wrote the data file. Any new CLI-folder reader should be run against a real export before it is trusted.

**F-3 is the one worth generalising:** mocking a module hides whether it can be loaded. The region map is pure data with no side effects, so mocking it bought nothing and cost a real bug. `configHandler` stays mocked — it writes to the developer's actual CLI config on disk.

## 10. Risks

| # | Risk | Likelihood · Impact | Mitigation |
|---|---|---|---|
| ~~R-1~~ | ~~Cross-user credential clobber via the shared CLI config~~ | **N/A** | **Withdrawn: single-user, local-only tool (see the header and Impact 4).** No second tenant exists. Returns immediately if this is ever hosted — mitigation is `CS_CLI_CONFIG_PATH`, already verified to work |
| ~~R-1b~~ | ~~Plaintext credential on disk~~ | **N/A** | **Withdrawn with R-1** — the isolation that required it is no longer being built |
| R-1c | **Two concurrent exports corrupt each other's region/auth**, producing a wrong-region export instead of an error | Low · Medium | In-process mutex serialising export jobs (Impact 4). A correctness guard, not a security control |
| **R-9** ✅ | **The CLI exports from the wrong Contentstack instance** outside production, because its region map is production-only while `cs.ts` resolves staging hosts | **High if unhandled · High** | **Built as verify-and-REFUSE, not a custom region.** `applyCliRegion` resolves the region, compares its `cma` against `csApiHost(region)`, and throws `CliRegionMismatchError` naming both hosts — writing to the CLI config only after the check passes, so a refused export leaves no wrong region behind for the next one. A custom region was rejected because it would mean inventing staging `cda`/`uiHost` values `cs.ts` does not hold. **In practice this never fires:** every npm script, `dev` included, sets `NODE_ENV=production`, so the app and the CLI both resolve production. It fires only when the app is genuinely pointed elsewhere, which is exactly when it should |
| R-2 | **Audit cache silently stops invalidating** because `exportedAt` is gone (Impact 2) | High if missed · High | Explicit post-run write plus a test asserting invalidation across two exports |
| R-3 ✅ | **CLI output format changes** on a version bump, breaking progress derivation | Medium · Medium | **Handled by construction.** All parsing lives in one small pure unit (`cliProgress.util.ts` + `parseCliLine`). If a CLI version stopped emitting the announcement, `noteModule` simply never fires and progress falls back to the per-run signal — the previous coarse-but-correct behaviour. Nothing in the parsing path can fail an export. A test reads the CLI's OWN module list from `node_modules` and asserts ours matches, so a changed module set fails there rather than silently skewing the bar |
| ~~R-4~~ ✅ | **Unbounded log growth** in a long-running process | Medium · Medium | **Done** — 2000-line cap in `pushLog`, oldest discarded, `droppedLogs` counted and surfaced in the UI. Mattered more than first assessed: the status endpoint serialises the whole log on every poll, so an uncapped array degrades the UI well before it exhausts memory |
| R-5 | **Loss of per-item log detail** feels like a regression to users used to the current stream | Medium · Low | Accepted deliberately — the user asked for real CLI output |
| R-6 | **Partial folder on failure** read as a complete export by Audit or Content mapping | Low after Impact 8 · High | Temp dir + atomic rename; non-zero exit fails the job |
| R-7 ✅ | **CLI missing in the deployed image** | Low · High | **Done** — `cliPresence.util.ts` probes `node_modules/.bin/csdx`, the same executable the spawn resolves, and `runCliExport` refuses before spawning with "run `npm install` in the api directory". Checked at export time rather than server startup: startup is not when the operator can act on it, and a startup check would either add oclif's ~0.85s boot to every launch or block the server on something only the export needs. A test pins that the lock is released when the check throws — otherwise the first failed export would deadlock every later one, turning a one-line fix into a server that silently never exports again |
| R-8 | **44 re-pointed tests hide a real regression** if re-pointed carelessly | Medium · High | No test deleted for convenience; each change records its reason in the file |

## 11. What "done" looks like

- A real stack exports via `csdx`, and the Source step shows the actual CLI output streaming, with a progress bar that advances on real module completion.
- Audit and Content mapping both read the CLI-produced folder with no code change of their own.
- `exportedAt` is present, and the audit cache invalidates across two consecutive exports.
- Two concurrent exports for different users cannot cross credentials.
- A failed export leaves **no** folder at `cmsMigrationData/<stackApiKey>`.
- `api` and `ui` suites fully green, with no test deleted to get there.

## 12. Explicit non-goals

- The **import** side. `cm:stacks:import` is v2's and stays as it is.
- The **file-upload** path.
- Consuming the 11 newly available modules — the export will contain them; nothing reads them yet.
- Using `--content-types` to narrow the export from Content mapping's selection. A real optimisation, deliberately out of scope here.
- Fixing v2's identical shared-config behaviour in `api/src`. Harmless in a single-user local tool; noted for its owners in case the deployment model ever changes.
- Hardening the CLI's at-rest config protection (a strong `ENC_KEY`). Out of scope, and of limited value while the obfuscation key sits in an adjacent plaintext file — recorded in Impact 4 so the limitation is known.

## 13. References

- [`api/src/services/runCli.service.ts`](../../api/src/services/runCli.service.ts) — the proven spawn + region + auth pattern
- [`api/src/utils/config-handler.util.ts`](../../api/src/utils/config-handler.util.ts) — `setOAuthConfig` / `setBasicAuthConfig`
- [`api/v3/services/export.service.ts`](../../api/v3/services/export.service.ts) — the pipeline being replaced
- [`api/v3/services/auditScan.service.ts`](../../api/v3/services/auditScan.service.ts) — the `exportedAt` cache-key dependency
- [`api/v3/services/contentTypeInventory.service.ts`](../../api/v3/services/contentTypeInventory.service.ts) — already reads the CLI layout; the model for Phase 4
- `docs/features/cs-audit-report/tdd.md` §Gaps — where the variants and fallback-record defects were first recorded
- `~/Documents/cs_chirag_demo` — the real CLI export measured for §4
