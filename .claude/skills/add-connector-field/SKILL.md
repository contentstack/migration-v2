---
name: add-connector-field
description: Add or change a single field-type mapping in an EXISTING CMS connector (wordpress, contentful, drupal, aem, sitecore) — e.g. start mapping a source field/widget type that was previously dropped or mis-typed, or change which Contentstack field type a source type produces. Use this when the source CMS already has a connector and only the per-field mapping needs to change. For a brand-new CMS with no connector yet, use add-cms-connector instead.
---

# Add / change a field-type mapping in an existing connector

A field flows through two mapping points. To support a new source field type (or fix one), edit them consistently so the entry value survives all the way into Contentstack.

> Read `reference/field-mapping.md` for exactly where each connector's mapper lives.

## Inputs you need from the user
1. **Which connector** — `wordpress` | `contentful` | `drupal` | `aem` | `sitecore`.
2. **A sample of the field's value** from a real export (so you can see the source type id and the value shape).
3. **Desired Contentstack field type** — if unsure, propose one from the vocabulary and confirm:
   `single_line_text`, `multi_line_text`, `text`, `html`, `json`, `markdown`, `number`, `boolean`, `isodate`, `file`, `reference`, `taxonomy`, `link`, `group`, `global_field`, `url`.

## Workflow

### Step 1 — Locate the connector's mapper (Layer A, upload-api)
Open the connector's schema mapper:
- wordpress → `upload-api/migration-wordpress/libs/schemaMapper.ts` (switch on Gutenberg block `name`)
- contentful → `upload-api/migration-contentful/` (widget-id inference)
- drupal → `upload-api/migration-drupal/` (field analysis from DB)
- aem / sitecore → the respective `upload-api/migration-<cms>/` package

Add or amend the `case` for the source type so it returns a `Field` with the chosen `contentstackFieldType`. Match the file's existing `Field`-builder style (uid generation, `advanced` flags like `multiple`/`mandatory`).

### Step 2 — Extend the type union if needed
If the chosen `contentstackFieldType` is **not** already in the `Field.contentstackFieldType` union in that package's `interface/interface.ts`, add it (the union ends in `| string`, so it compiles either way — but list real types explicitly for clarity).

### Step 3 — Map the type on the api side (Layer C)
Ensure the Contentstack-type → API-data-type map accepts the type:
- drupal → `api/src/services/drupal/content-types.service.ts` → `mapFieldTypeToDataType` (~448–474).
- contentful → `api/src/services/contentful.service.ts` → `inferContentfulDefaultWidgetId` (~201–217).
- others → search the connector's service for the equivalent map.
If the type is missing from the map, add it so the generated content-type schema gets the right `data_type`.

### Step 4 — Handle the value at entry time (only if the shape is new)
If the new field carries a value shape the entry transformer doesn't already handle (e.g. a media object, a nested group, a reference id), add handling in:
- the parser package's entry extractor (e.g. wordpress `libs/extractItems.ts`), and
- the api `createEntry` for that connector (`<cms>.service.ts` or `<cms>/entries.service.ts`).
A pure `single_line_text`/`number`/`boolean` usually needs no extra handling.

### Step 5 — Verify (scoped to the one connector)

```bash
# parser package compiles
cd upload-api/migration-<cms> && npm run build

# upload-api + api typecheck
cd .. && npm run build
cd ../api && npx tsc --noEmit
```

End-to-end: run a migration with an export containing the field; confirm the content-type schema shows the new field with the right type and an entry carries the value (check `upload-api/cmsMigrationData/`).

## Conventions
- Keep the `Field` shape identical across packages — don't add per-connector fields.
- The method name `createRefrence` is intentionally misspelled in the codebase; match it.
- Prefer mapping unknown/complex shapes to `json` over dropping them — preserves data for manual remap in the UI.
