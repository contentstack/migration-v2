# Routing — which path implements this feature

Decide once, from `trd.md` + `jira.md`, before touching code. Pick the **most specific** route that fits.

## Decision tree

```
Does the source CMS already have a connector?
├── NO  → ROUTE A: invoke add-cms-connector  (scaffolds all four layers)
└── YES → Is the ONLY change a single source-type → Contentstack-type mapping?
          ├── YES → ROUTE B: invoke add-connector-field
          └── NO  → ROUTE C: implement directly across the four layers
```

"Single mapping change" = one field/widget type starts mapping (or remaps) to a different Contentstack type — no new entry logic, no new upload shape, no UI registration. If the ticket touches `createEntry` value handling, a new validator branch, or `legacyCms.json`, it is Route C.

## ROUTE A — brand-new source CMS → `add-cms-connector`

Invoke the skill pre-filled so its Step 0 does not re-ask. Extract from the artifacts:

- **CMS name** — three forms (TRD names the CMS): `<cms>` lowercase enum/dep key, `<Cms>` PascalCase symbol, `<CMS>` UPPER_SNAKE enum key.
- **Sample export path** — the TRD / use-case records where the sample export lives (file, folder, or archive). Verify it exists (`ls`) before invoking.

Pre-fill: "Run add-cms-connector for CMS `<Cms>`, sample export at `<path>`." The skill still confirms the inferred field map and plan — let it.

## ROUTE B — single field-mapping change → `add-connector-field`

Invoke the skill pre-filled. Extract from the artifacts:

- **Connector name** — `wordpress` | `contentful` | `drupal` | `aem` | `sitecore` | `sanity` (the TRD/ticket names it).
- **Desired Contentstack type** — from the vocabulary: `single_line_text`, `multi_line_text`, `text`, `html`, `json`, `markdown`, `number`, `boolean`, `isodate`, `file`, `reference`, `taxonomy`, `link`, `group`, `global_field`, `url`.
- **Sample field value** — a real export snippet of the source field (so the source type id + value shape are visible). The TRD usually embeds one; otherwise pull from the sample export.

Pre-fill: "Run add-connector-field for `<connector>`: map `<source type>` → `<Contentstack type>`, sample value `<…>`."

## ROUTE C — multi-layer change to an existing connector → direct

No skill to invoke — edit the four layers yourself, using the `add-cms-connector` reference docs as the map: `touchpoints.md` (exact files + line anchors), `entry-creation.md` (the `createEntry` contract — inputs, output layout, the per-type value switch, asset/group/blocks passes), `upload-flow.md` (upload-kind → `fileExt` → validator `data` shape). Work ticket by ticket; tick acceptance criteria as you go.

## Verification checklist (Route C, and the routed skills run their own)

```bash
# A. Parser package compiles
cd upload-api/migration-<cms> && npm install && npm run build

# B. upload-api server compiles (file: dep resolves; catches missing import/case)
cd .. && npm install && npm run build

# C. api compiles — pre-existing errors expected; confirm none in YOUR files
cd ../api && npm install && npx tsc --noEmit 2>&1 | grep -E "<cms>.service|migration.service" || echo "no new errors in your files"

# D. ui compiles / legacyCms.json parses
cd ../ui && npm install && npx tsc --noEmit 2>&1 | grep -iE "legacycms|<cms>" || echo "no new errors in your files"
python3 -c "import json; json.load(open('ui/src/cmsData/legacyCms.json')); print('legacyCms.json OK')"

# E. GUARD: must return TWO matches (both switches in migration.service.ts)
grep -n "case CMS.<CMS>" api/src/services/migration.service.ts
```

`api`/`ui` do NOT compile clean from scratch — judge by **no NEW errors in YOUR files**, not zero global errors (hence the grep filters). One match in guard E = the full-migration switch was forgotten; the connector works in test but silently no-ops in full migration.
