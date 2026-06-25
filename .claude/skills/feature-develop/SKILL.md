---
name: feature-develop
description: Stage 4 (final) of the migration-v2 feature flow. Use to implement a feature once its TRD and Jira tickets exist: routes a brand-new source CMS into add-cms-connector and a single field-mapping change into add-connector-field (pre-filling their inputs from the artifacts), and implements directly across the four layers for anything else. Reads docs/features/<slug>/trd.md + jira.md.
---

# Feature development (stage 4)

Implement a feature from its already-written TRD + Jira tickets — by routing to the right connector skill, or implementing directly across the four layers.

## Flow contract

This skill is one stage of the **migration-v2 feature flow**:

`use case → PRD / TRD → Jira → development`

All stages share a single per-feature folder, and the Markdown there is the source of truth:

```
docs/features/<feature-slug>/
├── use-case.md     (stage 1 · feature-use-case)
├── prd.md          (stage 2 · feature-prd-trd)
├── trd.md          (stage 2 · feature-prd-trd)
└── jira.md         (stage 3 · feature-jira)
```

`<feature-slug>` is a short kebab-case id (e.g. `sanity-connector`, `aem-anchor-links`).
Each stage reads the prior stage's file(s) and writes its own. If a file you need is
missing, **stop and offer to run the earlier stage** — never fabricate the upstream artifact.

**This stage** reads: `trd.md` + `jira.md` · writes: code across the four layers · next: _(end of flow)_.

## Inputs you need from the user

1. **`<feature-slug>`** — the kebab-case id that locates `docs/features/<feature-slug>/trd.md` + `jira.md`. If the conversation already implies it, confirm it; otherwise ask.

If either `trd.md` or `jira.md` is missing, **STOP** — do not implement from memory. Offer to run the earlier stage (`feature-prd-trd` for the TRD, `feature-jira` for the tickets) first.

## Workflow

### Step 0 — Read the artifacts, build the work list
Read `docs/features/<feature-slug>/trd.md` and `docs/features/<feature-slug>/jira.md`. From the Jira tickets, build an **ordered work list** — one item per ticket, each carrying its acceptance criteria. The TRD is the design oracle (architecture, field maps, edge cases); the tickets are the unit of work and the definition of done. Track the list as tasks so progress and any skipped work stay visible.

### Step 1 — Routing decision
Decide HOW to implement before touching code. Read `reference/routing.md` for the full decision tree and the exact inputs to extract per route:

- **Brand-new source CMS** (no connector exists yet) → **invoke the `add-cms-connector` skill**, pre-filled from the artifacts: CMS name (three case forms) + the sample export path. Do not re-scaffold by hand.
- **A single field-type mapping change** in an existing connector → **invoke the `add-connector-field` skill**, pre-filled: connector name + target Contentstack type + a sample field value.
- **Anything else** (a multi-layer change to an existing connector — new entry logic, a transform fix, UI tweaks spanning layers) → **implement directly**, reusing the `add-cms-connector` skill's reference docs as the map (all under `.claude/skills/add-cms-connector/reference/`): `touchpoints.md` (exact files + anchors), `entry-creation.md` (the `createEntry` contract), `upload-flow.md` (upload-kind → validator/parser shapes).

When routing, pre-fill the target skill's inputs from the artifacts so it does not re-ask — see `reference/routing.md` for which TRD/Jira fields map to which input.

### Step 2 — Execute per ticket
Work the list in order. For each ticket, make the change, then **tick its acceptance criteria** as you satisfy them. For the routed cases, the invoked skill does the layer work; for the direct case, edit the four layers per `add-cms-connector`'s `reference/touchpoints.md`:
- Layer A — parser package `upload-api/migration-<cms>/` (`libs/contentTypes.ts`, `libs/schemaMapper.ts`, `libs/extractLocale.ts`).
- Layer B — upload-api wiring (`src/services/createMapper.ts` switch, `src/validators/index.ts` switch, `src/controllers/<cms>/`, `src/validators/<cms>/`, `package.json` `file:` dep).
- Layer C — api transform (`api/src/services/<cms>.service.ts` — `createEntry`/`createLocale`/`createVersionFile`, `mapFieldTypeToDataType`; `api/src/constants/index.ts` CMS enum; `api/src/services/migration.service.ts` — **TWO** switches, test + full).
- Layer D — ui registration (`ui/src/cmsData/legacyCms.json` `all_cms` entry; `ui/src/utilities/constants.ts` optional doc url).

### Step 3 — Verify
Reuse the existing checklists (the connector skills' verification, summarised in `reference/routing.md`). At minimum:
- build the parser package (`npm run build` in `upload-api/migration-<cms>`),
- `npx tsc --noEmit` on `upload-api` + `api` (judge by **no NEW errors in YOUR files** — both have pre-existing errors),
- ui typecheck (`npx tsc --noEmit` in `ui`; `legacyCms.json` parses),
- the 2-switch guard: `grep -n "case CMS.<CMS>" api/src/services/migration.service.ts` must return **2 matches** (test + full migration). One match = the full-migration switch was forgotten and the connector silently no-ops.

### Step 4 — Summarise
Summarise the work **against each ticket** — what was implemented, which acceptance criteria are met, what was deferred or out of scope — and list follow-ups. Do **NOT** commit unless the user explicitly asks.

## Conventions to preserve
- Do **not** commit without being asked.
- Keep the intentionally-misspelled `createRefrence` — it is the real method name; match it where used.
- Both `migration.service.ts` switches (test + full) must be updated for any connector change — the grep guard catches a missing second case.
