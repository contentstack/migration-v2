---
name: add-connector-field
description: Add or change a single field-type mapping in an EXISTING CMS connector (wordpress, contentful, drupal, aem, sitecore, sanity) — e.g. start mapping a source field/widget type that was previously dropped or mis-typed, or change which Contentstack field type a source type produces. Use this when the source CMS already has a connector and only the per-field mapping needs to change. For a brand-new CMS with no connector yet, use add-cms-connector instead.
---

# Add / change a field-type mapping in an existing connector

A field flows through two mapping points. To support a new source field type (or fix one), edit them consistently so the entry value survives all the way into Contentstack.

> Read `reference/field-mapping.md` for exactly where each connector's mapper lives.

> Tone: same meme rules as `add-cms-connector` — real-time, chat-narration only,
> one per message max; never in code, tables, or option labels.

## Inputs you need from the user
1. **Which connector** — `wordpress` | `contentful` | `drupal` | `aem` | `sitecore` | `sanity`.
2. **A sample of the field's value** from a real export (so you can see the source type id and the value shape).
3. **Desired Contentstack field type** — if unsure, propose one from the vocabulary and confirm:
   `single_line_text`, `multi_line_text`, `text`, `html`, `json`, `markdown`, `number`, `boolean`, `isodate`, `file`, `reference`, `taxonomy`, `link`, `group`, `global_field`, `url`.

## Workflow

### Step 0 — Ask for the inputs first (select UI)
The VERY FIRST action is a single `AskUserQuestion` call (the interactive
select-and-submit UI — not inline prose) asking: (1) which connector, (2) the
desired Contentstack field type (offer your best-guess proposals as options).
Ask for the sample field value inline afterwards if it wasn't already provided.

⚠️ Same schema gotchas as `add-cms-connector` Step 0 — an out-of-spec call dies
with "Invalid tool parameters": 2–4 options per question (never 1), no
hand-rolled "Other" (the UI appends one), `header` ≤ 12 chars,
`multiSelect: false`, every option needs `label` + `description`. With 6
connectors, offer the 3 likeliest and let "Other" cover the rest.

### Step 1 — Locate the connector's mapper (Layer A, upload-api)
Open the connector's schema mapper:
- wordpress → `upload-api/migration-wordpress/libs/schemaMapper.ts` (switch on Gutenberg block `name`)
- contentful → `upload-api/migration-contentful/` (widget-id inference)
- drupal → `upload-api/migration-drupal/` (field analysis from DB)
- aem → **per-component handlers**, NOT a single switch. Each AEM component (`:type`) has a class in `upload-api/migration-aem/libs/contentType/components/*.ts` with `isXxx()` (detects on the `:type` substring) + `mapXxxToContentstack()` (returns the `Field`/group). They're dispatched by the `mappingRules` array in `libs/contentType/index.ts` (`processComponents`). A source `:type` that matches no rule is **silently dropped**. To support a new component: add a `*Component.ts` (model it on `TitleComponent`/`TeaserComponent`), export it from `components/index.ts`, and add a rule to `mappingRules`. Field *shapes* come from `Field`-builder classes in `libs/contentType/fields/contentstackFields/index.ts`.
- sitecore → the `upload-api/migration-sitecore/` package
- sanity → `upload-api/migration-sanity/libs/schemaMapper.ts` (type inference from NDJSON sample values; group/blocks rows come from `contentTypes.ts`'s `emitFieldRows`)

Add or amend the `case` for the source type so it returns a `Field` with the chosen `contentstackFieldType`. Match the file's existing `Field`-builder style (uid generation, `advanced` flags like `multiple`/`mandatory`).

### Step 2 — Extend the type union if needed
If the chosen `contentstackFieldType` is **not** already in the `Field.contentstackFieldType` union in that package's `interface/interface.ts`, add it (the union ends in `| string`, so it compiles either way — but list real types explicitly for clarity).

⚠️ **aem has no `interface/interface.ts` union** — `contentstackFieldType` is a
plain string set by `Field`-builder classes in
`libs/contentType/fields/contentstackFields/index.ts` (`TextField`, `JsonField`,
`HtmlField`, `GroupField`, …). To add a new type, add a new `Field` subclass
there (model it on the existing ones) and use it from the component handler.

### Step 3 — Map the type on the api side (Layer C)
Ensure the Contentstack-type → API-data-type map accepts the type:
- drupal → `api/src/services/drupal/content-types.service.ts` → `mapFieldTypeToDataType` (~448–474).
- contentful → `api/src/services/contentful.service.ts` → `inferContentfulDefaultWidgetId` (~201–217).
- sanity → `api/src/services/sanity.service.ts` → `mapFieldTypeToDataType` (~38).
- aem → has **no per-connector data_type map**; the content-type schema is built by the **generic** `api/src/utils/content-type-creator.utils.ts` → `switch (field?.contentstackFieldType)` (~540). It already covers `single_line_text`, `boolean`, `json`, `html`, `reference`, `taxonomy`, `group`, etc. — so a type already in that switch needs **no** api schema change. Note the `json` case branches on `otherCmsType`: `'Object'`/`'Array'` → structured JSON extension field; anything else → JSON RTE.
- others → search the connector's service for the equivalent map.
If the type is missing from the map, add it so the generated content-type schema gets the right `data_type`.

### Step 4 — Handle the value at entry time (only if the shape is new)
If the new field carries a value shape the entry transformer doesn't already handle (e.g. a media object, a nested group, a reference id), add handling in:
- the parser package's entry extractor (e.g. wordpress `libs/extractItems.ts`), and
- the api `createEntry` for that connector (`<cms>.service.ts` or `<cms>/entries.service.ts`).
- aem → entry values are built by `api/src/services/aem.service.ts` → `processFieldsRecursive` (`switch (field?.contentstackFieldType)` ~588), keyed off the AEM `:type`/field name via `getFieldValue`.
A pure `single_line_text`/`number`/`boolean` usually needs no extra handling.

⚠️ **Structured JSON (arrays/objects) is easy to silently drop.** The api `json`
entry case may only keep *string* content (rich-text path) — an array value then
serialises to empty. To preserve it: set the field's `otherCmsType` to
`'Array'`/`'Object'` in the parser (so the schema builder emits a structured JSON
field) AND ensure the entry `case 'json'` stores the value verbatim for those.
This was exactly the aem `anchor-links` `links` case.

⚠️ Folder/archive connectors (sanity, aem): at entry time `file_path` is the
**raw upload** (possibly a `.tar.gz`), NOT the extracted dir — resolve via
`packagePath` like `sanity.service.ts`'s `resolveDataFile` (see
`add-cms-connector/reference/entry-creation.md`).

### Step 5 — Verify (scoped to the one connector)

```bash
# parser package compiles
cd upload-api/migration-<cms> && npm install && npm run build

# upload-api + api typecheck (npm install first — both have file: deps / missing types)
cd .. && npm install && npm run build
cd ../api && npm install && npx tsc --noEmit 2>&1 | grep -E "<cms>" || echo "no new errors in your files"
```

⚠️ `api` does NOT compile clean from scratch (pre-existing missing-`@types/*` /
implicit-any errors in untouched files). Success = **no NEW errors in YOUR
files**, not zero errors globally — hence the grep filter.

End-to-end: run a migration with an export containing the field; confirm the content-type schema shows the new field with the right type and an entry carries the value (check `upload-api/cmsMigrationData/`).

## Conventions
- Keep the `Field` shape identical across packages — don't add per-connector fields.
- The method name `createRefrence` is intentionally misspelled in the codebase; match it.
- Prefer mapping unknown/complex shapes to `json` over dropping them — preserves data for manual remap in the UI.
