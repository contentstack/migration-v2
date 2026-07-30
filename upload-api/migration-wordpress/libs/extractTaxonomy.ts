import { Categories } from "../interface/interface";

/** Nicenames/domains may contain `-` or spaces; taxonomy_uid uses underscores only. */
const normalizeNicenameForUid = (nicename: unknown) =>
    String(nicename ?? "").replace(/-/g, "_").replace(/\s+/g, "_");

/** Humanize a domain/nicename slug into a display name, e.g. "post_tag" -> "Post Tag". */
const humanizeDomain = (domain: unknown) =>
    String(domain ?? "")
        .replace(/[-_]+/g, " ")
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Inline taxonomies exclude `author` (surfaced as an Author reference) and `post_tag` (surfaced as
 * native entry tags), so neither is duplicated as a taxonomy.
 */
const EXCLUDED_INLINE_DOMAINS = new Set(["author", "post_tag"]);

const taxonomyNode = (uid: string, name: unknown) => ({
    "taxonomy_uid": uid,
    "taxonomy_name": name,
    "mandatory": false,
    "multiple": true,
    "non_localizable": false
});

/** Legacy path: channel-level <wp:category> definitions drive the taxonomy schema. */
const handleTaxonomySchema = async(categories: any, allCategories : Categories[]) => {

    const taxonomyArray: any[] = [];
    for(const category of categories){
        const categoryData = allCategories?.find((item: any) => item?.["wp:category_nicename"] === category?.attributes?.["nicename"]);

        if(categoryData  && !categoryData?.['wp:category_parent']){
            taxonomyArray?.push(taxonomyNode(
                `${normalizeNicenameForUid(categoryData?.["wp:category_nicename"])}_${categoryData?.["wp:term_id"]}`,
                categoryData?.["wp:cat_name"]
            ));
        } else if(categoryData?.['wp:category_parent']) {
            const parentCategory = allCategories?.find((category: any) => category?.["wp:category_nicename"] === categoryData?.['wp:category_parent']);
            taxonomyArray?.push(taxonomyNode(
                `${normalizeNicenameForUid(parentCategory?.["wp:category_nicename"])}_${parentCategory?.["wp:term_id"]}`,
                parentCategory?.["wp:cat_name"]
            ));
        }
    }
    return taxonomyArray;
}

/**
 * Inline path: WXR exports that omit channel <wp:category> definitions still carry taxonomy data as
 * inline <category domain="..." nicename="..."> tags on each item. Each distinct domain becomes one
 * taxonomy (domain = taxonomy_uid), so a single export surfaces every domain it uses — category and
 * any custom taxonomies (industry, topic, role, size, post_format, ...). `author` and `post_tag` are
 * skipped (see EXCLUDED_INLINE_DOMAINS).
 */
const deriveInlineTaxonomies = (categories: any[]) => {
    const taxonomyArray: any[] = [];
    const seen = new Set<string>();
    for (const category of categories) {
        const domain = category?.attributes?.domain;
        if (!domain || EXCLUDED_INLINE_DOMAINS.has(domain)) continue;
        const uid = normalizeNicenameForUid(domain);
        if (seen.has(uid)) continue;
        seen.add(uid);
        taxonomyArray.push(taxonomyNode(uid, humanizeDomain(domain)));
    }
    return taxonomyArray;
}

const extractTaxonomy = async(categories : any, allCategories: Categories[], type: string) => {

  const category = Array?.isArray(categories) ? categories : [categories];

  // Prefer channel-level <wp:category> definitions when present (legacy behavior); otherwise derive
  // the taxonomy vocabulary directly from the inline <category> tags on the item.
  const terms = allCategories?.length > 0
    ? await handleTaxonomySchema(category, allCategories)
    : deriveInlineTaxonomies(category);

  return terms;

}



export default extractTaxonomy