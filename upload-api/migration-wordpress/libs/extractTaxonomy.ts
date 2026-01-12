import { Categories, Field } from "../interface/interface";

const handleTaxonomySchema = async(categories : Categories[]) => {

    const taxonomyArray: string[] = [];
    for(const category of categories){
        if(category  && !category?.['wp:category_parent']){
            taxonomyArray?.push(`${category?.["wp:category_nicename"]}_${category?.["wp:term_id"]}`)
        }   
    }
    return taxonomyArray;
}

const extractTaxonomy = async(categoriesData : Categories[], type: string) => {
  if(categoriesData?.length > 0){
    const taxonomy : Field = 
    {
        uid: type?.toLowerCase(),
        otherCmsField: type,
        otherCmsType: type,
        contentstackField: type,
        contentstackFieldUid: type?.toLowerCase(),
        contentstackFieldType: 'taxonomy',
        backupFieldType: 'taxonomy',
        backupFieldUid: type?.toLowerCase(),
        advanced: {
            terms : [],
        }
    }
    if (taxonomy?.advanced) {
        taxonomy.advanced.terms = (await handleTaxonomySchema(categoriesData)) ?? [];
    }
    return taxonomy;
   }

}



export default extractTaxonomy