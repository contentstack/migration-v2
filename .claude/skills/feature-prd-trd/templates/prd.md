# <Feature> — PRD

> Feature: `<feature-slug>` · Connector(s): `<cms>` · Stage 2 (PRD) · Author: <you> · Date: <YYYY-MM-DD> · Status: Draft

## Overview

<2–4 sentences: what the feature is and why it matters. Pull the problem statement from `use-case.md`.>

## Goals

- <goal 1 — outcome, not implementation>
- <goal 2>

## Non-goals

- <explicitly not solving this now>

## User stories

- As a <role>, I want <capability> so that <benefit>.
- As a <role>, I want <capability> so that <benefit>.

## Functional requirements

- **FR-1** — <the system must …>
- **FR-2** — <…>
- **FR-3** — <…>

## Non-functional requirements

- **Performance** — <e.g. parse a 10k-entry export within N minutes>
- **Reliability** — <e.g. no silent drops; fail loud on unknown field types>
- **Compatibility** — <existing connectors unaffected>

## Success metrics

- <measurable signal, e.g. "% of source field types mapped (no fall-through to default)">
- <e.g. "entries created / entries in export ≥ 99%">

## Risks & mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| <risk> | <L/M/H> | <L/M/H> | <mitigation> |

## Out of scope

- <deferred item — name it so it's not silently assumed>

## Links

- Use case: `docs/features/<feature-slug>/use-case.md`
- TRD: `docs/features/<feature-slug>/trd.md`
- Confluence: <filled after push — Step 4>
