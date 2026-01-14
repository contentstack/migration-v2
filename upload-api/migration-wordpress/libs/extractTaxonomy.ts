import { Categories, Field } from "../interface/interface";

const handleTaxonomySchema = async(categories: any, allCategories : Categories[]) => {

    const taxonomyArray: string[] = [];
    for(const category of categories){
        const categoryData = allCategories?.find((item: any) => item?.["wp:category_nicename"] === category?.attributes?.["nicename"]);

        if(categoryData  && !categoryData?.['wp:category_parent']){
            taxonomyArray?.push(`${categoryData?.["wp:category_nicename"]}_${categoryData?.["wp:term_id"]}`)
        } else if(categoryData?.['wp:category_parent']) {
            const parentCategory = allCategories?.find((category: any) => category?.["wp:category_nicename"] === categoryData?.['wp:category_parent']);
            taxonomyArray?.push(`${parentCategory?.["wp:category_nicename"]}_${parentCategory?.["wp:term_id"]}`)
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