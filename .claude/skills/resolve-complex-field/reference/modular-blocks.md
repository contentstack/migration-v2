# Modular Blocks — Two Distinct Cases

These two cases look similar from a naming perspective but are architecturally different in Contentstack. Misidentifying them causes silent drops or schema build failures.

## Case 1 — Modular blocks field (inline schema, NOT standalone CT)

**What it is:** A top-level field on a content type whose value is an array of objects, each representing a "block" of a specific type. Each block type has its own schema embedded inline in the parent content type — they are NOT standalone content types in Contentstack.

**Detection signals:**
- Source field type: `modular_blocks`, `rich_text` (DatoCMS), `pageBuilder`, `sections`
- Sample value: array of objects with a per-element type discriminator
- ≥ 2 distinct type values across the array elements
- In DatoCMS: the field has `validators.rich_text_blocks.item_types` set (linking to block models with `modular_block: true`)

**DatoCMS example:**
```json
"page_sections": [
  { "id": "abc", "item_type": { "id": "banner" }, "title": "Hero Banner", "cta_label": "Learn More" },
  { "id": "def", "item_type": { "id": "text_block" }, "body": { "schema": "dast", ... } }
]
```

**CS schema rows (3 levels):**

```
Parent row:
  otherCmsField:          "page_sections"
  otherCmsType:           "rich_text"         ← the SOURCE type name
  contentstackFieldType:  "modular_blocks"
  contentstackFieldUid:   "page_sections"
  isDeleted:              false               ← MANDATORY, CT builder filters strictly

Block row (one per distinct block type):
  otherCmsField:          "banner"            ← RAW source type string (the join key at entry time)
  otherCmsType:           "modular_blocks_child"
  contentstackFieldType:  "modular_blocks_child"
  contentstackFieldUid:   "page_sections.banner"
  isDeleted:              false

Field rows inside the block (one per block field):
  otherCmsField:          "title"
  otherCmsType:           "String"
  contentstackFieldType:  "single_line_text"
  contentstackFieldUid:   "page_sections.banner.title"
  isDeleted:              false
```

Key rules:
- Parent row: `modular_blocks`, NO `advanced.multiple` — CT builder hardcodes `multiple: true`
- Block rows: `contentstackFieldType: 'modular_blocks_child'` AND `otherCmsType: 'modular_blocks_child'`
- Block row `otherCmsField` = the RAW source discriminator value — this is the join key at entry creation time
- ALL rows: `isDeleted: false` — the CT builder path for blocks filters on `isDeleted === false` **strictly** (not truthy — explicitly `=== false`)
- Block uid = `<parentUid>.<blockUid>` (one level of dotting)
- Field uid = `<parentUid>.<blockUid>.<fieldUid>` (two levels of dotting)

**Entry value shape:**
```json
"page_sections": [
  { "banner": { "title": "Hero Banner", "cta_label": "Learn More" } },
  { "text_block": { "body": { "type": "doc", "uid": "...", "attrs": {}, "children": [...] } } }
]
```

- Array of single-key objects: `{ "<blockTypeUid>": { <fields> } }`
- Block type uid is the `contentstackFieldUid` last segment of the block row (e.g. `banner` from `page_sections.banner`)
- Source order is preserved — important for UI rendering
- Elements with no matching block row are **skipped with a log** (never synthesize a catch-all block)

**Entry transform:**
```ts
const blockRows = ct.fieldMapping.filter(f =>
  f.contentstackFieldType === 'modular_blocks_child' &&
  f.contentstackFieldUid.startsWith(`${parentField.contentstackFieldUid}.`)
);

const result = [];
for (const el of sourceArray) {
  const sourceType = el.item_type?.id ?? el._type ?? el.__typename;
  const blockRow = blockRows.find(r =>
    r.otherCmsField === sourceType || r.backupFieldUid === sourceType
  );
  if (!blockRow) {
    console.warn(`[modular_blocks] no block row for type "${sourceType}", skipping`);
    continue;
  }
  const blockUid = getLastUid(blockRow.contentstackFieldUid); // strips parent prefix
  const childRows = ct.fieldMapping.filter(f =>
    f.contentstackFieldUid.startsWith(`${blockRow.contentstackFieldUid}.`)
  );
  const blockObj: Record<string, any> = {};
  for (const childRow of childRows) {
    const childUid = getLastUid(childRow.contentstackFieldUid);
    blockObj[childUid] = transformField(childRow, el[childRow.otherCmsField], ...);
  }
  result.push({ [blockUid]: blockObj });
}
return result;
```

---

## Case 2 — Blocks embedded inside structured text (standalone CTs, RTE reference nodes)

**What it is:** An RTE field (DAST, Slate, etc.) whose nodes include references to external records by ID. The referenced records are of types that ARE standalone content types in CS. They appear inline inside the RTE text as reference nodes.

**Detection signals:**
- Source field type: `structured_text` (DatoCMS), `richText` with linked entries (Contentful)
- Sample RTE tree contains nodes like: `{type:'block', item:'<id>'}` or `{type:'inlineItem', item:'<id>'}` (DAST), or `nodeType: 'embedded-entry-block'` (Contentful)
- The referenced records are regular content type instances, NOT block models

**DatoCMS DAST example:**
```json
{
  "schema": "dast",
  "document": {
    "type": "root",
    "children": [
      { "type": "paragraph", "children": [{ "type": "span", "value": "See also:" }] },
      { "type": "block", "item": "12345678" }
    ]
  }
}
```

**CS output inside the RTE doc:**
```json
{
  "type": "reference",
  "uid": "...",
  "attrs": {
    "display-type": "block",
    "entry-uid": "<resolved-cs-entry-uid>",
    "content-type-uid": "<resolved-cs-ct-uid>",
    "locale": "en-us",
    "type": "entry",
    "class-name": "embedded-entry-block"
  },
  "children": [{ "text": "" }]
}
```

**Lookup index required:**
Build a map before entry creation:
```ts
// Built during getAllAssets / before createEntry loop
const sourceIdToEntryUid: Record<string, string> = {}; // sourceRecordId → cs entry uid
const sourceIdToCtUid: Record<string, string> = {};    // sourceRecordId → cs CT uid

// Populated as each source record is processed
sourceIdToEntryUid[record.id] = toEntryUid(record.id);
sourceIdToCtUid[record.id] = getCtUidForType(record.item_type.id);
```

Pass both maps into the RTE converter:
```ts
convertStructuredTextToCSRte(value, sourceIdToEntryUid, sourceIdToCtUid, masterLocale)
```

**These block types DO need standalone CTs** — they're regular entries referenced from inside the RTE, not inline schemas.

---

## How to tell Cases 1 and 2 apart quickly

| Check | Case 1 | Case 2 |
|---|---|---|
| Source field type | `rich_text`, `modular_blocks`, non-text | `structured_text`, `richText` |
| DatoCMS model flag | block models have `modular_block: true` | referenced models are regular CTs |
| Value is | top-level array | a nested tree with id-references inside |
| CS schema | blocks inline in parent CT | referenced records are their own CTs |
| CS value | array of `{blockUid: {...}}` | RTE doc with reference nodes inside |
| Converter needed? | No — just schema rows + entry transform | Yes — full RTE converter with reference resolution |

---

## Common mistakes

1. **Mapping a DatoCMS `rich_text` field to CS `json`** — the value is not an RTE tree; it's an array of block objects. The CLI crashes trying to call `.children.forEach()`.

2. **Using `modular_blocks` without `isDeleted: false`** — the CT builder skips these rows silently. Everything appears to work until you check the generated schema and find the blocks are empty.

3. **Inverting the cases** — creating standalone CTs for Case 1 block models and trying to reference them from entries. The block models are meant to be schema-inline only; they have no meaningful standalone existence.

4. **Preserving source array order accidentally broken** — when building entry values for Case 1, use `.map()` over the source array in order. Don't group by type and then rebuild — this reorders the blocks and breaks the author's intended interleaving.
