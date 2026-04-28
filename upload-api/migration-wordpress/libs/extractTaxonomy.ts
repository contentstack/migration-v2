import { Categories } from "../interface/interface";

/** Nicenames may contain `-` or spaces; taxonomy_uid uses underscores only. */
const normalizeNicenameForUid = (nicename: unknown) =>
    String(nicename ?? "").replace(/-/g, "_").replace(/\s+/g, "_");

const handleTaxonomySchema = async(categories: any, allCategories : Categories[]) => {

    const taxonomyArray: any[] = [];
    for(const category of categories){
        const categoryData = allCategories?.find((item: any) => item?.["wp:category_nicename"] === category?.attributes?.["nicename"]);

        if(categoryData  && !categoryData?.['wp:category_parent']){
            taxonomyArray?.push(
            {
                "taxonomy_uid":  `${normalizeNicenameForUid(categoryData?.["wp:category_nicename"])}_${categoryData?.["wp:term_id"]}`,
                "taxonomy_name": categoryData?.["wp:cat_name"],
                "mandatory": false,
                "multiple": true,
                "non_localizable": false
            }
               
            )
        } else if(categoryData?.['wp:category_parent']) {
            const parentCategory = allCategories?.find((category: any) => category?.["wp:category_nicename"] === categoryData?.['wp:category_parent']);
            taxonomyArray?.push({
                "taxonomy_uid": `${normalizeNicenameForUid(parentCategory?.["wp:category_nicename"])}_${parentCategory?.["wp:term_id"]}`,
                "taxonomy_name": parentCategory?.["wp:cat_name"],
                "mandatory": false,
                "multiple": true,
                "non_localizable": false
            })
        } 
    }
    return taxonomyArray;
}

const extractTaxonomy = async(categories : any, allCategories: Categories[], type: string) => {

  const category = Array?.isArray(categories) ? categories : [categories];

  const terms = await handleTaxonomySchema(category, allCategories) 

  return terms;

}



export default extractTaxonomy