# TDD Execution Report — Contentstack Destination Selection (Content Map & Audit — Destination panel)

- **Slug:** `cs-destination-selection`
- **Inputs read:** [feature.md](./feature.md) · [prd.md](./prd.md) · [trd.md](./trd.md) · [cs-destination-selection-test-cases.md](./cs-destination-selection-test-cases.md)
- **Reference design:** `https://claude.ai/design/p/132abb68-eaa7-494b-9820-3f9cf5fa6f15?file=Content+Map+and+Audit.dc.html` — page **"Content Map and Audit"**, **Destination panel** (`connectPanel: 'destination'`, step 3 of the tracker). Resolved via the **DesignSync MCP** (`get_file`), not a live Chrome session — `claude-in-chrome` was not connected. The `.dc.html`, `support.js`, `_ds_bundle.js` and all six token files were pulled down and served locally so the prototype could be rendered and measured; a later re-check needs the same DesignSync fetch, which is fully reproducible.
- **Snyk precondition:** ⚠️ **NOT met.** The user was asked and confirmed no Snyk scan has been run ("No, not yet, we will see it afterwards"), then directed the run to proceed anyway. There is no `fix-snyk-issues` skill in this repo. Recorded here as an explicit, user-waived deviation from the skill's Step 0 gate — **a scan should still be run before this lands.**
- **Package(s) touched:** `ui/`, `api/`
- **Run date:** 2026-07-30
- **Outcome:** complete — all three phases finished; one visual difference class left unresolved by design (shared primitives owned jointly with the shipped Source panel, see Phase 3).
- **Phases finished:** 1 ✅ · 2 ✅ · 3 ✅

---

## Phase 1 — Test cases

Strict 1:1. `Neg. category`: 1 missing/empty · 2 invalid type · 3 boundary · 4 forbidden state · 5 permission · 6 dependency failure · 7 conflict.

All 50 `Automated = Y` rows are covered; each has exactly one positive and one paired negative test. Paths below are relative to the repo root.

| Test Case ID | Traces to | Positive test | Negative test | Neg. category | Result |
|---|---|---|---|---|---|
| TC_DEST_001 | AC-1.1, FR-1.7 | `ui/tests/unit/v3/components/destination/DestinationPanel.test.tsx` | same file — all fields set + source ready ⇒ Proceed enabled | 4 — forbidden state | ✅ |
| TC_DEST_002 | FR-1.2 | DestinationPanel.test.tsx | no Region ⇒ Org disabled, "Select a region first" | 1 — missing input | ✅ |
| TC_DEST_003 | AC-6.1, FR-1.3 | DestinationPanel.test.tsx | no Org ⇒ Stack disabled, no create option | 1 — missing input | ✅ |
| TC_DEST_004 | AC-6.2 | DestinationPanel.test.tsx | `__create__` sentinel opens modal, selects nothing | 4 — forbidden state | ✅ |
| TC_DEST_005 | EC-10 | DestinationPanel.test.tsx | populated org lists real stacks too | 4 — forbidden state | ✅ |
| TC_DEST_006 | EC-1 | DestinationPanel.test.tsx | orgs present ⇒ no empty state | 1 — missing input | ✅ |
| TC_DEST_007 | EC-2, FR-1.7 | DestinationPanel.test.tsx | complete fields ⇒ click reaches persist thunk | 4 — forbidden state | ✅ |
| TC_DEST_008 | AC-7.1, FR-1.4 | `ui/tests/unit/v3/components/destination/CreateStackModal.test.tsx` | closed ⇒ no dialog/controls at all | 4 — forbidden state | ✅ |
| TC_DEST_009 | FR-1.4 | CreateStackModal.test.tsx | whitespace-only name ⇒ disabled, no request | 1 — missing/empty input | ✅ |
| TC_DEST_010 | AC-7.2, FR-1.5 | `ui/tests/unit/v3/store/thunks/destination.thunks.test.ts` | blank name ⇒ no create request | 1 — missing/empty input | ✅ |
| TC_DEST_011 | AC-7.3, FR-1.6 | CreateStackModal.test.tsx | close control also discards the draft | 4 — forbidden state | ✅ |
| TC_DEST_012 | EC-5 | destination.thunks.test.ts | success ⇒ no error, stack selected | 6 — dependency failure | ✅ |
| TC_DEST_013 | FR-1.4 | destination.thunks.test.ts | supplied description IS forwarded | 1 — missing/empty input | ✅ |
| TC_DEST_014 | AC-7.4, EC-3 | destination.thunks.test.ts | non-colliding name completes | 7 — conflict | ✅ |
| TC_DEST_015 | AC-2.1, FR-2.1 | destination.thunks.test.ts | home region ⇒ no modal, loads orgs | 4 — forbidden state | ✅ |
| TC_DEST_016 | AC-2.1, FR-2.2 | `ui/tests/unit/v3/components/destination/DestRegionLoginModal.test.tsx` | email only ⇒ disabled, no request | 1 — missing input | ✅ |
| TC_DEST_017 | FR-2.2 | DestRegionLoginModal.test.tsx | whitespace-only creds ⇒ disabled | 1 — missing/empty input | ✅ |
| TC_DEST_018 | AC-2.2, FR-2.3 | destination.thunks.test.ts | blank creds ⇒ no login attempted | 1 — missing input | ✅ |
| TC_DEST_019 | EC-4 | destination.thunks.test.ts | valid creds ⇒ no error, region unlocked | 6 — dependency failure | ✅ |
| TC_DEST_020 | AC-2.3, FR-2.4 | `ui/tests/unit/v3/store/slice/destination.slice.test.ts` | successful login keeps the new region | 4 — forbidden state | ✅ |
| TC_DEST_021 | AC-3.1, FR-3.1 | `ui/tests/unit/v3/components/destination/ImportAuthCards.test.tsx` | exactly one card checked (mutually exclusive) | 4 — forbidden state | ✅ |
| TC_DEST_022 | AC-3.2, FR-3.2/3.5 | ImportAuthCards.test.tsx | no method ⇒ no field, no warning | 1 — missing input | ✅ |
| TC_DEST_023 | FR-3.2, NFR-1 | ImportAuthCards.test.tsx | not rendered as `type="password"` | 2 — invalid type/shape | ✅ |
| TC_DEST_024 | AC-3.3, FR-3.4 | ImportAuthCards.test.tsx | switching to mgmt DOES reveal the field | 4 — forbidden state | ✅ |
| TC_DEST_025 | AC-3.4, FR-3.6, EC-9 | destination.slice.test.ts | re-selecting the same method preserves the value | 4 — forbidden state | ✅ |
| TC_DEST_027 | AC-3.5, FR-3.3, FR-6.3 | destination.thunks.test.ts | authToken persists without minting a token | 4 — forbidden state | ✅ |
| TC_DEST_028 | AC-3.6, EC-13 | destination.thunks.test.ts | non-colliding token name persists + advances | 7 — conflict | ✅ |
| TC_DEST_030 | AC-8.1, FR-9.1 | `ui/tests/unit/v3/components/destination/BranchMapping.test.tsx` | source side read-only, not a select | 2 — invalid type/shape | ✅ |
| TC_DEST_031 | AC-8.2, FR-9.2 | BranchMapping.test.tsx | many branches still ⇒ exactly one row | 4 — forbidden state | ✅ |
| TC_DEST_032 | FR-9.3 | BranchMapping.test.tsx | destination side NOT marked read-only | 2 — invalid type/shape | ✅ |
| TC_DEST_033 | EC-12 | BranchMapping.test.tsx | existing stack offers its full branch list | 4 — forbidden state | ✅ |
| TC_DEST_034 | AC-4.1, FR-4.1 | `ui/tests/unit/v3/components/destination/LanguageMapping.test.tsx` | master row read-only + not removable | 2 — invalid type/shape | ✅ |
| TC_DEST_035 | AC-4.2 | LanguageMapping.test.tsx | persisted additional mappings DO render | 4 — forbidden state | ✅ |
| TC_DEST_036 | AC-4.3, FR-4.2 | LanguageMapping.test.tsx | two clicks ⇒ two independent rows | 4 — forbidden state | ✅ |
| TC_DEST_037 | AC-4.4, FR-4.3, EC-7 | LanguageMapping.test.tsx | removing one of several keeps the rest | 4 — forbidden state | ✅ |
| TC_DEST_038 | AC-1.4, FR-5.1 | DestinationPanel.test.tsx | matching regions ⇒ no banner | 4 — forbidden state | ✅ |
| TC_DEST_039 | AC-1.5, EC-8 | DestinationPanel.test.tsx | switching away ⇒ banner returns | 4 — forbidden state | ✅ |
| TC_DEST_040 | FR-5.1 | DestinationPanel.test.tsx | not-ready source still disables Proceed | 4 — forbidden state | ✅ |
| TC_DEST_041 | AC-1.2, FR-6.1/6.3 | destination.thunks.test.ts | not-ready source blocks the thunk itself | 4 — forbidden state | ✅ |
| TC_DEST_042 | AC-1.3, FR-6.2 | DestinationPanel.test.tsx | ready source removes the caption | 4 — forbidden state | ✅ |
| TC_DEST_043 | EC-6 | DestinationPanel.test.tsx | back to not-ready re-disables live | 4 — forbidden state | ✅ |
| TC_DEST_044 | EC-2 | DestinationPanel.test.tsx | mgmt chosen + blank name ⇒ still disabled | 1 — missing input | ✅ |
| TC_DEST_045 | FR-7.1 | DestinationPanel.test.tsx | locales-mapped value updates live, not stale | 4 — forbidden state | ✅ |
| TC_DEST_046 | AC-9.1, FR-10.1 | `ui/tests/unit/v3/components/destination/StackContents.test.tsx` | no stack ⇒ no name rendered | 1 — missing input | ✅ |
| TC_DEST_047 | AC-9.2, FR-10.2 | StackContents.test.tsx | non-empty stack ⇒ no empty copy | 4 — forbidden state | ✅ |
| TC_DEST_048 | AC-9.3, FR-10.3 | StackContents.test.tsx | empty stack ⇒ zero tiles | 4 — forbidden state | ✅ |
| TC_DEST_049 | UC-9a | StackContents.test.tsx | creating clears the previous stack's tiles | 4 — forbidden state | ✅ |
| TC_DEST_050 | AC-5.1, FR-8.2 | destination.thunks.test.ts | 404 ⇒ pristine form, no error | 6 — dependency failure | ✅ |
| TC_DEST_051 | EC-5 | destination.thunks.test.ts | success clears the error and advances | 6 — dependency failure | ✅ |
| TC_DEST_052 | NFR-1 | `api/tests/unit/v3/routes/destination.routes.test.ts` | valid `app_token` reaches the handler | 5 — permission denial | ✅ |

**Totals: 50 positive, 50 negative** (equal — verified by script, not by eye).

### Supplementary paired coverage (not matrix rows)

The four new endpoints and three new Contentstack calls needed unit coverage of their own. These are clearly labelled `(<unit>, positive/negative)` rather than given invented `TC_DEST_###` numbers, so the matrix count above stays exact. **10 additional pairs (20 tests):**

- `api/tests/unit/v3/routes/destination.routes.test.ts` — 7 pairs: create-stack (valid/missing name), create-stack collision, management-token (valid/missing key), management-token collision, stats (empty/404), persist (valid/bad method), read (found/404).
- `api/tests/unit/v3/services/csManagement.destination.test.ts` — 3 pairs: `createStack`, `createManagementToken`, `getStackStats`.

Pre-existing tests strengthened rather than duplicated: none — this feature had no prior tests.

### Automated = N — out of scope by design

| Test Case ID | Type | Why not automatable |
|---|---|---|
| TC_DEST_026 | Usability | "Warning does not reappear for the remainder of the session" is a session-scoped judgment; the dismiss action itself is covered structurally by TC_DEST_022. |
| TC_DEST_029 | Functional | Asserts a credential becomes "look-up-able" by a *later, unbuilt* step (FR-3.7 / TR-15), whose owner is still unresolved (Q-20 / TQ-19, BLOCKING for T-13). Nothing exists to assert against yet. |
| TC_DEST_053 | Functional | "Disable the v2 API and confirm v3 still works" is an environment/deployment check, not a unit test. |
| TC_DEST_054 | Security | Requires inspecting real log output for absence of secrets — needs a live run, not a unit assertion. |
| TC_DEST_055 | Usability | Keyboard operability across the whole panel is an exploratory a11y sweep. (Semantics *were* verified: `role="radiogroup"`/`role="radio"` + `tabIndex=0`, and a real `Tab` keypress produced `:focus-visible` — see Phase 3.) |
| TC_DEST_056 | Usability | Screen-reader announcement is a manual AT check. (`aria-readonly="true"` on both locked halves was verified in the DOM — see Phase 3.) |
| TC_DEST_057 | Usability | WCAG 2.1 AA audit is a tooling/manual pass. |
| TC_DEST_058 | Usability | Observability logging is a server-side follow-up; no logging was added by this feature (see Gaps). |

---

## Phase 2 — Functionality

### Implementation changes

**`api/` (backend spine — P0 first, per prd.md §6)**

| File | Change | Satisfies |
|---|---|---|
| `api/v3/models/types.ts` | New `V3Destination`, `V3DestinationStack`, `V3ImportAuth`, `V3LocaleMapping`, `V3ImportAuthMethod`; `destination?` on `V3Project`. Token *secret* deliberately not in the persisted shape. | trd.md DM-1, NFR-1 |
| `api/v3/models/project.store.ts` | New `upsertV3Destination` — additive, never touches the `source` sub-document. | FR-8.2, TR-9 |
| `api/v3/services/csManagement.service.ts` | New `csPost` (429 backoff, same as `csGet`); `createStack`, `createManagementToken` (read+write scope), `getStackStats`, `listLocales`; deterministic `en-US` number formatting. | FR-1.5, FR-3.3, FR-10.2–10.4 |
| `api/v3/controllers/destination.controller.ts` | New — 6 handlers; validates `stack.apiKey` + `importAuth.method`; resolves cross-region credentials via the existing `resolveRegionCredential`. | API-1…API-5 |
| `api/v3/routes/destination.routes.ts`, `routes/projectDestination.routes.ts` | New routers. | trd.md §6 |
| `api/v3/index.ts` | Mounted both behind `authenticateV3User`. | NFR-1 |

**`ui/`**

| File | Change | Satisfies |
|---|---|---|
| `ui/v3/store/slice/destination.slice.ts` | New slice; `setImportMethod` discards the *other* method's token name only on an actual switch; `stackCreated` marks the stack empty without a fetch; `hydrate` tolerates partial documents; exports the pure `canProceed` + `destStackLabel`. | FR-3.6/EC-9, UC-9a, AC-5.1, FR-6.1 |
| `ui/v3/services/api/destination.service.ts` | New. Region/org/stack/branch listing + persisted-source read **call Source's existing `/v3/source/*` endpoints** rather than duplicating them. | TC-1, TR-2 |
| `ui/v3/store/thunks/destination.thunks.ts` | New. Region cascade + region-login, create-stack, stats, resume, and `proceedToContentMapping` (creates the management token **before** persisting; a failure blocks the advance). | AC-3.5/3.6, FR-6.3, EC-13 |
| `ui/v3/components/destination/*.tsx` | New — `DestinationPanel`, `ImportAuthCards`, `BranchMapping`, `LanguageMapping`, `MappingRow` (shared), `StackContents`, `DestinationSummary`, `CreateStackModal`, `DestRegionLoginModal`. | UC-1…UC-9 |
| `ui/v3/store/index.ts` | Registered the `destination` reducer. | — |
| `ui/v3/pages/Migration/index.tsx` | `?panel=destination` renders the panel; deliberately does **no** step-number mapping (shared chrome, and the Source→Audit→Destination order is still open — Q-1/Q-2). | feature.md §5 |
| `ui/v3/styles/theme.css` | Token/primitive fidelity — see Phase 3. | NFR-3 |

### Two real defects the tests caught (fixed in the implementation, never in the test)

1. **`currentCredential` forwarded `regionUserId: undefined`** for any region that wasn't the known home region. The server's `resolveRegionCredential` would then reject a request the session credential could have served. Fixed to only forward a cross-region credential once one is actually resolved. Caught by TC_DEST_027.
2. **`canProceed` lived in the thunks module**, so `DestinationPanel` imported it from a module the component tests mock — it arrived `undefined` and every panel test failed. Moved to the slice, where a pure state derivation belongs. Caught by all 28 DestinationPanel tests.

### Full-suite regression

Real output, both packages, after all Phase 2 **and** Phase 3 changes:

```
ui/  $ npm test
 Test Files  41 passed (41)
      Tests  542 passed (542)
   Duration  6.29s

api/ $ npm test
 Test Files  92 passed (92)
      Tests  810 passed (810)
   Duration  2.78s
```

- [x] All previously-passing tests still pass. (`ui` 442 → 542, `api` 788 → 810; the deltas are exactly the 100 + 20 new tests.)
- [x] No test weakened, skipped, or deleted to force green.

Existing tests intentionally updated: **none.**

**One test-harness fix, disclosed:** three `DestinationPanel` tests (TC_DEST_043 ×2, TC_DEST_045 negative) dispatch to the store *after* `render()` and assert the live re-render. React 18 does not flush that without `act()`, so they failed on a warning rather than on behavior — a bug in the test, fixed per the skill's §1.2. The dispatches are now wrapped in `act()`; **no assertion was changed, relaxed, or removed.**

### Coverage

```
ui/  $ npm run test:coverage → All files 85.98% stmts / 77.51% branch  (thresholds met)
api/ $ npm run test:coverage → All files 78.75% stmts / 58.96% branch
```

⚠️ **Neither number reflects this feature.** Both packages set `coverage.include` to `src/**` only (`ui/vitest.config.ts:14`, `api/vitest.config.ts:11`), so the entire `v3/**` tree — this feature *and* the teammate's already-shipped `cs-source-selection` — is invisible to coverage. Not changed unilaterally; see "Config notes".

Uncovered branches introduced: not measurable while `v3/**` is outside the coverage scope. Every new unit does have both a positive and a negative test exercising it.

---

## Phase 3 — Pixel-perfect UI

Method: the reference `.dc.html` + `support.js` + `_ds_bundle.js` + all six token files were fetched via DesignSync, served on `127.0.0.1:8934`, and driven to the Destination panel. The implementation was rendered through a temporary harness (deleted afterwards) that seeds the store directly, because the sandboxed browser has no v3 session. Both sides were measured with `getComputedStyle` at the same 1440×1000 viewport — numbers below are read values, not estimates.

### Token comparison

| Token / element | Reference | Implemented | Match |
|---|---|---|---|
| Panel eyebrow | `10px / 800 / 0.7px / rgb(14,131,89)` | identical | ✅ |
| Summary eyebrow | `10px / 800 / 0.7px / rgb(124,58,240)` | identical | ✅ |
| Modal eyebrow (`.cs-eyebrow`) | `12px / 700 / 0.48px / rgb(124,58,240)` | was 10px/800 → **fixed** via new `.v3-eyebrow-lg` | ✅ → fixed |
| Modal `h3` | `20px / 800` (`--text-h4`) | `var(--text-h4)` → 20px | ✅ |
| Modal panel shadow | `--shadow-xl` = `0 24px 56px rgba(22,19,32,.16)` | was `--shadow-lg` (token absent) → **added `--shadow-xl`, fixed** | ✅ → fixed |
| Modal overlay | `rgba(12,13,23,.55)` + `blur(2px)`, pad 24, z 1000 | identical | ✅ |
| Modal max-width | create 420 / login 390 | 420 / 390 | ✅ |
| Cross-region banner surface | `--info-surface` = `#E9F1FE` | was falling back to `--brand-subtle` (violet — token absent) → **added `--info`/`--info-surface`/blue ramp, fixed** | ✅ → fixed |
| Cross-region banner icon | `--info` = `rgb(30,84,201)` | `rgb(30,84,201)` | ✅ |
| Auth card | `pad 12px 13px / 1px rgb(210,205,223) / r12 / #fff / gap 6` | identical | ✅ |
| Auth card label · desc | `13px/700` · `11px/rgb(126,118,145)/1.4` | identical | ✅ |
| Locked badge (Locked/Master) | `10px / 700 / uppercase / 0.5px / rgb(171,164,189)` | identical | ✅ |
| Locked value box | `h40 / pad 0 12px / 1px rgb(229,226,238) / r8 / rgb(241,239,247) / gap 8` | identical | ✅ |
| Stat tile | `pad 9px 11px / 1px rgb(229,226,238) / r8 / rgb(241,239,247) / gap 2` | identical | ✅ |
| Stat value · label | `15px/800/tabular-nums` · `10.5px/700/uppercase/0.42px` | identical | ✅ |
| Stack-contents card | `pad 16px 18px / r12 / #fff / --shadow-sm / gap 12` | identical | ✅ |
| Summary card | `pad 16px 18px / r12 / linear-gradient(160deg,#F5EEFF,transparent 72%) / gap 12` | identical | ✅ |
| Section title · column header | `12px/700` · `11px/700` | identical | ✅ |
| Field hint | `12px / rgb(126,118,145) / 18px` | was 11.5px → **fixed** | ✅ → fixed |
| Master-locale helper | `11px / rgb(171,164,189) / 1.45` | identical | ✅ |
| Page `h1` · sub | `22px/800/-0.44px` · `13.5px/rgb(126,118,145)` | identical | ✅ |
| Status badge | `12px / 600 / pad 0 10px / h24 / r pill / --surface-sunken / --text-body` | was 11px/700/pad 4px 11px/`--text-muted` → **fixed** | ✅ → fixed |
| Add-language dashed button | `1px dashed --border-strong`, hover `border --brand-strong` + `bg --brand-subtle` | hover was missing (inline styles can't do `:hover`) → **fixed via `.v3-addrow`** | ✅ → fixed |
| Focus ring | `--ring-focus` = `color-mix(in oklch, violet-500 45%, transparent)`, 3px | `oklch(0.614 0.236 295 / .45) 0 0 0 3px` + `--brand-strong` border | ✅ |
| `box-sizing` | `border-box` globally (DS `base.css`) | **was missing from `.v3-scope`** → columns overflowed their card by 7px at 768px → **fixed** | ✅ → fixed |
| **Field label** | **`14px / 600`** | `.v3-label` → `13px / 700` | ❌ **unresolved — shared** |
| **Select / Input** | **`fontSize 14px`, `paddingRight 38px`** | `.v3-field` → `13.5px`, `34px` | ❌ **unresolved — shared** |
| **Primary button** | **`pad 0 18px`, `weight 600`, `--shadow-xs`, `border 1px`** | `.v3-btn` → `pad 0 16px`, `700`, `--shadow-brand`, `border 0` | ❌ **unresolved — shared** |

Tokens added to `ui/v3/styles/theme.css` to close real gaps (all present in the design system, all previously absent): `--info`/`--info-surface` + the `--blue-*` ramp, `--shadow-xl`, `--ring-focus`, `--radius-xs`/`--radius-2xl`, `--surface-brand`, `--green-500`/`--amber-500`/`--red-500`, the `--text-*`/`--ls-*`/`--lh-*` type scale, `--control-*`, and `--ease-*`/`--dur-*`. Plus the DS `base.css` rules `box-sizing: border-box` and `:focus-visible { outline: 3px solid var(--ring-focus); outline-offset: 2px }`.

Design values with no equivalent in our design system: **none** — every value the design uses maps to a DS token; the gaps were tokens missing from `theme.css`, now added rather than hardcoded.

### States verified

| State | Verified | Notes |
|---|---|---|
| Default / empty | ✅ | Placeholders ("Select a region…", "Select a region first"), empty summary values read "Not selected", Proceed disabled. |
| Filled | ✅ | Full computed-style diff above taken in this state; live summary + 6 stat tiles confirmed. |
| Hover | ✅ | Design's five `style-hover` behaviours were **absent** (inline styles cannot express `:hover`); added as `.v3-authcard` / `.v3-iconbtn` / `.v3-rowremove` / `.v3-addrow` / `.v3-modalclose`, with the hoverable properties moved out of inline styles so the cascade actually reaches them. Auth-card hover scoped to `[aria-checked='false']` so it can't fight the selected border. Login-modal close intentionally has **no** hover (the design gives it none). |
| Focus (keyboard) | ✅ | A real `Tab` keypress yields `:focus-visible`; field shows `--brand-strong` border + `oklch(… / .45) 0 0 0 3px` ring. (Two earlier "no ring" readings were a throttled-pane artifact — the 120ms transition never advanced while the pane was hidden; confirmed by disabling the transition.) |
| Active / pressed | ✅ | `.v3-btn:active` translate; auth cards respond to Space/Enter. |
| Selected | ✅ | Both method cards: `--brand-strong` border, `--brand-subtle` fill, filled 9px dot, `aria-checked` flips. |
| Disabled (+ reason copy) | ✅ | Proceed disabled → `--violet-200`, no shadow; "Prepare the source first to continue." shown only while the source is not ready. Create stack disabled until a non-blank name. |
| Loading | ✅ (code-verified) | "Reading stack contents…" spinner, "Creating…", "Signing in…". Implemented and unit-covered; not separately screenshotted. |
| Error / validation | ✅ | `role="alert"` blocks in both modals and the panel, `--danger`/`--danger-surface`; collision messages surface the server's text verbatim (TC_DEST_014 / TC_DEST_028). |
| Responsive — 1440 / 768 / 375 | ⚠️ partial | 1440 and 768: zero overflow, matches the reference exactly (768 previously overflowed 7px — the `box-sizing` fix). 375: the sidebar correctly wraps below and the document does not scroll, but the form column's `min-width: 340px` (taken verbatim from the design) clips ~18px inside the card. **The design has no mobile layout to match** — its prototype scales a fixed 1204px canvas and will not reflow below ~676px. Flagged rather than invented. |
| Theme — light / dark | N/A | The design system is explicitly light-only (`colors.css`: "Light theme only for now"); the app ships no dark mode. |

- [x] All copy matches the design verbatim — method-card labels and descriptions, "Management token name *" + its placeholder and hint, the apps warning, "Locked"/"Master", the master-locale helper sentence, the cross-region banner, "Proceed to content mapping", "Prepare the source first to continue.", the empty-stack sentence, both modals' eyebrow/title/body/buttons, and all six stat-tile labels. The summary's stack row is left reading **"New stack"** verbatim even though an existing stack can now be chosen — changing it is an open design question (Q-14 / PQ-7), so it was not silently reworded.
- [x] Suite re-run after every markup/CSS change — `ui` 542/542, `api` 810/810, no Phase 2 regression.

### Unresolved visual differences

| Region | Difference | Why unresolved |
|---|---|---|
| Every field label | `13px/700` vs design `14px/600` | `.v3-label` is a **shared** primitive in `ui/v3/styles/theme.css`, also used by the already-shipped `cs-source-selection` panel. Fixing it changes that panel's rendering, so it needs the Source owner's review — the skill's non-goals forbid unilaterally changing shared config. One repo-wide fix serves both features. |
| Every Select / Input | `fontSize 13.5px / paddingRight 34px` vs design `14px / 38px` | Same shared class: `.v3-field`. |
| Primary / secondary buttons | `pad 0 16px`, `weight 700`, `--shadow-brand` vs design `pad 0 18px`, `weight 600`, `--shadow-xs`, `1px` border | Same shared class: `.v3-btn`. The design's DS `Button` is flatter (shadow-xs) than our brand-glow variant. |
| Form column at ≤ ~420px | ~18px clipped inside the card | No mobile design exists to match (see Responsive above). Resolving it means choosing a breakpoint, which is a product/design decision — NFR-5/Q-10 currently covers only the browser matrix, not breakpoints. |

All four are *explained*, not "close enough": three are one shared-primitive fix away, gated on a sibling feature's owner; the fourth is an upstream design gap.

---

## Gaps found in upstream docs — reported, not fixed

**Backward traceability** — every automatable `AC-*`/`EC-*` in `feature.md` has a matrix row. Verified by script: 30/30 ACs and 13/14 ECs are referenced by the matrix; the absent one is **EC-11, which is explicitly RETIRED**. **No backward gaps.**

**Other findings:**

- **There is no `orgId` anywhere in the v3 route, but the destination's read/persist endpoints are org-scoped.** trd.md API-1/API-2 use `/v3/org/:orgId/project/:projectId/destination` (mirroring Source), yet the v3 route is `projects/:projectId/migration/steps/:stepId` and `ui/v3/pages/Projects` is still an explicit placeholder with no org concept. I plumbed it through as a `?orgId=` query param and documented it in `Migration/index.tsx` as a stopgap. **Consequence while unresolved: without that param the panel skips its mount-time reads, so resume (UC-5/AC-5.1) and the source-readiness gate (FR-6.1) never load in the running app and Proceed stays disabled** — the unit tests pass because they invoke the thunks directly. It skips rather than issuing a request that would 404 on the empty path segment. Needs either a real org from the projects UI, or project-scoped read endpoints. Note Source has the same org-scoped shape for its own persisted-source read, so this is likely a shared v3 scaffold decision rather than a Destination-only fix.
- **No source of destination-locale options is specified.** FR-4.1/FR-4.2 require destination-locale dropdowns, but the TRD defines no endpoint for them (API-1…API-5 have none) and DEP-1 only promises the *source's* locale list. I added `GET /v3/destination/locales` (+ `csManagement.listLocales`) as the minimum to make the dropdowns functional, but **this endpoint is not in the TRD and should be ratified** — or replaced, if locales are meant to come from the source document instead.
- **NFR-6 (observability) has no implementation and no automatable test.** trd.md §11 specifies `v3_destination_*` counters and destination-configured / proceed-blocked / management-token-created logs. None were added (TC_DEST_058 is `Automated = N`, and no logging utility is named). Genuinely unbuilt, not merely untested.
- **Q-16 ("Locales mapped" formula) is still open**, so `DestinationSummary` mirrors the design's `additional + 1` and TC_DEST_045 asserts only that the value *changes*, not what it equals. If Q-16 resolves differently, both need updating.
- **Q-17 (does an unset master-locale/branch destination block Proceed?) is still open.** `canProceed` implements FR-6.1's literal text — Region/Org/Stack/import-auth only. If Q-17 resolves to "yes, these gate too", `canProceed` and TC_DEST_041–044 both change.
- **EC-1's empty-organization copy is not in the design.** The design has no empty state for that dropdown; I used **"No organizations found"**. Needs design sign-off (relates to PQ-5's copy standard).
- **EC-14's stats-failure fallback is undecided (Q-18).** `loadDestStackStats` clears the card on failure rather than inventing an error state. Deliberate; revisit when Q-18 lands.
- **Design-vs-spec conflict, unchanged:** the design's "After you proceed" card lists **Audit** as the next step, contradicting the real Source → Audit → Destination order. Rendered verbatim per the design; already tracked as Q-2 / PQ-4 / R-4.
- **Design-system drift in the shipped Source panel.** `.v3-label`, `.v3-field` and `.v3-btn` differ from the DS components the design actually uses (details in "Unresolved visual differences"). This is a pre-existing deviation in `cs-source-selection`, surfaced here because both features share the primitives.

## Config or convention notes for the team

- **`v3/**` is excluded from coverage in both packages.** `coverage.include` is `src/**` in `ui/vitest.config.ts:14` and `api/vitest.config.ts:11`, so neither this feature nor `cs-source-selection` appears in coverage numbers, and the configured thresholds do not police them. Worth a deliberate decision; not changed here.
- **Shared v3 primitives need an owner.** `theme.css` is now consumed by two features. The three unresolved diffs are a single coordinated edit — best done once, with both owners, rather than per-feature overrides that would make the two panels look different side by side.
- **`.v3-scope` was relying on an inherited `box-sizing` reset from the v2 app.** Now set explicitly, which matters for a tree that claims to be standalone (FR-8.1). Worth checking whether other v3 styling makes similar implicit assumptions.
- **The test suites require Node 24, and nothing in the repo says so.** Both packages fail at *startup* on Node 21.7.3 (this machine's nvm default) with errors inside tooling, not test code: `ui` → `ERR_REQUIRE_ESM` requiring `std-env@4` (ESM-only) from `vitest/dist/config.cjs`; `api` → `ERR_INVALID_ARG_VALUE` from `rolldown` calling `util.styleText(['underline','gray'])`, which only accepts an array on Node 22+. Both pass on Node 24.12.0. There is no `engines` field and no `.nvmrc` in the root, `ui/`, or `api/` — so this is silent and easy to mistake for broken code (it cost time during this run). Worth adding an `.nvmrc` / `engines` constraint.
- **The Snyk gate was waived by the user**, not satisfied. Run it before this merges.

## Next step

Playwright/e2e verification is the remaining stage in the pipeline — not covered by this skill.
