---
name: resolve-complex-field
description: Analyzes any CMS field structure — known or completely unknown — and generates a Contentstack-compatible converter from scratch. Vocabulary-independent, source-agnostic, zero silent drops. Use when add-cms-connector hits a complex field or when an existing connector produces blank or wrong output for a specific field.
---

# resolve-complex-field

> **Design principle — target-oracle, not source-templates.**
> The only fixed knowledge is the target. The five CS hard rules are the invariant contract — everything about the source is discovered at runtime from the sample value. Known-format signatures exist only as an optional shortcut registry, never as the design center. If every signature check fails, the generic path still produces structurally valid output.

This skill exists because type names lie. A field named `rich_text` may contain modular blocks. A field named `structured_text` may use DAST, a proprietary tree, or something never seen before. A field named `json` may crash the CS CLI if passed non-RTE content.

Correctness never depends on recognizing the source. The skill analyses the **actual sample value shape** and produces a converter that satisfies the CS hard rules — not a template with `// ADAPT` gaps.

> Read `reference/cs-rte-spec.md` — the target oracle. Every output node must satisfy the CS hard rules.
> Read `reference/node-inference.md` — structural roles + two-stage name refinement.
> Read `reference/marks-patterns.md` — the three marks patterns and per-node detection.
> Read `reference/signatures.md` — optional shortcut registry for known formats (DAST, Contentful, etc.).
> Read `reference/modular-blocks.md` — the two block embedding patterns.

## When this skill is invoked

**Auto — from `add-cms-connector` Step 1b:**
Any field whose sample value is a structured object or array (not a primitive) triggers this skill before connector code is generated.

**Manual — standalone:**
When an existing connector produces blank, null, or wrong output for a specific field. Pass the raw sample value — no prior knowledge of the source format needed.

## Inputs

1. **Source CMS name** — e.g. `datocms`, `sanity`, `strapi`
2. **Source field type name** — e.g. `structured_text`, `rich_text`, `blocks` (context only — never the mapping decision)
3. **Sample field value** — the actual raw JSON value from a real export record (this drives everything)
4. **Path to the connector's `schemaMapper.ts`** — Layer A, the parser package
5. **Path to the connector's service file** — Layer C, e.g. `api/src/services/datocms.service.ts`

If any input is missing, ask for it. The sample field value is mandatory — do not invent or guess the structure.

## CS hard rules — the invariant contract

Source-independent. Every generated converter is validated against these. Each one, if violated, crashes the CS CLI or silently drops the entry.

**Rule 1 — Every non-leaf node has `uid` — hex, no hyphens.**
```ts
const uid = () =>
  (Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2))
    .padEnd(32, '0').slice(0, 32);
```
Two random segments concatenated — full 32-hex entropy. Never pass a UUID or `undefined`.

**Rule 2 — `attrs: {}` always present, always an object.**
Even when a node has no attributes. Only `a` (`{url, target}`), `code` block (`{'code-type': lang}`), and reference nodes populate it — but the key must exist on every node.

**Rule 3 — `children` never null or empty on block nodes.**
Guard at every level, not just the root. Minimum safe value: `[{text:''}]`.
```ts
const safe = (arr: any[]) =>
  arr.filter(Boolean).length ? arr.filter(Boolean) : [{ text: '' }];
```
Call `safe()` on **every** children array assignment.

**Rule 4 — `li` children must be block nodes, never raw text.**
Any text-leaf inside a list item gets wrapped in `p` before output, regardless of source shape. Apply the `li` guard **before** the `safe()` guard.

**Rule 5 — CS type `json` means JSON RTE only — never arbitrary data.**
Non-RTE structured objects crash on `.children.forEach()`. Map them to `multi_line_text` + `JSON.stringify` instead.

## Workflow

### Step 0 — Check signature registry first

Before running the full Analysis Protocol, check `reference/signatures.md` for a fingerprint match on the sample value. A match means a pre-verified template is available — skip directly to A5 using that template.

No match → proceed to Step 1 (full generic path). **Adding a new CMS never requires touching the signature registry.**

### Step 1 — Classify the field (structural only)

Walk the sample value. Names are hints — structure decides:

```
sample value
│
├─ Recursive tree?  objects containing arrays of objects, ≥2 levels,
│  sharing a repeated key (children / content / nodes / …)
│   └─ YES → RTE-like document → Analysis Protocol (Step 2)
│
├─ Flat array of objects, each with a discriminator key?
│   └─ YES → Modular blocks → Step 3A
│
├─ Single object, fixed stable key set, no recursion?
│   └─ YES → Group → Step 3B
│
└─ Anything else  (irregular / opaque / mixed)
    └─ Custom JSON → Step 3C  (Rule 5)
```

**Tree detection — find the children-key:**
Walk the sample. Find the key whose value is most often an array of objects **and** which appears at multiple depths. If nesting depth ≥ 2, it's a tree. Record that key as the **children-key** — it may not be called `children`. The converter is parameterized on whatever key it is.

### Step 2 — Analysis Protocol (for tree-shaped documents)

**Run before writing any code.** Every step is defined structurally — works on vocabulary the skill has never seen.

#### A1 — Find the discriminator (coverage-first)

Walk every object in the sample tree. Collect all short-string-valued keys as candidates (`type`, `nodeType`, `_type`, `kind`, `tag` seeded first, but any qualifying key competes).

Selection rule:
1. **Primary: coverage** — present on > 90% of nodes
2. **Tiebreak: distinct values** — must be ≥ 2
3. **No key passes** → classify per-node by shape alone (string-valued = leaf, has children-key = block)

The converter's main `switch` branches on this field.

> v4 note: "most distinct values wins" (v3) misroutes when a coarse `type` coexists with a richer orthogonal key. Coverage-first is more reliable.

#### A2 — Build the node inventory

For every distinct discriminator value across the entire sample tree, record its structural fingerprint:
- Has children-key array? → block node
- Has a text-bearing property (`text`, `value`, `content` as string)? → leaf node
- Has formatting hints? (boolean props / marks array / wrapper shape) → which marks pattern — see `reference/marks-patterns.md`
- Has a reference-bearing property? (uuid-ish string, `_ref`, `itemId`, `item`) → reference/embed candidate
- Has a media hint? (URL string, mime type, dimensions object) → embedded asset candidate
- Remaining attribute payload keys → attrs

**Coverage guarantee:** every inventory value gets an explicit `case` handler. No `// ADAPT` gaps — the case list is derived from the sample, not templated.

#### A3 — Infer CS type — structure first, names second

**Stage 1 — structural role decides:**

| Fingerprint | → Role |
|---|---|
| Text-bearing, no children | Text leaf |
| Children of only text/inline nodes | Paragraph-like → `p` |
| Children of only blocks, no payload | Wrapper → pass-through or `p`-wrap |
| Repeated homogeneous item-like children | List → `ol`/`ul` + `li` |
| Grid pattern — uniform row width | `table` → `tr` → `td`/`th` |
| Reference-bearing property | CS reference node (block/inline by position) |
| Media-hinted | Embedded asset node |
| No children, no text, no payload | Void → `hr` + `children:[{text:''}]` |

**Stage 2 — name refinement, narrows only:**
After structural role is decided, check if the node's discriminator value matches a known semantic name. If it matches, upgrade the role. If it doesn't match, keep the structural role — a node called `absatz` or `blok_tekstowy` still lands as `p` instead of falling through.

Name → CS type upgrades:
- `heading` + `level` attr → `h1`–`h6`
- `quote` / `blockquote` / `block_quote` → `blockquote`
- `pre` / `fence` / `code_block` / `codeBlock` → `code` block
- `hyperlink` / `link` / `anchor` → `a`
- `bullet_list` / `unordered_list` / `ul` → `ul`
- `ordered_list` / `numbered_list` / `ol` → `ol`
- `list_item` / `listItem` / `li` → `li`
- `table_row` / `tr` → `tr`
- `table_cell` / `td` → `td`
- `table_header` / `th` → `th`
- `horizontal_rule` / `thematic_break` → `hr`

Log every inference as `source type → structural role → CS type` so misroutes are auditable.

#### A4 — Marks detection + normalization (per-node)

Sources can **mix** patterns — detection is per-node, not per-document. See `reference/marks-patterns.md` for full detail. All three patterns normalize to the same CS text leaf shape.

**Pattern 1 — marks array on span:**
```
{ type: 'span', marks: ['strong', 'em'], value: 'text' }
→ { text: 'text', bold: true, italic: true }
```

**Pattern 2 — boolean props on leaf (map name variants: isBold / b / strong → bold):**
```
{ text: 'text', bold: true }  →  pass through
{ text: 'text', isBold: true }  →  { text: 'text', bold: true }
```

**Pattern 3 — wrapper nodes (detected structurally — inline-only children, no payload):**
```
{ type: 'strong', children: [{ type: 'em', children: [{ text: 'hi' }] }] }
→ unwrap recursively, collect marks into a Set, apply to innermost leaf
⚠ never block-render a wrapper node
```

Inline code is always a mark (`code: true` on leaf). Only block-level code nodes with their own discriminator value and block children become CS `code` blocks with `attrs: {'code-type': lang}`.

#### A5 — Generate the converter with all guards baked in

Use `templates/rte-converter.ts` as the parameterized pattern. The template is NOT pre-filled — it is a structural skeleton adapted to the specific inventory from A2.

**Every case in the generated converter must:**
- Call `uid()` on every non-leaf node created
- Set `attrs: {}` (populated only for `a`, `code` block, reference nodes)
- Wrap children with `safe()` on every assignment
- Apply `li` guard (wrap text-leaf children in `p`) before `safe()`
- Read `node[CHILDREN_KEY]`, never hardcoded `children`

**Fallback ladder — nothing dropped silently:**

| Condition | Action |
|---|---|
| Unknown type + has children | Convert children, wrap in `p`, warn |
| Unknown type + has text prop | Extract as text leaf, warn |
| Matches wrapper fingerprint | Unwrap as marks (Pattern 3), warn |
| None of the above | **Stringify escape hatch**: `{ type:'p', uid:uid(), attrs:{}, children:[{ text: JSON.stringify(node).slice(0,200) }] }` + warn |

> v4: The stringify escape hatch replaces `return null` from v3. Content is always preserved visibly — zero silent content loss guaranteed. A null-dropped node looks like "it migrated" when it didn't. A stringified fallback is ugly but honest.

**Outputs:**
- Node inventory comment at the top of the converter (source type → structural role → CS type, one line per type)
- `convert<Cms><FieldName>ToCSRte(value, entryIdMap, recordToCtUid, locale)` function
- Updated `case 'json'` in the service file

### Step 3A — Modular blocks (flat array with type discriminator)

The sample is an array where each element carries a type discriminator with ≥ 2 distinct values.

**Schema fix (Layer A — `schemaMapper.ts`):**
Emit `modular_blocks` parent row + one `modular_blocks_child` row per distinct type + field rows per block. See `reference/modular-blocks.md` for the exact row format.

If any block's fields are themselves complex (nested RTE, nested array with discriminator), **recurse into this skill** for those fields before writing the parent converter.

Standalone CTs — only when a block type is reused across ≥ 2 fields. Flag in the report. Inline schema otherwise.

**Entry value (Layer C — service file):**
```json
[
  { "<blockTypeUid1>": { "fieldA": "value" } },
  { "<blockTypeUid2>": { "fieldC": "value" } }
]
```

No converter function needed — value is a structured object, not an RTE tree.

### Step 3B — Group (single object, fixed key set)

Update `schemaMapper.ts` to emit `group` with children derived from the sample's keys. Use `advanced.multiple: true` for arrays of objects.

If any child value is itself complex, **recurse into this skill** for that child field.

No converter needed — existing `case 'group'` in the service handles it. See `add-cms-connector/reference/entry-creation.md` § Nested groups for the dotted-child contract.

### Step 3C — Custom JSON (non-RTE, no tree structure)

Map to `multi_line_text` in `schemaMapper.ts`. Serialize with `JSON.stringify(value)` in the service file.

**Never use CS type `json` for this.** Rule 5.

### Step 4 — Smoke test

Generate and run a throwaway test script. Delete it after all passes.

```ts
import { convert<Cms><Field>ToCSRte } from './path/to/converter';

// Check 1 — shape
const result = convert<Cms><Field>ToCSRte(sample);
console.assert(result.type === 'doc', 'root type');
console.assert(Array.isArray(result.children) && result.children.length > 0, 'children');

// Check 2 — inventory coverage
// Every type from the A2 inventory must appear in the output, or be
// explicitly logged as merged (wrappers). Add one assert per inventory type.

// Check 3 — structural walk (the oracle check)
function walk(node: any, path: string) {
  if (!node || typeof node !== 'object') return;
  if (node.text !== undefined) return; // leaf — ok
  console.assert(
    typeof node.uid === 'string' && node.uid.length === 32 && !node.uid.includes('-'),
    `uid missing/invalid at ${path}`
  );
  console.assert(node.attrs !== undefined, `attrs missing at ${path}`);
  console.assert(
    Array.isArray(node.children) && node.children.filter(Boolean).length > 0,
    `children empty at ${path}`
  );
  if (node.type === 'li') {
    node.children.forEach((c: any, i: number) =>
      console.assert(c?.type && c.text === undefined, `li child ${i} at ${path} is not a block`)
    );
  }
  node.children.forEach((c: any, i: number) => walk(c, `${path}.children[${i}]`));
}
walk(result, 'root');

// Check 4 — adversarial inputs (must return valid doc or preserved fallback, never throw)
[null, undefined, {}, [], { type: 'root', children: [{ type: '__UNKNOWN_XYZ__', text: 'hi' }] }]
  .forEach(input => {
    const r = convert<Cms><Field>ToCSRte(input);
    console.assert(r?.type === 'doc', `adversarial input produced invalid root: ${JSON.stringify(input)}`);
  });

// Check 5 — typecheck
// npx tsc --noEmit  →  no new errors in edited files
```

Report results honestly — if any assert fails, fix the converter before calling the skill done.

## Report format — per invocation

After completing, output:
1. **File + line** changed in `schemaMapper.ts`
2. **Converter location** (file path)
3. **Full inference table** — `source type → structural role → CS type` (one row per inventory type)
4. **Marks pattern(s) detected** — Pattern 1 / 2 / 3 or mixed, per node
5. **Fallback-ladder hits** — any nodes that triggered the stringify escape hatch (with their type names)
6. **Blocks needing standalone CTs** — if any block type appears in ≥ 2 fields
7. **Structural-walk result** — pass / fail with assertion detail

## What gets written to disk

| Category | Layer A change | Layer C change |
|---|---|---|
| RTE (any format) | `schemaMapper.ts` — `case` → `json` | New `convert*ToCSRte()` function; `case 'json'` update in service |
| Modular blocks | `schemaMapper.ts` — parent + child + field rows | Entry transform handles blocks array |
| Group | `schemaMapper.ts` — `group` + dotted children | Existing `case 'group'` handles it |
| Custom JSON | `schemaMapper.ts` — `multi_line_text` | `JSON.stringify(value)` in service |
