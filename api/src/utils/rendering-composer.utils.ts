import { parseLayoutXml, normalizeGuid } from './renderings.utils.js';
import {
  RENDERING_BLOCK_FIELDS as F,
  RENDERING_FALLBACK_BLOCK,
} from './renderings.interface.js';
import type {
  RenderingPlacement,
  RenderingBlockDescriptor,
  ComposeComponentsArgs,
} from './renderings.interface.js';

// Writes the entry-side value for a page's `components` field: the ordered list of
// modular blocks that replaces Sitecore's `__renderings` layout XML.
//
// This cannot live in entriesFieldCreator's switch. That switch is driven by the loop in
// sitecore.service.ts, which walks the item's *fields* and matches each against
// fieldMapping — and `__renderings` is filtered out by isSkippableSystemField before it
// ever reaches a match. So composition runs as a separate step, in the same spirit as
// the inherited-global-field fallback that already sits alongside that loop.
//
// A content type derived from a Sitecore folder template (`page content folder` ->
// `page_content_folder`). Matches the FOLDER_TEMPLATE_RE the mapper uses, after uid
// correction has turned spaces into underscores.
const FOLDER_CONTENT_TYPE_RE = /(^|_)folder$/i;

// The block a placement lands in is keyed by its datasource's content type, matching how
// the mapper chose blocks (upload-api/migration-sitecore/libs/observedRenderings.js).
// Anything without a dedicated block — no datasource, an unresolvable one, or a
// below-threshold template — goes to the shared fallback block, so a component is never
// silently dropped.

/**
 * Read the block descriptors back out of the flat fieldMapping.
 *
 * The mapping is flat with dotted uids (`components.page_content.datasource`), so the
 * blocks that exist and the content type each one accepts are recovered by walking the
 * rows rather than being passed in separately. That keeps this in step with whatever the
 * mapper emitted, including the user's edits in the mapper UI.
 */
export function readBlockDescriptors(
  fieldMapping: any[],
  componentsUid: string
): RenderingBlockDescriptor[] {
  const blocks = new Map<string, RenderingBlockDescriptor>();
  const prefix = `${componentsUid}.`;

  for (const row of fieldMapping ?? []) {
    const uid = `${row?.contentstackFieldUid ?? ''}`;
    if (!uid.startsWith(prefix)) continue;
    const rest = uid.slice(prefix.length);
    const parts = rest.split('.');
    const blockUid = parts[0];
    if (!blockUid) continue;

    if (!blocks.has(blockUid)) {
      blocks.set(blockUid, { blockUid, contentTypeUids: [], isFallback: false });
    }
    const block = blocks.get(blockUid) as RenderingBlockDescriptor;

    if (parts.length === 1) {
      block.isFallback = blockUid === RENDERING_FALLBACK_BLOCK;
      continue;
    }
    if (parts[1] === F.datasource && Array.isArray(row?.refrenceTo)) {
      for (const ct of row.refrenceTo) {
        if (ct && !block.contentTypeUids.includes(ct)) block.contentTypeUids.push(ct);
      }
    }
  }

  return [...blocks.values()];
}

/**
 * Find the entry a datasource GUID points at, and the content type it belongs to.
 *
 * Mirrors the verification the `reference` case already does in
 * entries-field-creator.utils.ts: an id is only usable once it is confirmed present in
 * this locale, so a dangling datasource degrades to the fallback block instead of
 * emitting a reference that points at nothing.
 */
function resolveDatasourceEntry({
  guid,
  entriesData,
  locale,
  idCorrector,
  uidCorrector,
}: any): { uid: string; contentTypeUid: string } | null {
  const uid = typeof idCorrector === 'function' ? idCorrector({ id: guid }) : normalizeGuid(guid);
  if (!uid) return null;

  for (const template of entriesData ?? []) {
    if (template?.locale?.[locale]?.[uid]) {
      return {
        uid,
        contentTypeUid:
          typeof uidCorrector === 'function'
            ? uidCorrector({ uid: template?.template })
            : `${template?.template ?? ''}`,
      };
    }
  }
  return null;
}

/**
 * Expand a datasource into the entries whose content the component actually renders.
 *
 * Usually one entry. But a rendering may point at a *folder* and render its children —
 * on the giftcards page 5 of 6 components do exactly that — and a folder holds no
 * content of its own, so it must be expanded or the page migrates almost empty.
 *
 * A folder is recognised by its *template name*, not by failing to resolve as an entry:
 * Sitecore folders are ordinary items and do migrate as entries of a `… folder` content
 * type, so "did it resolve" would always say yes and the children would never be
 * reached. `childIndex` is supplied by the caller from the same pass the mapper used, so
 * both sides agree on what a folder's contents are.
 */
function expandDatasource({
  guid,
  entriesData,
  locale,
  idCorrector,
  uidCorrector,
  childIndex,
}: any): Array<{ uid: string; contentTypeUid: string }> {
  const direct = resolveDatasourceEntry({
    guid,
    entriesData,
    locale,
    idCorrector,
    uidCorrector,
  });
  if (direct && !FOLDER_CONTENT_TYPE_RE.test(direct.contentTypeUid)) {
    return [direct];
  }

  const children = childIndex?.[`${guid ?? ''}`.toUpperCase()] ?? [];
  const out: Array<{ uid: string; contentTypeUid: string }> = [];
  for (const child of children) {
    const resolved = resolveDatasourceEntry({
      guid: child,
      entriesData,
      locale,
      idCorrector,
      uidCorrector,
    });
    // Depth 1 only: a nested folder holds no content either, and recursing would pull
    // unrelated subtrees into the page.
    if (resolved && !FOLDER_CONTENT_TYPE_RE.test(resolved.contentTypeUid)) {
      out.push(resolved);
    }
  }
  // A folder that expanded to nothing usable still has to render something, so fall
  // back to the folder entry itself rather than losing the placement.
  if (!out.length && direct) return [direct];
  return out;
}

/** Fields every block carries, dedicated or fallback. */
function commonBlockFields(
  placement: RenderingPlacement,
  renderingName: string
): Record<string, any> {
  return {
    [F.placeholder]: placement.placeholder ?? '',
    [F.renderingId]: placement.renderingId ?? '',
    [F.renderingName]: renderingName,
    // Params are sparse and untyped in the source, so they travel as one JSON value
    // rather than becoming schema. See the mapper for the measurement behind that.
    [F.parameters]: placement.parameters ?? {},
  };
}

/**
 * Turn one page's `__renderings` field into its `components` value.
 *
 * Returns `[]` when the page has no layout or no usable placements — a page with no
 * components is a normal outcome and must not fail the entry.
 */
export function composeComponents({
  layoutContent,
  fieldMapping,
  componentsUid,
  entriesData,
  locale,
  idCorrector,
  uidCorrector,
  renderingNames,
  childIndex,
}: ComposeComponentsArgs): any[] {
  const placements = parseLayoutXml(layoutContent);
  if (!placements.length) return [];

  const blocks = readBlockDescriptors(fieldMapping, componentsUid);
  if (!blocks.length) return [];

  // content type uid -> block uid, so a resolved datasource picks its block directly.
  const blockForContentType = new Map<string, string>();
  for (const block of blocks) {
    if (block.isFallback) continue;
    for (const ct of block.contentTypeUids) {
      if (!blockForContentType.has(ct)) blockForContentType.set(ct, block.blockUid);
    }
  }
  const hasFallback = blocks.some((b) => b.isFallback);

  const out: any[] = [];
  for (const placement of placements) {
    const name = renderingNames?.[`${placement.renderingId}`.toUpperCase()] ?? '';
    const common = commonBlockFields(placement, name);

    const guid = /\{[0-9A-Fa-f-]{36}\}/.exec(placement.datasource ?? '')?.[0];
    const targets = guid
      ? expandDatasource({
          guid,
          entriesData,
          locale,
          idCorrector,
          uidCorrector,
          childIndex,
        })
      : [];

    // One placement is one component, so it becomes exactly one block. A folder
    // datasource is the interesting case: which child a rendering actually displays is
    // decided by its .cshtml, which is not in the package, so that cannot be recovered
    // here. Rather than guess (or emit one block per child, which multiplies a 6-part
    // page into 66), the block references every child of the folder — the component
    // keeps its real content set and the frontend picks within it, exactly as the
    // rendering did.
    const placed = targets.filter((t) => blockForContentType.has(t.contentTypeUid));
    if (placed.length) {
      // Group by content type: a block's reference field accepts one type, so the
      // dominant type wins and its entries travel together.
      const byType = new Map<string, typeof placed>();
      for (const t of placed) {
        if (!byType.has(t.contentTypeUid)) byType.set(t.contentTypeUid, []);
        (byType.get(t.contentTypeUid) as typeof placed).push(t);
      }
      let best: typeof placed = [];
      for (const group of byType.values()) {
        if (group.length > best.length) best = group;
      }
      out.push({
        [blockForContentType.get(best[0].contentTypeUid) as string]: {
          [F.datasource]: best.map((t) => ({
            uid: t.uid,
            _content_type_uid: t.contentTypeUid,
          })),
          ...common,
        },
      });
      continue;
    }

    // No dedicated block for this component: no datasource at all, a datasource this
    // package doesn't contain, or a template that stayed below the mapper's threshold.
    // The Sitecore id is kept as text so the placement can still be traced afterwards.
    if (!hasFallback) continue;
    out.push({
      [RENDERING_FALLBACK_BLOCK]: {
        datasource_id: guid ?? '',
        ...common,
      },
    });
  }

  return out;
}
