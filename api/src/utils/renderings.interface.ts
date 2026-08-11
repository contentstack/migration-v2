// Sitecore composes a page in three separate places: the item's own fields, the
// rendering *definitions* under /sitecore/layout/Renderings, and the `__renderings`
// layout XML on the page item that ties them together — which component sits in which
// placeholder, in what order, pointing at which datasource item.
//
// Contentstack has no equivalent of a rendering definition (that is code, not content),
// so the composition becomes a Modular Blocks field: one block per rendering, ordered,
// each holding a reference to its datasource entry.

/**
 * One `<r>` element from the layout XML — a single component placed on a page.
 *
 * Attribute names in the source are namespaced and terse; they are expanded here so
 * callers never have to remember that `s:ph` means placeholder.
 */
export interface RenderingPlacement {
  /** `s:uid` — the placement's own instance id. Sitecore regenerates it per placement,
   *  so it is never migrated; it exists only to resolve the `p:after` ordering chain. */
  uid: string;
  /** `s:id` — the rendering definition GUID: *which* component this is. */
  renderingId: string;
  /** `s:ds` — the datasource item GUID holding this component's content. Empty for the
   *  ~35% of placements whose component renders static markup or reads page fields. */
  datasource: string;
  /** `s:ph` — the placeholder name this component was dropped into. */
  placeholder: string;
  /** `s:par` — rendering parameters, stored in Sitecore as a URL query string and
   *  parsed here. Values arrive percent-encoded; GUID values keep their braces. */
  parameters: Record<string, string>;
  /** `p:after` — an XPath-ish predicate naming the placement this one follows.
   *  Consumed by the ordering pass and absent from the migrated output. */
  after?: string;
}

/**
 * A rendering definition item read from /sitecore/layout/Renderings.
 *
 * Only 19% of definitions in a real package declare a `datasourceTemplate`, which is
 * why block field shape is observed from the values pages actually hold rather than
 * read from the definition.
 */
export interface RenderingDefinition {
  /** The definition item's GUID — matches `RenderingPlacement.renderingId`. */
  id: string;
  /** The item name (`HomeCarousel`, `FAQ_Accordion`). Becomes the block title, which
   *  reads far better than a GUID in the Contentstack UI. */
  name: string;
  /** `view rendering` / `controller rendering` / etc. Kept for logging only. */
  template: string;
  /** The declared datasource template path, when the definition bothers to say. */
  datasourceTemplate?: string;
}

/**
 * The block a placement should be written into.
 *
 * A rendering seen often enough gets its own typed block; everything below the
 * threshold shares one generic `component` block so the rare tail is still migrated
 * rather than dropped.
 */
export type RenderingBlockKind = 'dedicated' | 'fallback';

/** Field uids used inside rendering blocks. Kept in one place because the schema side
 *  (upload-api/migration-sitecore/libs/renderings.js) names these fields and the entry
 *  side must write the identical names. */
export const RENDERING_BLOCK_FIELDS = {
  datasource: 'datasource',
  placeholder: 'placeholder',
  parameters: 'parameters',
  renderingId: 'rendering_id',
  renderingName: 'rendering_name',
} as const;

/** The uid of the shared block that carries every below-threshold rendering. */
export const RENDERING_FALLBACK_BLOCK = 'component';

/**
 * One block available on a page's `components` field, recovered from the flat
 * fieldMapping rather than passed in — so the entry side always reflects what the
 * mapper emitted, including any edits made in the mapper UI.
 */
export interface RenderingBlockDescriptor {
  blockUid: string;
  /** Content types this block's `datasource` reference accepts. Empty for the fallback,
   *  which has no reference field because there is no single type it could point at. */
  contentTypeUids: string[];
  isFallback: boolean;
}

export interface ComposeComponentsArgs {
  /** Raw `__renderings` field content, still doubly escaped. */
  layoutContent?: string;
  /** The page content type's flat fieldMapping. */
  fieldMapping: any[];
  /** Uid of the components field on this content type. */
  componentsUid: string;
  /** Grouped entries, used to confirm a datasource actually exists in this locale. */
  entriesData: any[];
  locale: string;
  /** Sitecore GUID -> entry uid. Supplied by the caller so the entry uid rule stays in
   *  one place (sitecore.service.ts). */
  idCorrector?: (args: { id: string }) => string;
  /** Template name -> content type uid. */
  uidCorrector?: (args: { uid: string }) => string;
  /** Rendering GUID (uppercased) -> definition name, for the `rendering_name` field.
   *  Optional: without it the field is empty, which is cosmetic only. */
  renderingNames?: Record<string, string>;
  /** Parent GUID (uppercased) -> child GUIDs. Lets a folder datasource be expanded to
   *  the children whose content is actually rendered. Without it, folder-backed
   *  components fall to the fallback block — correct, but far less useful. */
  childIndex?: Record<string, string[]>;
}
