# Node Inference — Two-Stage Structural Classification

Use this reference during Analysis Protocol steps A3. Stage 1 decides the role from structure alone. Stage 2 refines using the name only when it matches — unmatched names always keep their structural role.

This means a node called `absatz` (German for paragraph), `blok_tekstowy` (Polish for text block), or anything proprietary still lands correctly as `p` instead of falling through to the unknown fallback.

Every inference must be logged as: `source type → structural role → CS type`

---

## Stage 1 — Structural role table

Examine the node's fingerprint (what keys it has and what type their values are):

| Fingerprint | Structural role | CS type |
|---|---|---|
| Has text-bearing prop (`text`, `value`, `content` as string), no children | Text leaf | — (no type/uid/attrs) |
| Has children-key, children are only text leaves or inline nodes | Paragraph-like | `p` |
| Has children-key, children are only block nodes, no other payload | Wrapper | pass-through (recurse children, discard wrapper) |
| Has children-key, children are homogeneous item-like objects in sequence | List | `ul` or `ol` + `li` children |
| Has children-key, children have uniform width (each row has same key count) | Table | `table` → `tr` → `td`/`th` |
| Has a reference-bearing prop (uuid-ish string, `_ref`, `itemId`, `item`) | Reference | CS reference node |
| Has a media hint (URL string ending in image ext, mime type key, `width`/`height`) | Embedded asset | CS embedded-asset reference node |
| No children, no text, no payload (empty or only non-string keys) | Void | `hr` with `children:[{text:''}]` |
| Has children of mixed block + inline content | Mixed block | `p` (safest containing block) |

**Ambiguous children check:**
- A block containing only inline/text nodes → `p`
- A block containing only block nodes → pass-through wrapper (recurse, discard the wrapper itself)
- A block containing mixed → `p` (wrap everything)

---

## Stage 2 — Name refinement table

Only runs after structural role is assigned. Only upgrades a role, never downgrades. If the name is not in this table, the structural role from Stage 1 stands unchanged.

| Discriminator value (case-insensitive, partial match ok) | Structural role required | CS type |
|---|---|---|
| `heading` + `level` attribute (1–6) | paragraph-like or wrapper | `h1`–`h6` |
| `h1`…`h6` literally | paragraph-like or wrapper | `h1`–`h6` |
| `quote` / `blockquote` / `block_quote` / `pullquote` | paragraph-like | `blockquote` |
| `pre` / `fence` / `code_block` / `codeBlock` / `fenced_code` | block with text or inline children | `code` block — set `attrs: {'code-type': lang ?? ''}` |
| `hyperlink` / `link` / `anchor` / `a` | inline with text children | `a` — set `attrs: {url, target}` |
| `bullet_list` / `unordered_list` / `ul` / `bulleted_list` | list | `ul` |
| `ordered_list` / `numbered_list` / `ol` | list | `ol` |
| `list_item` / `listItem` / `li` / `item` | block with mixed/text | `li` (apply `li` guard) |
| `table` | grid structure | `table` |
| `table_row` / `tr` | row | `tr` |
| `table_cell` / `td` / `table_data` | cell | `td` |
| `table_header` / `th` | cell | `th` |
| `horizontal_rule` / `thematic_break` / `divider` / `hr` / `break` | void | `hr` |
| `image` / `asset` / `media` / `figure` | media-hinted | embedded-asset reference node |
| `block` / `embed` / `component` + reference-bearing prop | reference-bearing | CS reference node (block display) |
| `inline_item` / `inlineItem` / `inline_embed` + reference-bearing prop | reference-bearing | CS reference node (inline display) |

---

## Node inventory comment format

At the top of every generated converter, record the A2 inventory result as a comment:

```ts
/*
 * Node inventory — <SourceCms> <fieldType>
 * Discriminator field: `<key>`
 * Children-key: `<key>`
 *
 * Block nodes:
 *   <source type>   → <structural role> → <CS type>
 *   ...
 *
 * Leaf nodes:
 *   <source type>   → text leaf
 *
 * Reference nodes:
 *   <source type>   → reference node (block/inline)
 *
 * Marks: <Pattern 1/2/3 or mixed> — <source mark> → <CS prop>, ...
 *
 * Fallback hits: <none | list of types that hit the stringify escape hatch>
 */
```

---

## Pass-through wrapper handling

A wrapper node — one that only contains blocks and has no payload of its own — should be **discarded**, not rendered. Its children are spliced directly into the parent's children array.

```ts
// Wrapper detected — no type emitted, recurse children only
case 'section':
case 'article':
case 'container': {
  const children = convertChildren(node[CHILDREN_KEY], ctx);
  // Return array, not a single node — splice into parent
  return children;
}
```

When a converter case returns an array instead of a single node, the parent must flatten it:
```ts
const children = safe(
  (node[CHILDREN_KEY] ?? [])
    .flatMap((c: any) => {
      const r = convertNode(c, ctx);
      return Array.isArray(r) ? r : [r];
    })
    .filter(Boolean)
);
```

---

## Reference node shapes

**Block embed (position: direct child of root/block):**
```ts
{
  uid: uid(), type: 'reference',
  attrs: {
    'display-type': 'block',
    'entry-uid': entryIdMap[sourceId],
    'content-type-uid': recordToCtUid[sourceId],
    locale: ctx.locale,
    type: 'entry',
    'class-name': 'embedded-entry-block'
  },
  children: [{ text: '' }]
}
```

**Inline embed (position: inside a paragraph or inline context):**
```ts
{
  uid: uid(), type: 'reference',
  attrs: {
    'display-type': 'inline',
    'entry-uid': entryIdMap[sourceId],
    'content-type-uid': recordToCtUid[sourceId],
    locale: ctx.locale,
    type: 'entry',
    'class-name': 'embedded-entry-inline',
    inline: true
  },
  children: [{ text: '' }]
}
```

**Embedded asset:**
```ts
{
  uid: uid(), type: 'reference',
  attrs: {
    'display-type': 'display',
    'asset-uid': assetIdMap[sourceId],
    'content-type-uid': 'sys_assets',
    'asset-link': assetRecord.urlPath,
    'asset-name': assetRecord.title,
    'asset-type': assetRecord.content_type,
    type: 'asset',
    'class-name': 'embedded-asset',
    inline: false
  },
  children: [{ text: '' }]
}
```

All reference nodes: `children: [{text:''}]` always — never empty children.
