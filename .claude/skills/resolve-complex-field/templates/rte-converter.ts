/**
 * RTE converter — parameterized skeleton (v4)
 *
 * This is a PATTERN, not a pre-filled source file. When resolve-complex-field
 * runs A5, it generates a converter by:
 *   1. Replacing <Cms> and <FieldName> with the real names
 *   2. Setting CHILDREN_KEY and DISCRIMINATOR to the values found in A1
 *   3. Filling one `case` per inventory type from A2
 *   4. Removing cases that don't apply to this specific source
 *
 * The node inventory comment below must be filled in for every generated converter.
 *
 * Node inventory — <SourceCms> <fieldType>
 * Discriminator field: `<key>`
 * Children-key: `<key>`
 *
 * Block nodes:
 *   <source type>   → <structural role> → <CS type>
 *
 * Leaf nodes:
 *   <source type>   → text leaf
 *
 * Reference nodes:
 *   <source type>   → reference node (block/inline)
 *
 * Marks: <Pattern 1/2/3 or mixed> — <source mark> → <CS prop>
 *
 * Fallback hits: <none | list of types that hit stringify escape hatch>
 */

// ── Discovered at runtime by Analysis Protocol ────────────────────────────────
// Set these to the values found in A1 for the specific source format.

const CHILDREN_KEY = 'children'; // the key that holds child node arrays (may not be 'children')
const DISCRIMINATOR = 'type';    // the key that identifies node type

// ── Guards (Rule 1, 3, 4 — copy verbatim, never modify) ──────────────────────

const uid = () =>
  (Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2))
    .padEnd(32, '0').slice(0, 32);

const safe = (arr: any[]): any[] =>
  arr.filter(Boolean).length ? arr.filter(Boolean) : [{ text: '' }];

// ── Marks helpers ─────────────────────────────────────────────────────────────

// Pattern 1 — marks array of strings
const MARK_MAP: Record<string, string> = {
  strong: 'bold', bold: 'bold',
  emphasis: 'italic', em: 'italic', italic: 'italic',
  underline: 'underline',
  strikethrough: 'strikethrough', strike: 'strikethrough', del: 'strikethrough',
  code: 'code',
  highlight: 'superscript', mark: 'superscript',
};

// Pattern 2 — boolean prop name variants
const PROP_MAP: Record<string, string> = {
  bold: 'bold', isBold: 'bold', b: 'bold', strong: 'bold',
  italic: 'italic', isItalic: 'italic', i: 'italic', em: 'italic',
  underline: 'underline', isUnderline: 'underline', u: 'underline',
  strikethrough: 'strikethrough', isStrikethrough: 'strikethrough',
  strike: 'strikethrough', del: 'strikethrough', s: 'strikethrough',
  code: 'code', isCode: 'code', inlineCode: 'code',
  highlight: 'superscript', isHighlight: 'superscript', superscript: 'superscript',
};

// Pattern 3 — structural wrapper nodes
const WRAPPER_MARKS: Record<string, string> = {
  strong: 'bold', b: 'bold',
  em: 'italic', i: 'italic', emphasis: 'italic',
  underline: 'underline', u: 'underline',
  strikethrough: 'strikethrough', s: 'strikethrough', del: 'strikethrough',
  code: 'code', inlineCode: 'code',
  highlight: 'superscript', mark: 'superscript',
};

function isWrapperNode(node: any): boolean {
  return typeof node[DISCRIMINATOR] === 'string' &&
    WRAPPER_MARKS[node[DISCRIMINATOR]] !== undefined &&
    Array.isArray(node[CHILDREN_KEY]);
}

function unwrapMarks(node: any, marks: Set<string> = new Set()): any | any[] {
  const mark = WRAPPER_MARKS[node[DISCRIMINATOR]];
  if (mark) marks.add(mark);

  const text = node.text ?? node.value;
  if (text !== undefined) {
    const leaf: any = { text: String(text) };
    for (const m of marks) leaf[m] = true;
    return leaf;
  }

  const children = node[CHILDREN_KEY] ?? [];
  if (children.length === 1) return unwrapMarks(children[0], marks);
  return children.map((c: any) => unwrapMarks(c, new Set(marks)));
}

function applyPattern1Marks(node: any): any {
  const leaf: any = { text: String(node.value ?? node.text ?? '') };
  for (const m of node.marks ?? []) {
    const prop = MARK_MAP[typeof m === 'string' ? m : m?.type ?? ''];
    if (prop) leaf[prop] = true;
  }
  return leaf;
}

function applyPattern2Marks(node: any): any {
  const leaf: any = { text: String(node.text ?? node.value ?? '') };
  for (const [k, v] of Object.entries(node)) {
    if (k === 'text' || k === 'value' || k === DISCRIMINATOR) continue;
    const prop = PROP_MAP[k];
    if (prop && v === true) leaf[prop] = true;
  }
  return leaf;
}

// ── Context ───────────────────────────────────────────────────────────────────

interface Ctx {
  entryIdMap: Record<string, string>;    // sourceRecordId → cs entry uid
  recordToCtUid: Record<string, string>; // sourceRecordId → cs CT uid
  assetIdMap: Record<string, any>;       // sourceAssetId → cs asset record
  locale: string;
}

// ── Children conversion (handles wrapper arrays + safe guard) ─────────────────

function convertChildren(nodes: any[] | undefined, ctx: Ctx): any[] {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .flatMap(n => {
      const r = convertNode(n, ctx);
      return Array.isArray(r) ? r : [r];
    })
    .filter(Boolean);
}

// ── Main dispatch ─────────────────────────────────────────────────────────────

function convertNode(node: any, ctx: Ctx): any | any[] | null {
  if (!node || typeof node !== 'object') return null;

  // Pattern 3 wrapper check — before switch (structural, not name-based)
  if (isWrapperNode(node)) {
    return unwrapMarks(node);
  }

  switch (node[DISCRIMINATOR]) {

    // ── Root wrapper — should not appear as a child ─────────────────────────
    case 'root':
    case 'document':
      return null;

    // ── Block nodes ─────────────────────────────────────────────────────────

    case 'paragraph':
    case 'p':
      return {
        type: 'p', uid: uid(), attrs: {},
        children: safe(convertChildren(node[CHILDREN_KEY], ctx)),
      };

    case 'heading': {
      const level = Math.min(Math.max(node.level ?? node.attrs?.level ?? 1, 1), 6);
      return {
        type: `h${level}`, uid: uid(), attrs: {},
        children: safe(convertChildren(node[CHILDREN_KEY], ctx)),
      };
    }

    case 'h1': case 'h2': case 'h3':
    case 'h4': case 'h5': case 'h6':
      return {
        type: node[DISCRIMINATOR], uid: uid(), attrs: {},
        children: safe(convertChildren(node[CHILDREN_KEY], ctx)),
      };

    case 'list':
    case 'bullet_list':
    case 'ordered_list': {
      const isOrdered =
        node.style === 'numbered' ||
        node[DISCRIMINATOR] === 'ordered_list' ||
        node.listType === 'ordered';
      return {
        type: isOrdered ? 'ol' : 'ul', uid: uid(), attrs: {},
        children: safe(convertChildren(node[CHILDREN_KEY], ctx)),
      };
    }

    case 'listItem':
    case 'list_item':
    case 'li': {
      const raw = convertChildren(node[CHILDREN_KEY], ctx);
      // Rule 4 — li children must be block nodes, wrap text leaves in p
      const children = raw.map((c: any) =>
        c.text !== undefined || !c.type
          ? { type: 'p', uid: uid(), attrs: {}, children: [c] }
          : c
      );
      return { type: 'li', uid: uid(), attrs: {}, children: safe(children) };
    }

    case 'blockquote':
    case 'block_quote':
    case 'quote':
      return {
        type: 'blockquote', uid: uid(), attrs: {},
        children: safe(convertChildren(node[CHILDREN_KEY], ctx)),
      };

    case 'code_block':
    case 'codeBlock':
    case 'pre':
    case 'fence':
      return {
        type: 'code', uid: uid(),
        attrs: { 'code-type': node.language ?? node.attrs?.language ?? '' },
        children: safe(convertChildren(node[CHILDREN_KEY], ctx)),
      };

    case 'thematicBreak':
    case 'horizontal_rule':
    case 'hr':
    case 'divider':
      return { type: 'hr', uid: uid(), attrs: {}, children: [{ text: '' }] };

    // ── Table (v4) ───────────────────────────────────────────────────────────

    case 'table':
      return {
        type: 'table', uid: uid(), attrs: {},
        children: safe(convertChildren(node[CHILDREN_KEY], ctx)),
      };

    case 'table_row':
    case 'tr':
      return {
        type: 'tr', uid: uid(), attrs: {},
        children: safe(convertChildren(node[CHILDREN_KEY], ctx)),
      };

    case 'table_cell':
    case 'td':
      return {
        type: 'td', uid: uid(), attrs: {},
        children: safe(convertChildren(node[CHILDREN_KEY], ctx)),
      };

    case 'table_header':
    case 'th':
      return {
        type: 'th', uid: uid(), attrs: {},
        children: safe(convertChildren(node[CHILDREN_KEY], ctx)),
      };

    // ── Inline nodes ─────────────────────────────────────────────────────────

    case 'link':
    case 'hyperlink':
    case 'anchor': {
      const url = node.url ?? node.href ?? node.attrs?.url ?? node.data?.uri ?? '';
      return {
        type: 'a', uid: uid(),
        attrs: { url, target: url.startsWith('http') ? '_blank' : '' },
        children: safe(convertChildren(node[CHILDREN_KEY], ctx)),
      };
    }

    // ── Leaf nodes ────────────────────────────────────────────────────────────

    case 'span':
    case 'text': {
      // Detect which marks pattern this leaf uses
      if (Array.isArray(node.marks)) return applyPattern1Marks(node);
      return applyPattern2Marks(node);
    }

    // ── Reference nodes ───────────────────────────────────────────────────────

    case 'block': {
      const sourceId = node.item ?? node.id ?? node.entryId;
      if (!sourceId) {
        console.warn('[rte-converter] block node missing id — stringify fallback');
        return { type: 'p', uid: uid(), attrs: {}, children: [{ text: JSON.stringify(node).slice(0, 200) }] };
      }
      const entryUid = ctx.entryIdMap[sourceId];
      const ctUid = ctx.recordToCtUid[sourceId];
      if (!entryUid || !ctUid) {
        console.warn(`[rte-converter] block "${sourceId}" not in lookup — stringify fallback`);
        return { type: 'p', uid: uid(), attrs: {}, children: [{ text: JSON.stringify(node).slice(0, 200) }] };
      }
      return {
        uid: uid(), type: 'reference',
        attrs: {
          'display-type': 'block', 'entry-uid': entryUid,
          'content-type-uid': ctUid, locale: ctx.locale,
          type: 'entry', 'class-name': 'embedded-entry-block',
        },
        children: [{ text: '' }],
      };
    }

    case 'inlineItem':
    case 'inline_item': {
      const sourceId = node.item ?? node.id ?? node.entryId;
      if (!sourceId) {
        console.warn('[rte-converter] inlineItem node missing id — stringify fallback');
        return { type: 'p', uid: uid(), attrs: {}, children: [{ text: JSON.stringify(node).slice(0, 200) }] };
      }
      const entryUid = ctx.entryIdMap[sourceId];
      const ctUid = ctx.recordToCtUid[sourceId];
      if (!entryUid || !ctUid) {
        console.warn(`[rte-converter] inlineItem "${sourceId}" not in lookup — stringify fallback`);
        return { type: 'p', uid: uid(), attrs: {}, children: [{ text: JSON.stringify(node).slice(0, 200) }] };
      }
      return {
        uid: uid(), type: 'reference',
        attrs: {
          'display-type': 'inline', 'entry-uid': entryUid,
          'content-type-uid': ctUid, locale: ctx.locale,
          type: 'entry', 'class-name': 'embedded-entry-inline', inline: true,
        },
        children: [{ text: '' }],
      };
    }

    case 'image':
    case 'asset':
    case 'media': {
      const sourceId = node.item ?? node.id ?? node.asset?._ref ?? node.assetId;
      const rec = sourceId ? ctx.assetIdMap[sourceId] : null;
      if (!rec) {
        console.warn(`[rte-converter] asset "${sourceId}" not in lookup — stringify fallback`);
        return { type: 'p', uid: uid(), attrs: {}, children: [{ text: JSON.stringify(node).slice(0, 200) }] };
      }
      return {
        uid: uid(), type: 'reference',
        attrs: {
          'display-type': 'display', 'asset-uid': rec.uid,
          'content-type-uid': 'sys_assets', 'asset-link': rec.urlPath,
          'asset-name': rec.title, 'asset-type': rec.content_type,
          type: 'asset', 'class-name': 'embedded-asset', inline: false,
        },
        children: [{ text: '' }],
      };
    }

    // ── Fallback ladder (v4 — nothing dropped silently) ───────────────────────

    default: {
      const children = node[CHILDREN_KEY];
      const text = node.text ?? node.value;

      // Rung 1 — has children → convert children, wrap in p
      if (Array.isArray(children) && children.length > 0) {
        console.warn(`[rte-converter] unknown type "${node[DISCRIMINATOR]}" with children → p`);
        return {
          type: 'p', uid: uid(), attrs: {},
          children: safe(convertChildren(children, ctx)),
        };
      }

      // Rung 2 — has text prop → extract as leaf
      if (text !== undefined) {
        console.warn(`[rte-converter] unknown type "${node[DISCRIMINATOR]}" with text → leaf`);
        return { text: String(text) };
      }

      // Rung 3 — matches wrapper fingerprint → handled above (isWrapperNode check)
      // If we reach here, it wasn't caught by isWrapperNode — safe to stringify.

      // Rung 4 — stringify escape hatch: content preserved, never null-dropped
      console.warn(`[rte-converter] unknown type "${node[DISCRIMINATOR]}" — stringify fallback`);
      return {
        type: 'p', uid: uid(), attrs: {},
        children: [{ text: JSON.stringify(node).slice(0, 200) }],
      };
    }
  }
}

// ── Public entry point ────────────────────────────────────────────────────────

/**
 * Converts a source RTE value to a Contentstack JSON RTE doc.
 *
 * Replace <Cms> and <FieldName> with the real names when generating.
 * Set CHILDREN_KEY and DISCRIMINATOR at the top of the file.
 *
 * @param value          Raw field value from the source export record
 * @param entryIdMap     sourceRecordId → cs entry uid
 * @param recordToCtUid  sourceRecordId → cs CT uid
 * @param assetIdMap     sourceAssetId → cs asset record object
 * @param locale         Master locale string (e.g. 'en-us')
 */
export function convert<Cms><FieldName>ToCSRte(
  value: unknown,
  entryIdMap: Record<string, string> = {},
  recordToCtUid: Record<string, string> = {},
  assetIdMap: Record<string, any> = {},
  locale = 'en-us',
): Record<string, unknown> {
  const emptyDoc = () => ({
    type: 'doc', uid: uid(), attrs: {},
    children: [{ type: 'p', uid: uid(), attrs: {}, children: [{ text: '' }] }],
  });

  // Adversarial input guard — null, undefined, {}, [] all return empty doc
  if (!value || typeof value !== 'object') return emptyDoc();
  if (Array.isArray(value) && value.length === 0) return emptyDoc();

  const ctx: Ctx = { entryIdMap, recordToCtUid, assetIdMap, locale };

  // Handle wrapper formats: { schema:'dast', document:{...} } or { type:'doc', content:[...] }
  // Adapt this unwrap for the specific source format found in Step 0
  const raw = value as any;
  const root = raw.document ?? raw;

  // For array-root formats (Portable Text), wrap in doc manually:
  // if (Array.isArray(value)) {
  //   return { type: 'doc', uid: uid(), attrs: {}, children: safe(convertChildren(value as any[], ctx)) };
  // }

  if (!root[CHILDREN_KEY] && !Array.isArray(root)) return emptyDoc();

  const rootChildren = Array.isArray(root)
    ? root
    : root[CHILDREN_KEY];

  const children = safe(convertChildren(rootChildren, ctx));

  return { type: 'doc', uid: uid(), attrs: {}, children };
}
