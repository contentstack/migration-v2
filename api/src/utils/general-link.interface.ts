/**
 * Shapes for converting a Sitecore "General Link" field into a Contentstack
 * link field.
 *
 * Sitecore overloads one field type to hold several kinds of destination,
 * distinguished by the `linktype` attribute on the `<link>` element:
 *   - external  -> a web address in `url`, never an `id`
 *   - internal  -> a content item, identified by `id`; `url` may also be
 *                  present (the resolved content path) but often is not
 *   - media     -> a media-library asset, identified by `id`
 *   - javascript-> `javascript:void(0);` placeholders with no destination
 *
 * Contentstack has no equivalent union type, so all of them are flattened
 * into a single `{ title, href }` link value.
 */

/** Attributes parsed off a Sitecore `<link>` element. */
export interface SitecoreLinkAttributes {
  linktype?: string;
  /** Display text authored in Sitecore; the preferred label. */
  text?: string;
  /** Secondary label (the HTML `title`/tooltip), used when `text` is blank. */
  title?: string;
  /** Destination for external links, or the resolved path for internal ones. */
  url?: string;
  /** Sitecore GUID of the target item — content entry or media asset. */
  id?: string;
}

/** A Contentstack link field value. Both members are always strings. */
export interface ContentstackLink {
  title: string;
  href: string;
}