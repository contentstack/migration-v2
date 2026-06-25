# <Feature> — TRD

> Feature: `<feature-slug>` · Connector(s): `<cms>` · Stage 2 (TRD) · Author: <you> · Date: <YYYY-MM-DD> · Status: Draft

## Summary

<2–4 sentences: the technical approach, grounded in the four-layer connector architecture. Reference the PRD's FRs.>

## Architecture impact

Name the concrete files this feature changes. Drop rows for layers it does not touch.

| Layer | Files to change | Change |
|---|---|---|
| **A — parser** `upload-api/migration-<cms>/` | `libs/schemaMapper.ts`, `libs/contentTypes.ts`, `libs/extractLocale.ts` | <what changes> |
| **B — upload-api wiring** | `src/services/createMapper.ts` (switch), `src/validators/index.ts` (switch), `src/controllers/<cms>/`, `src/validators/<cms>/`, `package.json` (`file:` dep) | <what changes> |
| **C — api transform** | `api/src/services/<cms>.service.ts` (`createEntry`/`createLocale`/`createVersionFile`, `mapFieldTypeToDataType`), `api/src/constants/index.ts` (`CMS` enum), `api/src/services/migration.service.ts` (**TWO switches** — test + full) | <what changes> |
| **D — ui registration** | `ui/src/cmsData/legacyCms.json` (`all_cms` entry), `ui/src/utilities/constants.ts` (optional doc url) | <what changes> |

## Data & field-type mapping

| Source type | Contentstack type | `mapFieldTypeToDataType` data type |
|---|---|---|
| <source field/widget type> | <single_line_text / json / file / reference / group / …> | <data_type emitted by the api map> |

## Entry-creation considerations

- **References** — <source-id → entry-uid index resolution; `refrenceTo`>
- **Nested groups** — <dotted-child rows `parent.child`; `buildSchemaTree`; group value keyed by last uid segment>
- **Modular blocks** — <heterogeneous arrays → one block per element type; value = array of single-key block objects in source order>
- **Assets** — <`getAllAssets` runs before `createEntry`; `file` fields resolve to the full asset record; `file_path` vs `packagePath` for archive connectors>

## Upload / validation flow

- **Export shape** — <single file / NDJSON / folder / archive / DB>
- **Validator key** — `<cms>-<ext>` (folder/archive connectors → `<cms>-folder`)
- **`data` arg shape** — <directory path string / raw string / JSZip / DB config>

## Test & verification plan

```bash
# A. Parser package compiles
cd upload-api/migration-<cms> && npm install && npm run build

# B. upload-api compiles (file: dep + switches)
cd .. && npm install && npm run build

# C. api typecheck — success = no NEW errors in YOUR files
cd ../api && npm install && npx tsc --noEmit 2>&1 | grep -E "<cms>.service|migration.service" || echo "no new errors in your files"

# D. ui typecheck / legacyCms.json parses
cd ../ui && npm install && npx tsc --noEmit 2>&1 | grep -iE "legacycms|<cms>" || echo "no new errors in your files"

# E. GUARD: must return TWO matches (both switches in migration.service.ts)
grep -n "case CMS.<CMS>" api/src/services/migration.service.ts
```

## Risks / rollout

| Risk | Mitigation |
|---|---|
| Second `migration.service.ts` switch missed — works in test, no-ops in full | The grep guard above must show 2 matches |
| <risk> | <mitigation> |

## Links

- PRD: `docs/features/<feature-slug>/prd.md`
- Use case: `docs/features/<feature-slug>/use-case.md`
- Confluence: <filled after push — Step 4>
