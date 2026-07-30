---
description: Review a GitHub PR with the pr-reviewer subagent (posts inline COMMENT review)
argument-hint: <pr-number-or-url>
---

Use the **pr-reviewer** subagent (via the Agent tool, `subagent_type: pr-reviewer`) to review the following pull request end-to-end and post GitHub-ready inline review comments:

PR: $ARGUMENTS

If no PR number or URL was provided above, ask the user which PR to review before proceeding.
