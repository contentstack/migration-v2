# Confluence push — runbook

Pushing `prd.md` / `trd.md` to Confluence runs through the **Atlassian MCP**. Follow the MCP
policy in `SKILL.md` exactly. Exact tool names are **discovered at runtime via `ToolSearch`** —
do NOT hard-code them; they vary by MCP build.

## Step 1 — Confirm
Ask the user: "OK to push the PRD / TRD to Confluence?" Wait for an explicit yes. Confirm which
file(s) to push (PRD only, TRD only, or both). Never push on auto-accept.

## Step 2 — Find the tool
Run `ToolSearch` for a Confluence **create-page** (and a **search/list-spaces**) tool, e.g.
`ToolSearch query="confluence create page space"`. Two outcomes:

- **Real tools returned** — load their schemas and continue to Step 4.
- **Only `mcp__claude_ai_Atlassian__authenticate` / `…__complete_authentication` returned** —
  the MCP is not connected. Go to Step 3 first.

## Step 3 — OAuth setup (only if not connected)
**You drive this end-to-end — the user's only manual action is clicking Authorize in the browser. Never tell them to open the `/mcp` menu or hand-configure the server.**
1. Ask the user for the OK to connect.
2. Call `mcp__claude_ai_Atlassian__authenticate`; share the returned auth URL.
3. Wait for the user to paste back the `http://localhost:.../callback?...` URL.
4. Call `mcp__claude_ai_Atlassian__complete_authentication` with it.
5. Re-run the `ToolSearch` from Step 2 to load the real Confluence tools.

## Step 4 — Select the destination (never guess)
Use the discovered search/list tool to list real **spaces**, then **folders / parent pages**
within the chosen space. Present them and let the user **SELECT** the target folder / parent
page. Offer to create a new page under a parent if nothing fits.

**Recorded default for this project** (default here and confirm — don't silently assume, and don't make the user re-pick every time):
- Space: **Content Migrations** — key `CMG`, id `2225078512`
- Parent: **"Content Migrations Home"**, id `2225078673`
- Structure: create a parent page named after the feature (e.g. "Sanity connector"), with the **PRD** and **TRD** as **child pages** under it.

Browse/select a different destination only if the user asks.

## Step 5 — Create the page
Read the local `prd.md` / `trd.md` content and create the page(s) under the selected
parent via the discovered create-page tool. Use the document `# <Feature> — PRD` / `— TRD`
heading as the page title. Confirm success and capture the **returned page URL**.

## Step 6 — Record the URL back
Edit the local draft's `## Links` section, replacing the
`Confluence: <filled after push — Step 4>` line with the returned page URL. The local Markdown
stays the source of truth; the URL is the back-reference. Do this for each page pushed.

## Notes
- Confirm before **every** MCP operation (connect, read, create) — not just the first.
- If a push fails, report it straight; leave the `## Links` placeholder untouched.
- For Jira issue creation, that is stage 3 (`feature-jira`) — not this skill.
