# Ingesting references

Read each reference by its type. Do not guess at content you have not actually opened.

## By type

- **Public URL** (blog, public docs, GitHub) → `WebFetch` the URL. Extract the facts relevant to the feature; ignore the rest.
- **Local file path** → `Read` the file (absolute path). For an archive/export the user points at, read the data file inside it, not just the wrapper.
- **Pasted text** → use it directly as a source; no fetch needed. Treat it as authoritative for what the user pasted.
- **Private Confluence / Jira / Drive URL** → you **cannot** `WebFetch` these (they require auth and return a login wall). Read them through the **Atlassian MCP** per the MCP policy in `SKILL.md`:
  1. **Confirm** with the user that it's OK to connect / read.
  2. **Setup** if needed — if only `mcp__claude_ai_Atlassian__authenticate` / `…__complete_authentication` are available, the MCP isn't connected: run `authenticate`, share the URL, wait for the pasted `callback?...` URL, call `complete_authentication`, then re-run `ToolSearch` to load the real search/read tools. You drive this — the user only clicks **Authorize**; never send them to the `/mcp` menu.
  3. **Read** the page/issue via the loaded MCP tool.
  - A Google Drive link is the same shape — there is a Drive MCP; confirm → setup → read. Never paste a private URL into `WebFetch`.

## One-pass recon recipe

Do all recon in a **single batch** — don't trickle one command at a time. For a CMS-export-shaped reference, one pass answers everything the brief needs:

1. **Export structure** — list the archive/export contents (e.g. `tar -tzf <file> | head`); extract to a scratch dir if you must look inside. Identify the shape (NDJSON dataset, XML, SQL dump, folder tree, …).
2. **Record-type histogram** — count the document/record types so scope is concrete, e.g. for NDJSON: `grep -o '"_type":"[^"]*"' data.ndjson | sort | uniq -c | sort -rn`. This tells you the content types and which are system/internal.
3. **Repo survey (all four layers at once)** — does a connector already exist, and what's wired?
   - Layer A: `ls upload-api/migration-<cms>/` (and whether it has source files).
   - Layer B: `grep -i <cms> upload-api/src/services/createMapper.ts upload-api/src/validators/index.ts`.
   - Layer C: `ls api/src/services/<cms>*`; `grep -i <cms> api/src/constants/index.ts`; and the two `migration.service.ts` switches.
   - Layer D: `grep -i <cms> ui/src/cmsData/legacyCms.json`.

Run these together, read the compact output, and you have the references **and** the affected-layers picture in one round — no exploratory back-and-forth, and nothing big dumped into context.

## How to cite sources

Every fact in `use-case.md` must trace to a row in the **References** table. When you write the brief:
- Add one row per source: `Source | Type | Link/Path | What it tells us`.
- In Current behaviour / Desired behaviour / Scope, lean on facts you can point back to a row — do not assert anything you did not read.
- If a claim has no source, either get one (ask the user / read a ref) or move it to **Open questions** rather than stating it as fact.
