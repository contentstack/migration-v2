---
name: feature-use-case
description: Stage 1 of the migration-v2 feature flow. Start here when a user has a new feature idea or request for the migration tool and wants to carry it through to code. Gathers the idea plus its reference material (doc URLs, files, pasted text — private Confluence/Jira read via the Atlassian MCP) and writes a structured use-case brief to docs/features/<slug>/use-case.md. Hand off to feature-prd-trd next. To implement an already-specced feature use feature-develop instead.
---

# Feature use-case (stage 1)

Stage 1 of 4 of the migration-v2 feature flow (`use case → PRD / TRD → Jira → development`). This skill turns a raw feature idea plus its reference material into a structured use-case brief that the rest of the flow builds on.

## Be confident and fast (read this first)

The use-case stage is quick and decisive — but it **does ask** the user the few scoping calls that matter. The shape is **understand fast, then ask once**: don't dawdle getting to the question, and don't skip the question.

- **Gather inputs in one message.** Idea (+ any refs) in a single exchange; auto-derive the slug; never re-ask what you were given.
- **Recon in one pass.** Ingest every reference and ground in the repo together (batch the tool calls) — don't trickle out one command at a time or stall.
- **Then ask once — after understanding.** With recon done, ask the key scoping decisions as a **single batched `AskUserQuestion`** (driver, doc scope, assets, locales, …). Make the options concrete from what recon found, and put the sensible **default first, marked `(Recommended)`**. One question screen — not a drip of follow-ups, and not a quiz before you've understood anything.
- **Draft immediately from the answers.** Record the chosen calls in *Assumptions & decisions*; push genuine unknowns the question didn't resolve to *Open questions*.

The bar: **one recon pass → one well-formed question screen → a complete draft.** Confident and quick — but the scoping calls are the user's to make.

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

**This stage** reads: _(none — you start the flow)_ · writes: `use-case.md` · next: `feature-prd-trd`.

## Inputs you need from the user

Ask **once**, up front, in a single message — then proceed. Only the idea is required.

1. **One-line feature idea** *(required)* — what the feature is, in a sentence. This is the one thing you can't infer; if it's missing, ask for it.
2. **References** *(encouraged, optional)* — doc URLs, local file paths, or pasted text. Public URLs, local files, and pasted text are read directly; private Confluence/Jira/Drive links go through the Atlassian MCP (see the MCP policy below). If the user gives none, ground on the repo and note it — don't stall.
3. **`<feature-slug>`** *(auto)* — **derive it yourself** from the idea (kebab-case, e.g. "add a Sanity connector" → `sanity-connector`), state the slug you picked, and proceed. Only pause if it collides with an existing `docs/features/<slug>/`.

Inputs-first still holds — get the idea (and grab any refs the user already has) before researching — but gather it in **one** exchange and never re-ask what you were already given.

## Workflow

### Step 0 — Gather inputs (one message)
Ask for the **idea** and any **references** in a single message, **derive the `<feature-slug>`** yourself, and state it. Proceed once you have the idea — don't block on refs or on a user-supplied slug. Only pause if the slug collides with an existing `docs/features/<slug>/`.

### Step 1 — One recon pass
Ingest **every** reference **and** ground in the repo in **one batch** — don't iterate. See `reference/reading-refs.md` for the per-type how-to and the **one-pass recon recipe**.
- Ingest refs: **public URL** → `WebFetch`; **local file/archive** → `Read` (read the data inside an archive, not just the wrapper); **pasted text** → use as-is; **private Confluence/Jira/Drive** → MCP policy (confirm → setup → read). Note what each source tells you, for the References table.
- Ground in the repo: identify the **affected connector(s)** and which of the four layers a change touches (don't design it — just flag them concretely):
  - **Layer A — parser package:** `upload-api/migration-<cms>/` (`libs/contentTypes.ts`, `libs/schemaMapper.ts`, `libs/extractLocale.ts`).
  - **Layer B — upload-api wiring:** `upload-api/src/services/createMapper.ts` (switch), `upload-api/src/validators/index.ts` (switch), `upload-api/src/controllers/<cms>/`, `upload-api/src/validators/<cms>/`, `upload-api/package.json` (`file:` dep).
  - **Layer C — api transform:** `api/src/services/<cms>.service.ts` (`createEntry`/`createLocale`/`createVersionFile`, `mapFieldTypeToDataType`), `api/src/constants/index.ts` (CMS enum), `api/src/services/migration.service.ts` (TWO switches — test + full; forgetting the 2nd silently no-ops).
  - **Layer D — ui registration:** `ui/src/cmsData/legacyCms.json` (`all_cms` entry), `ui/src/utilities/constants.ts` (optional doc url).

### Step 2 — Ask the scoping calls (one batched question, after understanding)
Now that recon is done, ask the user the decisions the export/repo can't settle — as **one** `AskUserQuestion` carrying multiple questions, not a drip of follow-ups. Typical set (add/drop to fit the feature):
- **Driver / stakeholder** — what's pushing this and who's the primary user.
- **Document / record scope** — which source types to migrate.
- **Assets** — migrate binaries or not.
- **Locales** — single vs multi-locale.

Make every option **concrete from what recon found** — e.g. the doc-scope options name the actual types you saw and flag the system/internal records; the locale option states the sample's locale signal. Put the recommended choice (from **Default decisions** below) **first**, labelled `(Recommended)`. Genuine unknowns the question doesn't resolve go to *Open questions*, not into another round.

### Step 3 — Write the draft
Write `docs/features/<feature-slug>/use-case.md` from `templates/use-case.md`. Fill every section, including *Assumptions & decisions*. **Cite every reference source** — each fact must trace to a row in the References table; an unsourced claim goes to *Open questions*, not stated as fact. Record the affected layers (A/B/C/D) with the concrete files from Step 1.

### Step 4 — Summarise & hand off
Summarise the brief in chat (the key assumptions you made, scope, affected layers, open questions) and **invite corrections** — "tell me what to flip." Then point the user to **`feature-prd-trd`** to produce the PRD and TRD from this use case.

**Render the human-facing view (standard).** The Markdown is the source of truth, but the **Artifact is the view people actually read** — so **by default** render the brief as a polished web page: load the `artifact-design` skill, build a self-contained HTML page **from the current `use-case.md`** (every section faithful — Summary, References table, Assumptions & decisions, Scope, the affected-layers table, Open questions), publish it with the `Artifact` tool, and share the link. It's a **private** claude.ai page (the user chooses whether to share) — this is *not* a Confluence publish, which stays separate and opt-in. Re-render from the `.md` whenever it changes. Skip only if the user says they don't want it.

## Default decisions

These are the **recommended answers** for the Step 2 question — present each as the first option, labelled `(Recommended)`, so the user usually just confirms. Whatever they pick is recorded in the brief's *Assumptions & decisions* section.

| Question | Recommended default | Other options to offer |
|---|---|---|
| Document / record scope | All real content types; **exclude** source-CMS system/internal records | "include system docs" / a named subset |
| Assets / binaries | **Migrate** assets and resolve media fields to them | "references/text only" |
| Locales | **Single-locale** unless the sample shows i18n (state the sample's signal); flag multi-locale as an open question | "multi-locale required" |
| Export-shape variants | Support the form the sample is in (+ obvious siblings, e.g. archive ⇄ extracted folder) | other shapes the user names |
| Rich text | Map to Contentstack rich text (leave JSON-RTE vs HTML as a TRD decision) | — |

## Output

`docs/features/<feature-slug>/use-case.md`

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
