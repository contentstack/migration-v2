---
name: feature-prd-trd
description: Stage 2 of the migration-v2 feature flow. Use after a use-case brief exists to produce a Confluence-ready PRD and a TRD grounded in the connector four-layer architecture, then optionally push the page(s) to Confluence via the Atlassian MCP (selecting the target space/folder). Reads docs/features/<slug>/use-case.md; writes prd.md + trd.md; hands off to feature-jira.
---

# Feature PRD / TRD (stage 2)

Turn a confirmed use-case brief into a Confluence-ready PRD and a TRD grounded in the migration-v2 connector four-layer architecture, then optionally push to Confluence.

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

**This stage** reads: `use-case.md` · writes: `prd.md` + `trd.md` · next: `feature-jira`.

## Inputs you need from the user

1. **`<feature-slug>`** — the short kebab-case id that locates `docs/features/<feature-slug>/use-case.md`.
   If the conversation already implies a slug, confirm it; otherwise ask.

If `docs/features/<feature-slug>/use-case.md` is **absent**, STOP — do not invent the brief.
Offer to run **feature-use-case** (stage 1) first, then resume here once it exists.

## Workflow

### Step 0 — Locate and read the use-case brief
Read `docs/features/<feature-slug>/use-case.md`. It is the source of truth for the problem,
the target connector(s), and the scope. If the file does not exist, STOP and offer to run
**feature-use-case** (stage 1) — never fabricate the upstream artifact. Pull the feature
name, the affected connector(s), and the in/out-of-scope notes from the brief into the drafts.

### Step 1 — Write the PRD
Copy `templates/prd.md` to `docs/features/<feature-slug>/prd.md` and fill it from the brief:
**overview**, **goals / non-goals**, **user stories** (As a … I want … so that …),
**functional requirements** (numbered `FR-1…`), **non-functional requirements**,
**success metrics**, and **risks & mitigations**. Keep the `## Links` Confluence URL blank
until a push happens (Step 4). The PRD is the *what/why* — no implementation detail here.

### Step 2 — Write the TRD (grounded in the four layers)
Copy `templates/trd.md` to `docs/features/<feature-slug>/trd.md`. The TRD is the *how*, and it
is only useful if it names the **concrete files** the dev stage will edit. The migration-v2
connector spans **four layers** — fill the architecture-impact table with the real paths that
change for this feature:

- **Layer A — parser package** `upload-api/migration-<cms>/` — `libs/contentTypes.ts`,
  `libs/schemaMapper.ts`, `libs/extractLocale.ts`.
- **Layer B — upload-api wiring** — `upload-api/src/services/createMapper.ts` (switch),
  `upload-api/src/validators/index.ts` (switch), `upload-api/src/controllers/<cms>/`,
  `upload-api/src/validators/<cms>/`, `upload-api/package.json` (the `file:` dep).
- **Layer C — api transform** — `api/src/services/<cms>.service.ts`
  (`createEntry` / `createLocale` / `createVersionFile`, `mapFieldTypeToDataType`),
  `api/src/constants/index.ts` (the `CMS` enum), `api/src/services/migration.service.ts`
  (**TWO switches** — test + full; forgetting the 2nd silently no-ops in full migration).
- **Layer D — ui registration** — `ui/src/cmsData/legacyCms.json` (the `all_cms` entry),
  `ui/src/utilities/constants.ts` (optional doc url).

Also fill the **data & field-type mapping** (source type → Contentstack type →
`mapFieldTypeToDataType` data type), the **entry-creation considerations** (references,
nested groups, modular blocks, assets), the **upload / validation flow**, and the
**test & verification plan**. Only list layers/files this feature actually touches — a
single-field change touches far fewer than a brand-new connector.

### Step 3 — Review the drafts with the user
Present both drafts and get sign-off. Fix anything wrong before any push. Keep editing the
local Markdown — it stays the source of truth.

### Step 4 — Offer a Confluence push (optional)
After the user is happy with the drafts, OFFER to push the page(s) to Confluence following
`reference/confluence-push.md` and the **MCP policy** below. In short: confirm → `ToolSearch`
for a Confluence create-page tool → run OAuth setup if only the authenticate tools exist →
**list real spaces/folders and let the user SELECT** the target folder / parent page → create
the page from `prd.md` / `trd.md` → write the returned page URL back into the draft's
`## Links` section. Never guess the destination.

### Step 5 — Render the human-facing view (standard)
The Markdown is the source of truth, but the **Artifact is the view people actually read** for the PRD/TRD — so **by default** render them as a polished web page: load the `artifact-design` skill, build a self-contained HTML page **from the current `prd.md` + `trd.md`** (faithful to every section; render the four-layer architecture-impact table and the field-type mapping clearly), publish it with the `Artifact` tool, and share the link. It's a **private** claude.ai page (the user chooses whether to share) — separate from the Confluence push (Step 4), which stays opt-in. Re-render from the `.md` on changes. Skip only if the user declines.

## Output

- `docs/features/<feature-slug>/prd.md`
- `docs/features/<feature-slug>/trd.md`

(With the Confluence URL recorded into each `## Links` section if a push happened.)

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
