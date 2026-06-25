# <Feature> — Use case

**Slug:** `<feature-slug>` · **Author:** <name> · **Date:** <YYYY-MM-DD> · **Status:** Draft

## Summary

<One short paragraph: what the feature is and why it matters, in plain language.>

## Problem / motivation

<What's broken or missing today. The pain that triggered this request.>

## Stakeholders

<Who needs this and who is affected — e.g. migration users moving from <CMS>, the connector team, support. One line each.>

## References

| Source | Type | Link/Path | What it tells us |
|---|---|---|---|
| <name> | public URL / local file / pasted text / Confluence / Jira / Drive | <url or repo-relative path> | <the fact(s) this source contributed> |

## Assumptions & decisions

The confident calls made while drafting (see the skill's Default decisions). Each is a starting position — flip any by saying so.

| Decision | Choice | Default? | Why |
|---|---|---|---|
| <e.g. system records> | <excluded> | <yes> | <no Contentstack equivalent; flip if needed> |
| <e.g. assets> | <migrate as assets> | <yes> | <media is part of the content> |
| <e.g. locales> | <single-locale> | <yes/no> | <sample shows no i18n / user requested multi-locale> |

## Current behaviour

<How the migration tool behaves today for this scenario. Cite the reference rows above.>

## Desired behaviour

<What should happen instead once the feature ships.>

## Scope

### In

- <What this feature explicitly includes.>

### Out

- <What is explicitly excluded / deferred.>

## Affected connectors & layers

| Layer (A/B/C/D) | Touched? | Notes |
|---|---|---|
| A — parser package `upload-api/migration-<cms>/` | <yes/no/maybe> | <e.g. new case in `libs/schemaMapper.ts`> |
| B — upload-api wiring | <yes/no/maybe> | <e.g. switch in `upload-api/src/services/createMapper.ts` / `validators/index.ts`> |
| C — api transform `api/src/services/<cms>.service.ts` | <yes/no/maybe> | <e.g. `createEntry` + BOTH switches in `migration.service.ts`> |
| D — ui registration `ui/src/cmsData/legacyCms.json` | <yes/no/maybe> | <e.g. `all_cms` entry / doc url> |

## Success criteria

- <Observable, testable outcome that means the feature works.>

## Open questions

- <Anything unresolved that the references and clarifying questions did not settle. Carry these into feature-prd-trd.>
