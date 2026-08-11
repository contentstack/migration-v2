# Marks Patterns — Detection and Normalization

Marks (bold, italic, etc.) appear in three distinct structural patterns across different CMSes. Detection is **per-node**, not per-document — a single source document can mix all three patterns. All three normalize to the same CS text leaf shape.

---

## Pattern 1 — Marks array on a span/leaf node

The leaf node carries a `marks` array of string names alongside its text value.

**Source shape:**
```json
{ "type": "span", "marks": ["strong", "emphasis"], "value": "Hello" }
{ "type": "text", "marks": ["bold", "underline"], "text": "World" }
```

**Detection signal:** node has both a text-bearing property (`text` or `value`) AND a `marks` array property.

**Normalization:** map each mark string to its CS boolean prop:

| Source mark string | CS boolean |
|---|---|
| `strong` / `bold` | `bold: true` |
| `emphasis` / `em` / `italic` | `italic: true` |
| `underline` | `underline: true` |
| `strikethrough` / `strike` / `del` | `strikethrough: true` |
| `code` | `code: true` |
| `highlight` / `mark` | `superscript: true` |

**Output:**
```json
{ "text": "Hello", "bold": true, "italic": true }
```

**Code:**
```ts
const MARK_MAP: Record<string, string> = {
  strong: 'bold', bold: 'bold',
  emphasis: 'italic', em: 'italic', italic: 'italic',
  underline: 'underline',
  strikethrough: 'strikethrough', strike: 'strikethrough', del: 'strikethrough',
  code: 'code',
  highlight: 'superscript', mark: 'superscript',
};

function convertSpan(node: any): any {
  const leaf: any = { text: String(node.value ?? node.text ?? '') };
  for (const m of node.marks ?? []) {
    const prop = MARK_MAP[m];
    if (prop) leaf[prop] = true;
  }
  return leaf;
}
```

---

## Pattern 2 — Boolean props already on the leaf

The leaf node already has formatting as boolean properties. May use canonical names (`bold`) or variant names (`isBold`, `b`, `strong`).

**Source shape:**
```json
{ "text": "Hello", "bold": true, "italic": true }
{ "text": "World", "isBold": true, "isItalic": true }
{ "text": "Foo", "b": true, "i": true }
```

**Detection signal:** node has a text-bearing property AND one or more formatting-named boolean properties. No `marks` array.

**Normalization:** map variant prop names to CS canonical names. Canonical names pass through unchanged.

| Source prop | CS prop |
|---|---|
| `bold` / `isBold` / `b` / `strong` | `bold` |
| `italic` / `isItalic` / `i` / `em` | `italic` |
| `underline` / `isUnderline` / `u` | `underline` |
| `strikethrough` / `isStrikethrough` / `strike` / `del` / `s` | `strikethrough` |
| `code` / `isCode` / `inlineCode` | `code` |
| `highlight` / `isHighlight` / `superscript` | `superscript` |

**Code:**
```ts
const PROP_MAP: Record<string, string> = {
  bold: 'bold', isBold: 'bold', b: 'bold', strong: 'bold',
  italic: 'italic', isItalic: 'italic', i: 'italic', em: 'italic',
  underline: 'underline', isUnderline: 'underline', u: 'underline',
  strikethrough: 'strikethrough', isStrikethrough: 'strikethrough',
  strike: 'strikethrough', del: 'strikethrough', s: 'strikethrough',
  code: 'code', isCode: 'code', inlineCode: 'code',
  highlight: 'superscript', isHighlight: 'superscript', superscript: 'superscript',
};

function convertLeaf(node: any): any {
  const leaf: any = { text: String(node.text ?? node.value ?? '') };
  for (const [k, v] of Object.entries(node)) {
    if (k === 'text' || k === 'value') continue;
    const prop = PROP_MAP[k];
    if (prop && v === true) leaf[prop] = true;
  }
  return leaf;
}
```

---

## Pattern 3 — Wrapper nodes

Formatting is expressed as structural wrappers — each mark is a node that wraps its children. These nest arbitrarily.

**Source shape:**
```json
{
  "type": "strong",
  "children": [{
    "type": "em",
    "children": [{ "text": "Hello" }]
  }]
}
```

**Detection signal (structural):** node has a children-key AND only contains inline/text nodes (no block-level siblings). The node's type matches a known mark name (or matches the MARK_MAP). These are never block nodes — do not render them as `p` or any block type.

⚠️ **Never block-render a wrapper.** A wrapper inside a paragraph is an inline mark, not a separate block.

**Normalization:** walk down recursively, collecting mark types into a Set, apply the full set to the innermost text leaf.

**Code:**
```ts
const WRAPPER_MARKS: Record<string, string> = {
  strong: 'bold', b: 'bold',
  em: 'italic', i: 'italic', emphasis: 'italic',
  underline: 'underline', u: 'underline',
  strikethrough: 'strikethrough', s: 'strikethrough', del: 'strikethrough',
  code: 'code', inlineCode: 'code',
  highlight: 'superscript', mark: 'superscript',
};

function isWrapperNode(node: any): boolean {
  return WRAPPER_MARKS[node.type] !== undefined;
}

function unwrapMarks(node: any, marks: Set<string> = new Set()): any | any[] {
  if (WRAPPER_MARKS[node.type]) marks.add(WRAPPER_MARKS[node.type]);

  // Leaf — has text or value, no children (or children is empty)
  const text = node.text ?? node.value;
  if (text !== undefined) {
    const leaf: any = { text: String(text) };
    for (const m of marks) leaf[m] = true;
    return leaf;
  }

  // Single child — recurse
  const children = node[CHILDREN_KEY] ?? node.children ?? [];
  if (children.length === 1) return unwrapMarks(children[0], marks);

  // Multiple children — each inherits the collected marks
  return children.map((c: any) => unwrapMarks(c, new Set(marks)));
}
```

When `unwrapMarks` returns an array (multiple children), the caller must flatten it into the parent's children array.

---

## Mixed patterns in one document

Some sources use Pattern 1 for most nodes but Pattern 3 for specific inline styles. Detection must happen per-node:

```ts
function convertNode(node: any, ctx: Ctx): any | any[] | null {
  // Check Pattern 3 first — structural wrapper check
  if (isWrapperNode(node)) return unwrapMarks(node);

  switch (node[DISCRIMINATOR]) {
    case 'span':
    case 'text':
      // Check Pattern 1
      if (Array.isArray(node.marks)) return convertSpan(node);
      // Check Pattern 2
      return convertLeaf(node);

    // ... other cases
  }
}
```

---

## Inline code — always a mark, never a block

A node with `type: 'code'` that wraps a single short text node and appears **inside** a paragraph is always a mark — Pattern 3:
```json
{ "type": "code", "children": [{ "text": "x.foo()" }] }
→ { "text": "x.foo()", "code": true }
```

Only when a code node appears at the block level (direct child of root/paragraph-container) AND has a language attribute AND its children are text lines → CS `code` block node with `attrs: {'code-type': lang}`.

Position in the tree determines which it is.
