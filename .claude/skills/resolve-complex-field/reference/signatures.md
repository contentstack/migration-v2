# Signature Registry — Optional Shortcut

This file is an **optional shortcut**, not the design center. The Analysis Protocol in SKILL.md works without this file for any format. Signatures exist only to skip redundant analysis for formats that are already fully understood.

A signature match means: skip A1–A4, go directly to A5 using the pre-verified node mapping below. The generated converter still must pass all five CS hard rules and the full smoke test.

**Adding a new CMS never requires touching this file.** If no signature matches, the generic path runs and produces valid output.

---

## Known signatures

### DAST (DatoCMS structured_text)

**Fingerprint:** top-level has `schema: 'dast'` OR root node has `type: 'root'` with a `children` array.

```json
{ "schema": "dast", "document": { "type": "root", "children": [...] } }
```

**Discriminator field:** `type`
**Children-key:** `children`
**Marks pattern:** Pattern 1 — `marks` array on `span` nodes

**Node mapping (pre-verified):**

| Source `type` | CS type | Notes |
|---|---|---|
| `root` | `doc` | Root wrapper — not emitted as a child |
| `paragraph` | `p` | |
| `heading` | `h1`–`h6` | `level` attr (1–6) |
| `list` | `ul` / `ol` | `style: 'bulleted'` → `ul`, `style: 'numbered'` → `ol` |
| `listItem` | `li` | Apply `li` guard |
| `blockquote` | `blockquote` | |
| `code` | `code` block | `language` attr → `attrs['code-type']` |
| `thematicBreak` | `hr` | |
| `link` | `a` | `url` attr or `meta` array `{id:'url', value:'...'}` |
| `span` | text leaf | Pattern 1 marks — see marks table below |
| `block` | reference node (block) | `item` field → entry lookup |
| `inlineItem` | reference node (inline) | `item` field → entry lookup |

**DAST marks (Pattern 1 string → CS boolean):**
`strong`→`bold`, `emphasis`→`italic`, `underline`→`underline`, `strikethrough`→`strikethrough`, `code`→`code`, `highlight`→`superscript`

**Value wrapper:** DAST field value is either `{ schema:'dast', document:{type:'root',...} }` or the root node directly. Unwrap: `const root = value.document ?? value`.

---

### Contentful Rich Text

**Fingerprint:** top-level has `nodeType: 'document'` with a `content` array.

```json
{ "nodeType": "document", "content": [...], "data": {} }
```

**Discriminator field:** `nodeType`
**Children-key:** `content`
**Marks pattern:** Pattern 1 — `marks` array of objects `{type:'bold'}` on `text` nodes

**Node mapping (pre-verified):**

| Source `nodeType` | CS type | Notes |
|---|---|---|
| `document` | `doc` | Root wrapper |
| `paragraph` | `p` | |
| `heading-1`…`heading-6` | `h1`–`h6` | |
| `unordered-list` | `ul` | |
| `ordered-list` | `ol` | |
| `list-item` | `li` | Apply `li` guard |
| `blockquote` | `blockquote` | |
| `hr` | `hr` | |
| `hyperlink` | `a` | `data.uri` → `attrs.url` |
| `text` | text leaf | `marks: [{type:'bold'}]` → Pattern 1 |
| `embedded-entry-block` | reference node (block) | `data.target.sys.id` → entry lookup |
| `embedded-entry-inline` | reference node (inline) | `data.target.sys.id` → entry lookup |
| `embedded-asset-block` | embedded asset node | `data.target.sys.id` → asset lookup |

**Contentful marks (Pattern 1 object → CS boolean):**
`bold`→`bold`, `italic`→`italic`, `underline`→`underline`, `code`→`code`, `superscript`→`superscript`, `subscript` → (no CS analog — drop)

---

### ProseMirror / Tiptap

**Fingerprint:** top-level has `type: 'doc'` with a `content` array. No `schema` or `nodeType` key.

```json
{ "type": "doc", "content": [...] }
```

**Discriminator field:** `type`
**Children-key:** `content`
**Marks pattern:** Pattern 3 — wrapper nodes (ProseMirror default) OR Pattern 1 on `text` nodes

**Note:** ProseMirror/Tiptap schemas are highly customizable — the node types below are the defaults. Custom node types not in this table fall through to the generic Analysis Protocol. Check the sample inventory (A2) and extend as needed.

| Source `type` | CS type | Notes |
|---|---|---|
| `doc` | `doc` | Root |
| `paragraph` | `p` | |
| `heading` | `h1`–`h6` | `attrs.level` (1–6) |
| `bulletList` | `ul` | |
| `orderedList` | `ol` | |
| `listItem` | `li` | Apply `li` guard |
| `blockquote` | `blockquote` | |
| `codeBlock` | `code` block | `attrs.language` |
| `horizontalRule` | `hr` | |
| `text` | text leaf | Marks via `marks` array of objects |
| `image` | embedded asset | `attrs.src` |

---

### Sanity Portable Text

**Fingerprint:** top-level is an **array** (not an object). Elements have `_type` discriminator. Block elements have `_type: 'block'` with a `children` array of spans.

```json
[
  { "_type": "block", "style": "normal", "children": [...] },
  { "_type": "image", "asset": { "_ref": "image-..." } }
]
```

**Discriminator field:** `_type`
**Children-key:** `children`
**Marks pattern:** Pattern 1 — `marks` array on span nodes (`markDefs` for links/references)

**Note:** Portable Text wraps the array in a `doc`. The converter must create the root `doc` node manually:
```ts
return { type: 'doc', uid: uid(), attrs: {}, children: safe(portableTextArray.map(n => convertNode(n, ctx))) };
```

| Source `_type` | CS type | Notes |
|---|---|---|
| `block` (style: `normal`) | `p` | |
| `block` (style: `h1`…`h6`) | `h1`–`h6` | `style` attr drives level |
| `block` (style: `blockquote`) | `blockquote` | |
| `span` | text leaf | Pattern 1 marks + `markDefs` for links |
| `image` | embedded asset | `asset._ref` → asset lookup |
| Custom `_type` | Analysis Protocol | Run A1–A4 on this block type specifically |

---

## How to add a new signature

If you encounter a format repeatedly across multiple connectors:

1. Identify the fingerprint (one or two distinctive keys/values at the top level)
2. Run the Analysis Protocol once, fully, on a real sample
3. Document the node mapping table here
4. Mark any non-standard or custom node types as requiring A2 inventory check
5. Note the marks pattern and children-key

Do not add speculative signatures — only add after the Analysis Protocol has been run and the mapping has been smoke-tested against a real sample.
