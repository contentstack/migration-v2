---
name: feature-jira
description: Stage 3 of the migration-v2 feature flow. Use after PRD/TRD exist to break the work into a Jira epic and stories mapped to the four connector layers, then optionally create them in Jira via the Atlassian MCP (selecting the target epic). Reads docs/features/<slug>/prd.md + trd.md; writes jira.md; hands off to feature-develop.
---

# Feature Jira tickets (stage 3)

Turn an approved PRD/TRD into a Jira epic plus stories mapped to the four connector layers, then optionally push them into Jira.

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

**This stage** reads: `prd.md` + `trd.md` · writes: `jira.md` · next: `feature-develop`.

## Inputs you need from the user

1. **`<feature-slug>`** — the kebab-case feature id, used to locate `docs/features/<slug>/prd.md` + `trd.md`.

If `docs/features/<slug>/prd.md` or `trd.md` is missing, **STOP** — do not fabricate them. Offer to run `feature-prd-trd` first, then resume here.

## Workflow

### Step 0 — Read the upstream artifacts
Read `docs/features/<slug>/prd.md` and `docs/features/<slug>/trd.md` in full. The TRD's per-layer change list is the raw material for the story breakdown — do not re-derive the design, decompose what the TRD already specifies.

### Step 1 — Decompose into ONE epic + stories
Create **one epic** for the feature, then split the work into stories that follow the four connector layers naturally — one story per **touched** layer, plus a testing/verification story. Skip a layer that the TRD does not touch; do not invent work to fill it. The layers (reference by concrete path):

- **Layer A — parser package:** `upload-api/migration-<cms>/` (`libs/contentTypes.ts`, `libs/schemaMapper.ts`, `libs/extractLocale.ts`).
- **Layer B — upload-api wiring:** `upload-api/src/services/createMapper.ts` (switch), `upload-api/src/validators/index.ts` (switch), `upload-api/src/controllers/<cms>/`, `upload-api/src/validators/<cms>/`, `upload-api/package.json` (`file:` dep).
- **Layer C — api transform:** `api/src/services/<cms>.service.ts` (`createEntry`/`createLocale`/`createVersionFile`, `mapFieldTypeToDataType`), `api/src/constants/index.ts` (CMS enum), `api/src/services/migration.service.ts` (TWO switches — test + full; forgetting the 2nd silently no-ops).
- **Layer D — ui registration:** `ui/src/cmsData/legacyCms.json` (`all_cms` entry), `ui/src/utilities/constants.ts` (optional doc url).
- **Verification story** — the cross-layer smoke + build checks (parser build, both `migration.service` switches present, end-to-end migration of the sample).

Each story carries: a **summary**, a **description**, **acceptance criteria** (checkbox list), a **layer label** (A/B/C/D or Verification), **dependency notes** (e.g. C depends on A; the verification story depends on all), and an **estimate placeholder** (leave `TBD` for the user to fill).

### Step 2 — Write `jira.md`
Write `docs/features/<slug>/jira.md` from `templates/jira-tickets.md`: the epic block, the stories summary table, and one detail block per story. Fill the placeholders; keep the `## Created issues` section empty until a push happens.

### Step 3 — Review with the user
Present the epic + story breakdown for review. Adjust scope, splits, dependencies, and estimates until the user signs off. Local Markdown stays the source of truth.

### Step 4 — OFFER a Jira push
After sign-off, **offer** (do not assume) to create these in Jira, following `reference/jira-push.md` and the MCP policy below: list projects + existing epics, let the user **SELECT** the target epic (or create a new one), create the stories under it, then append the returned issue keys + URLs back into `jira.md`'s `## Created issues` section.

## Output

`docs/features/<slug>/jira.md` — the epic + stories (and, after a push, the created issue keys/URLs).

## MCP policy — Atlassian (Confluence & Jira)

Reading private Confluence/Jira content and creating pages/issues both go through the
**Atlassian MCP**. This is a hard guardrail — follow it exactly, and never let
accept-edits or auto mode skip a step:

1. **Confirm before every MCP operation.** Before connecting, before reading private
   content, and before creating or publishing anything, stop and ask the user
   — "OK to {connect / read / create} {what}?" — and wait for an explicit yes. Do not
   rely on permission auto-accept.
2. **Setup (one-time OAuth) — drive it here; never punt to the `/mcp` menu.** Run
   `ToolSearch` for the tool you need (a Confluence/Jira search, create-page, or
   create-issue tool). If the only Atlassian tools available are
   `mcp__claude_ai_Atlassian__authenticate` /
   `mcp__claude_ai_Atlassian__complete_authentication`, the MCP is not connected yet —
   set it up yourself, in this conversation: call `authenticate`, hand the user the
   authorization URL it returns, and the moment they authorize in the browser finish the
   handshake (call `complete_authentication` with the `http://localhost:.../callback?...`
   URL if one is produced, or just re-run `ToolSearch` if the real tools auto-appear). The
   user's only manual action is clicking **Authorize** in the browser — do NOT tell them to
   open the `/mcp` menu or hand-configure the server. Then re-run `ToolSearch` to load the
   real tools.
3. **Select the destination — never guess it.** List real destinations through the MCP
   and let the user choose (Confluence space / folder / parent page; Jira project +
   epic). Offer to create a new epic if none fits.
4. **Local Markdown stays the source of truth.** Always draft locally first and push
   only after the user reviews. After a successful push, write the Confluence page URL /
   Jira issue keys back into the local Markdown.
