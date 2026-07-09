# Connecting the Snyk MCP (and the Atlassian fallback)

The **default, recommended source is a live Snyk MCP scan** (section A). The Atlassian /
Jira-ticket route (section B) is the **fallback** — for when the Snyk MCP can't be
connected, or when the user explicitly hands over a ticket. Both paths go through an MCP —
follow the same guardrail the `feature-jira` skill uses: **confirm before every MCP
operation**, never let auto-accept skip a step, and never guess a vulnerability you didn't
read from a tool.

## A. Snyk MCP (live-scan mode)

### Discover the tools
Run `ToolSearch` with query `snyk`. The Snyk MCP server exposes test/auth tools (names vary
by version — commonly an SCA/open-source test, a Code/SAST test, an auth/auth-status, and a
version tool). Use whatever `ToolSearch` returns; don't hardcode names.

### If no Snyk tools appear, it isn't connected
The Snyk MCP is the official `snyk mcp` server (ships with the Snyk CLI). It is NOT
something this skill can silently stand up — it needs the Snyk CLI installed and an
authenticated token on the user's machine. So:

1. **Tell the user** it's not connected and what's needed:
   - Snyk CLI installed (`npm i -g snyk` or the standalone binary).
   - Authenticated once: `snyk auth` (opens a browser).
   - The MCP server registered with Claude Code (the `snyk mcp -t stdio` command as an MCP
     server entry). Setting up a brand-new MCP server is a config change on their machine —
     hand them the command; don't fabricate it into settings yourself without asking.
2. **Confirm** before running any scan: "OK to run a Snyk SCA scan on `ui`/`api`/`upload-api`?"
3. Once tools are present, re-run `ToolSearch` to load them and proceed to enumerate.

### Running scans
- Scan **per project** (`ui`, `api`, `upload-api`) — each has its own lockfile, and Snyk
  reports per project. A repo-root scan can miss or mis-attribute findings.
- Capture for each finding: package, current version, fixed-in version, `isFixable`,
  severity, CVE/Snyk ID, and the project path.
- After fixing, **re-scan the same project** to prove the finding is gone.

## B. Atlassian MCP (ticket mode)

Reading a Snyk-generated Jira subtask uses the Atlassian MCP — same setup policy as
`feature-jira/reference/jira-push.md`:

1. `ToolSearch` for a Jira issue tool (`getJiraIssue`).
2. If only `authenticate` / `complete_authentication` are available, the MCP isn't
   connected — drive the OAuth here: call `authenticate`, hand the user the URL, finish the
   handshake when they authorize. Don't punt to the `/mcp` menu.
3. `getJiraIssue` with `cloudId: "contentstack.atlassian.net"` and the issue key; read
   `package`, `Vulnerable Version`, `isFixable`, `Severity`, `Vulnerability ID`,
   `Project File` from the description.
4. This skill **reads** Jira only. Writing the comment is manual — the user pastes it. Never
   call `addCommentToJiraIssue` from here.

## Precedence
1. A **live Snyk MCP scan is the default** — prefer it whenever the user hasn't named a
   specific ticket. If the MCP isn't connected, offer to connect it first.
2. An **explicit Jira key the user pasted** overrides the default — honor the ticket they
   named (they're pointing you at a specific finding on purpose).
3. **Ticket mode as fallback** — only when the Snyk MCP genuinely can't be connected (no
   CLI/token, or the user declines setup). Then ask for the Snyk Jira key(s).
