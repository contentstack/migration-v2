import type { RenderingPlacement } from './renderings.interface.js';

// Parser for Sitecore's `__renderings` layout XML — the field that records a page's
// component composition. See renderings.interface.ts for what the attributes mean.
//
// The field is stored as escaped XML *inside* an XML document, so by the time it
// reaches here it has been escaped twice: the on-disk bytes read `&amp;lt;r ...`, which
// one unescape turns into `&lt;r ...` and a second into real markup. Unescaping only
// once leaves the payload looking like text and yields zero placements, which is the
// most likely way to silently migrate every page with no components.

const RENDERING_TAG_RE = /<r\b([^>]*?)\/?>/g;
const ATTR_RE = /([a-zA-Z:]+)="([^"]*)"/g;
// `p:after="r[@uid='{GUID}']"` — the uid of the placement this one follows.
const AFTER_UID_RE = /@uid='([^']*)'/;
const DEVICE_TAG_RE = /<d\b([^>]*?)>/g;

const XML_ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  // `&amp;` must be replaced last or it would re-introduce entities that were already
  // decoded — `&amp;lt;` would become `&lt;` and then wrongly decode again on this pass.
  '&amp;': '&',
};

/** Decode one level of XML entity escaping. */
export function unescapeXml(value: string): string {
  if (!value || typeof value !== 'string') return '';
  let out = value;
  for (const [entity, char] of Object.entries(XML_ENTITIES)) {
    out = out.split(entity).join(char);
  }
  return out;
}

/**
 * Parse a rendering parameters query string (`s:par`).
 *
 * The format is `key=value&key2=value2`, but Sitecore also writes bare keys with no
 * `=` (`CSSStyles`), which are kept with an empty value — their presence is the signal.
 * Values are percent-encoded; GUIDs arrive as `%7BGUID%7D` and decode back to braces.
 */
export function parseRenderingParameters(raw?: string): Record<string, string> {
  const params: Record<string, string> = {};
  const decoded = unescapeXml(`${raw ?? ''}`).trim();
  if (!decoded) return params;

  for (const pair of decoded.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    const rawValue = eq === -1 ? '' : pair.slice(eq + 1);
    const key = safeDecode(rawKey).trim();
    if (!key) continue;
    params[key] = safeDecode(rawValue).trim();
  }
  return params;
}

// Authored parameter values are not guaranteed to be well-formed percent-encoding;
// a stray `%` would make decodeURIComponent throw and lose the whole placement.
function safeDecode(value: string): string {
  const plussed = `${value ?? ''}`.replace(/\+/g, ' ');
  try {
    return decodeURIComponent(plussed);
  } catch {
    return plussed;
  }
}

/**
 * Order placements using the `p:after` chain.
 *
 * Sitecore records order as a linked list rather than document order: each placement
 * names the one it follows. The chain is rebuilt here into a sequence.
 *
 * Real packages contain broken chains — a `p:after` naming a placement that was
 * deleted, or two placements claiming the same predecessor. Rather than dropping those
 * (which would lose components), anything not reachable through the chain is appended
 * in document order, so every placement always survives.
 */
export function orderPlacements(
  placements: RenderingPlacement[]
): RenderingPlacement[] {
  if (placements.length < 2) return placements;

  const byUid = new Map<string, RenderingPlacement>();
  for (const p of placements) {
    if (p.uid) byUid.set(p.uid, p);
  }

  // successor[x] = the placement that declares it comes after x.
  const successor = new Map<string, RenderingPlacement>();
  const hasPredecessor = new Set<RenderingPlacement>();
  for (const p of placements) {
    const afterUid = p.after ? AFTER_UID_RE.exec(p.after)?.[1] : undefined;
    // A predecessor that isn't in this document (deleted placement) is treated as no
    // predecessor, so the placement becomes a chain head instead of being unreachable.
    if (!afterUid || !byUid.has(afterUid)) continue;
    // First claim wins; a duplicate claim falls through to the document-order pass.
    if (successor.has(afterUid)) continue;
    successor.set(afterUid, p);
    hasPredecessor.add(p);
  }

  const ordered: RenderingPlacement[] = [];
  const emitted = new Set<RenderingPlacement>();

  // Walk each chain from its head, in document order of the heads.
  for (const head of placements) {
    if (hasPredecessor.has(head) || emitted.has(head)) continue;
    let cursor: RenderingPlacement | undefined = head;
    while (cursor && !emitted.has(cursor)) {
      ordered.push(cursor);
      emitted.add(cursor);
      cursor = successor.get(cursor.uid);
    }
  }

  // Anything left is part of a cycle, or lost a duplicate-predecessor race. Append in
  // document order so a malformed chain degrades to "unordered" rather than "missing".
  for (const p of placements) {
    if (!emitted.has(p)) {
      ordered.push(p);
      emitted.add(p);
    }
  }

  return ordered;
}

/**
 * Parse a `__renderings` field into its ordered placements.
 *
 * Returns `[]` for anything unparseable — an entry with no components is a valid and
 * common outcome, and throwing here would abort a whole content type's migration.
 */
export function parseLayoutXml(content?: string): RenderingPlacement[] {
  if (!content || typeof content !== 'string') return [];

  // Double-escaped on disk; see the module comment. Unescaping a string that was only
  // singly escaped is harmless, so this is safe for both shapes.
  let xml = unescapeXml(content);
  if (xml.includes('&lt;') || xml.includes('&amp;')) {
    xml = unescapeXml(xml);
  }
  if (!xml.includes('<r')) return [];

  // Every package observed uses a single device. If a package ever ships more, the
  // first device wins and the rest are ignored rather than merged — merging would
  // interleave two independent layouts into one component list.
  xml = firstDeviceOnly(xml);

  const placements: RenderingPlacement[] = [];
  RENDERING_TAG_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = RENDERING_TAG_RE.exec(xml)) !== null) {
    const attrs = readAttributes(match[1]);
    const renderingId = attrs['s:id'];
    // `<r uid="..."><p:d /></r>` entries carry no `s:id`: they are personalization
    // placeholders, not components, and have nothing to migrate.
    if (!renderingId) continue;

    placements.push({
      uid: attrs['uid'] ?? attrs['s:uid'] ?? '',
      renderingId,
      datasource: attrs['s:ds'] ?? '',
      placeholder: attrs['s:ph'] ?? '',
      parameters: parseRenderingParameters(attrs['s:par']),
      after: attrs['p:after'],
    });
  }

  return orderPlacements(placements);
}

// Narrow the document to the first `<d>` element's content when more than one device
// is present. Returns the input untouched for the single-device case.
function firstDeviceOnly(xml: string): string {
  DEVICE_TAG_RE.lastIndex = 0;
  const first = DEVICE_TAG_RE.exec(xml);
  if (!first) return xml;
  const second = DEVICE_TAG_RE.exec(xml);
  if (!second) return xml;
  return xml.slice(first.index, second.index);
}

function readAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(raw)) !== null) {
    attrs[m[1]] = unescapeXml(m[2]);
  }
  return attrs;
}

/** Strip braces/hyphens and lowercase — the canonical Sitecore GUID → uid rule. */
export function normalizeGuid(guid?: string): string {
  return `${guid ?? ''}`.replace(/[-{}]/g, '').toLowerCase();
}
