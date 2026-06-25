# Jira push runbook

The MCP policy (SKILL.md `## MCP policy`) in practice for creating the epic + stories. Tool names are discovered at runtime via `ToolSearch` — **do not hard-code them** (they drift).

### 1 — Confirm
Ask the user "OK to create the epic + stories in Jira?" and wait for an explicit yes. Never push on auto-accept.

### 2 — Find the Jira tools
`ToolSearch` for the Jira create-issue, issue-search, and project/epic-list tools. Inspect each returned schema before calling.

### 3 — OAuth (only if needed)
**Drive it yourself — the user's only manual action is clicking Authorize in the browser; never punt to the `/mcp` menu.**
If the only Atlassian tools available are `mcp__claude_ai_Atlassian__authenticate` / `mcp__claude_ai_Atlassian__complete_authentication`, the MCP is not connected:
- ask the user, call `authenticate`, share the auth URL,
- wait for them to paste back the `http://localhost:.../callback?...` URL,
- call `complete_authentication` with it,
- then re-run `ToolSearch` to load the real create/search tools.

### 4 — Select the destination
**Recorded default project** (default here and confirm — don't make the user re-pick the project): **TSO - Content Migrations v2**, key `CMG` (same `CMG` as the Confluence space — it's the migration-v2 project). Switch projects only if the user asks.

List the **existing epics** in `CMG` (via the discovered search tool) and let the user SELECT:
- an existing epic to file the stories under, **or**
- "create a new epic" — then create it from `jira.md`'s `## Epic` block (summary, description) and use its returned key as the parent.

Never guess the project or epic.

### 5 — Create the issues
- If a new epic was chosen, create it first; capture its key.
- Create each story (rows of the `jira.md` stories table) under the epic — set the parent/epic-link field per the create-issue tool's schema. Carry over summary, description, and acceptance criteria from the per-story detail block.
- Drop any story the user deselected during review.

### 6 — Write the keys back
After each successful create, append `Key | URL` rows to `jira.md`'s `## Created issues` table (epic first, then stories) and fill the `Key` column of the `## Stories` table. Local Markdown stays the source of truth.

### Notes
- Confirm again before any create call — connect, then create, are separate gates.
- If a create fails, report the raw error and stop; do not retry blindly or fabricate a key.
