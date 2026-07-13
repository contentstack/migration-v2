# SAP SmartEdit Connector — TRD

> Feature: `sap-smartedit` · Connector(s): `sap-smartedit` · Stage 2 (TRD) · Author: Ayush Sahu · Date: 2026-07-13 · Status: Draft

## Summary

Implement SAP SmartEdit as a standard four-layer connector (FR-1…FR-10). Because ImpEx is a semicolon-delimited header/row text format — not JSON like every existing connector — Layer A is a **custom ImpEx parser** written from scratch rather than a reuse of the JSON templates, and Layer C carries a **self-contained copy** of that parser so the api side has no cross-package dependency. Layers B and D are the conventional wiring/registration touchpoints. The parser derives column "types" from ImpEx header syntax + observed values (`classifyColumn` in `contentTypes.ts`) and maps them to Contentstack field types (`mapField` in `schemaMapper.ts`); the transform maps those field types to the api data types (`mapFieldTypeToDataType`).

## Architecture impact

| Layer | Files to change | Change |
|---|---|---|
| **A — parser** `upload-api/migration-sap-smartedit/` | `index.ts`, `libs/contentTypes.ts`, `libs/schemaMapper.ts`, `libs/extractLocale.ts`, `interface/`, `utils/`, `config/`, `package.json`, `tsconfig.json` | New package: custom ImpEx parser. `contentTypes.ts` classifies columns + extracts 16 CTs, routes `Media`→assets, enforces mandatory `title`/`url`, lowercases CT uids (`toCtUid`), guards reserved field uids (`guardReservedUid` → `src_`). `schemaMapper.ts` maps source type → Contentstack field type. |
| **B — upload-api wiring** | `src/controllers/sap-smartedit/index.ts`, `src/validators/sap-smartedit/index.ts`, `src/validators/index.ts` (`sap-smartedit-impex` + `sap-smartedit-folder` cases), `src/services/createMapper.ts` (`sap-smartedit` case), `package.json` (`file:` dep), shared upload route | New controller + validator; two validator keys (single-file + folder); mapper case; `file:` dependency on the parser package; small upload-route fix so single-file `.impex` uploads reach the parser with a valid path (mirrors the directory branch; zip/xml untouched). |
| **C — api transform** | `api/src/services/sap-smartedit.service.ts` (`createEntry` / `createLocale` / `createVersionFile` / `getAllAssets`, `mapFieldTypeToDataType`), `api/src/constants/index.ts` (`CMS.SAP_SMARTEDIT = 'sap-smartedit'`), `api/src/services/migration.service.ts` (**TWO switches** — test L576 + full L1051) | New transform service with a self-contained ImpEx parser. `createEntry` builds entries + resolves references (single + multiple cross-type via a source-id → entry-uid index); `getAllAssets` downloads binaries from the Media `URL` before entry creation; wires both switch arms in `migration.service.ts`. |
| **D — ui registration** | `ui/src/cmsData/legacyCms.json` (`all_cms` entry, L259) | `cms_id: sap-smartedit`, `fileformat_id: impex`, `isactive: true`; `cms_id` matches `CMS.SAP_SMARTEDIT`. Card renders automatically. |

## Data & field-type mapping

Source "type" is derived in `contentTypes.ts:classifyColumn`; `schemaMapper.ts:mapField` produces the Contentstack field type; `sap-smartedit.service.ts:mapFieldTypeToDataType` produces the api data type.

| Source type (ImpEx column) | Contentstack field type | `mapFieldTypeToDataType` data type |
|---|---|---|
| `string` (names, labels, free text) | `single_line_text` | `text` |
| `html` (e.g. `CMSParagraphComponent.content`) | `html` | `html` |
| `file` (`media(...)` lookups + `$picture` macro) | `file` | `file` |
| `reference` (single FK, e.g. `template(uid)`, `page(uid)`) | `reference` | `reference` |
| `referenceMultiple` (`cmsComponents(&ref)` lists) | `reference` (`advanced.multiple = true`) | `reference` |
| `boolean` (`active`, `external`) | `boolean` | `boolean` |
| `number` (`position`) | `number` | `number` |
| `url` (`urlLink`) | `url` | `text` |
| _default / unknown_ | `single_line_text` | `text` |
| _mandatory built-ins_ | `title`, `url` on every CT | `text` |

**Known typing gap:** enum-ish columns carrying a `(code)` qualifier (`approvalStatus`, `restrictedPageTypes`) are mis-classified as `reference`, producing ~19 unresolved references. They are values, not pointers. Follow-up: classify known enum columns as text or re-map in the field UI.

## Entry-creation considerations

- **References** — resolved via a source-id → entry-uid index (`toEntryUid` strips non-alphanumerics for a stable uid). Single refs (`template` → `sap_pagetemplate`) and multiple cross-type refs (`cmsComponents` → banner + nav components) both resolve. Reference targets are lowercased to match the normalised CT uids.
- **Nested groups / modular blocks** — N/A for v1. ImpEx is flat (header-defined, no nesting), so the parser does **not** expand groups or modular blocks; all 16 CTs are flat and mapped 1:1. Nested page composition is a deferred follow-up.
- **Assets** — `getAllAssets` runs before `createEntry`, downloads each Media binary from its `URL` (WordPress/Contentful pattern) to `assets/files/<uid>/<filename>`, and keys the index by `assetKey(code)`. `file` fields resolve to the full asset record via the same key. Failures → `logs/assets/cs_failed.json`, excluded from the index. `Media` is never a content type.
- **UID hygiene** — CT uids lowercased on extraction (`toCtUid`); reserved field uids prefixed `src_` (`guardReservedUid`); `title`/`url` kept as standard built-ins. Without this, mixed-case uids caused "Content Type not found" and reserved uids were rejected by the CMA.

## Upload / validation flow

- **Export shape** — single `.impex` file **or** an extracted export folder.
- **Validator keys** — `sap-smartedit-impex` (single file) and `sap-smartedit-folder` (folder); both handled in `src/validators/index.ts` and routed by the `sap-smartedit` case in `createMapper.ts`.
- **`data` arg shape** — file path string (single `.impex`) / directory path string (folder). The shared upload-route fix ensures single-file uploads arrive with a valid path.

## Test & verification plan

```bash
# A. Parser package compiles
cd upload-api/migration-sap-smartedit && npm install && npm run build

# B. upload-api compiles (file: dep + switches)
cd .. && npm install && npm run build

# C. api typecheck — success = no NEW errors in YOUR files
cd ../api && npm install && npx tsc --noEmit 2>&1 | grep -E "sap-smartedit.service|migration.service" || echo "no new errors in your files"

# D. ui — legacyCms.json parses
cd ../ui && node -e "JSON.parse(require('fs').readFileSync('src/cmsData/legacyCms.json','utf8')) && console.log('legacyCms.json OK')"

# E. GUARD: must return TWO matches (both switches in migration.service.ts)
grep -n "case CMS.SAP_SMARTEDIT" api/src/services/migration.service.ts

# F. End-to-end (manual): start api + upload-api + ui, select SAP SmartEdit,
#    upload sample-export.impex, confirm 16 CTs + ~80 entries + 6 assets + resolved refs.
```

Reference results (against `sample-export.impex`): 16 CTs extracted, `Media`→assets, ~80 entries written, 6/6 assets downloaded, single + multiple refs resolved, both switches present.

## Risks / rollout

| Risk | Mitigation |
|---|---|
| Second `migration.service.ts` switch missed — works in test, no-ops in full | Guard grep (step E) must show 2 matches (L576 + L1051) |
| Parser drift between Layer A package and the Layer C self-contained copy | Keep the two ImpEx parsers in sync; they are intentionally duplicated to avoid a cross-package dep — any classification fix must be applied to both |
| Synthetic-only validation | Re-validate on a real SAP export (hard dependency on SAP download access) before declaring GA |
| Enum-as-reference false positives | Logged, non-fatal; classify known enum columns as text in follow-up |
| Live-import asset `ENOENT` | Open item; confirm binary path with a real export carrying real DAM URLs |
| ZIP export not yet supported | Folder shape covers the extracted case; ZIP is a named follow-up |

## Links

- PRD: `docs/features/sap-smartedit/prd.md`
- Use case: `docs/features/sap-smartedit/use-case.md`
- Confluence: <filled after push — Step 4>
