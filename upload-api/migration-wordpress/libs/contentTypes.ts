
import fs from 'fs';
import path from 'path';
/**
 * Internal module Dependencies .
 */
import config from '../config/index.json';
import extractItems from './extractItems';
import extractAuthor from './extractAuthor';
import { CT, DataConfig } from '../interface/interface';
import extractTerms from './extractTerms';


const { contentTypes: contentTypesConfig } = config.modules;

const contentTypeFolderPath = path.resolve(config.data, contentTypesConfig.dirName);
// SEO (and any future) global fields are written here by extractItems (see libs/globalFields).
// Kept in sync with the literal used in extractItems.
const globalFieldsFolderPath = path.resolve(config.data, 'global_fields');

function startingDir() {
  if (!fs.existsSync(contentTypeFolderPath)) {
    fs.mkdirSync(contentTypeFolderPath, { recursive: true });
    //helper.writeFile(path.join(contentTypeFolderPath, contentTypesConfig.schemaFile)," ");
  }
}


function readJsonFilesFromFolder(folderPath: string) {
    const result: CT[] = [];
  
    const files = fs?.readdirSync(folderPath);
  
    for (const file of files) {
      if (file?.endsWith(".json")) {
        const filePath = path?.join(folderPath, file);
  
        // Read and parse JSON
        const content = fs?.readFileSync(filePath, "utf-8");
        try {
          const parsed = JSON?.parse(content);
          result?.push?.(parsed);
        } catch (err) {
          console.error(`❌ Failed to parse ${file}:`, err);
        }
      }
    }
  
    return result;
  }

/**
 * Read global-field definitions written under `global_fields/` (e.g. the reusable SEO global field).
 * `globalfields.json` holds an ARRAY of field-mapper envelopes (`type: 'global_field'`); each is
 * returned alongside the content types so the mapper pipeline (contenTypeMaker) creates it too.
 * Returns [] when no global fields were produced, so non-SEO migrations are unaffected.
 */
function readGlobalFieldsFromFolder(folderPath: string) {
  const result: CT[] = [];
  if (!fs?.existsSync(folderPath)) return result;

  const files = fs?.readdirSync(folderPath);
  for (const file of files) {
    if (!file?.endsWith('.json')) continue;
    const filePath = path?.join(folderPath, file);
    try {
      const parsed = JSON?.parse(fs?.readFileSync(filePath, 'utf-8'));
      if (Array?.isArray(parsed)) result?.push?.(...parsed);
      else if (parsed) result?.push?.(parsed);
    } catch (err) {
      console.error(`❌ Failed to parse global field ${file}:`, err);
    }
  }
  return result;
}

async function extractContentTypes(affix: string, filePath: string, DataConfig: DataConfig) {
  try {
    startingDir();

    const alldata = await fs.promises.readFile(filePath, "utf8");
    const alldataParsed = JSON?.parse(alldata);
    const items = alldataParsed?.rss?.channel?.["item"];
    const authorData = alldataParsed?.rss?.channel?.["wp:author"];
    await extractAuthor(authorData, 'author');
    const rawCategories = alldataParsed?.rss?.channel?.["wp:category"];
    const categoriesData = Array.isArray(rawCategories) ? rawCategories : (rawCategories ? [rawCategories] : []);
    const rawTerms = alldataParsed?.rss?.channel?.["wp:term"];
    const termsData = Array.isArray(rawTerms) ? rawTerms : (rawTerms ? [rawTerms] : []);
    await extractTerms(termsData, 'terms');
    //await extractCategories(categoriesData, 'category');
    //await extractTaxonomy(categoriesData, 'categories');
    const itemsArray = Array?.isArray(items) ? items : (items ? [items] : []);
   
    const groupedByType = itemsArray?.reduce((acc: any, item: any) => {
        const postType = item?.["wp:post_type"];
      
        // Skip if it's an attachment
        if (["attachment", 'wp_global_styles', 'wp_navigation']?.includes(postType)) {
          return acc;
        }
      
        const type = postType || "unknown";
        if (!acc[type]) acc[type] = [];
        acc[type].push(item);
      
        return acc;
      }, {});
      
      
    for (const [type, items] of Object.entries(groupedByType)) {
      const publishableItems = (items as any[])?.filter((item: any) =>
        ['publish', 'inherit'].includes(item?.['wp:status'])
      );
      if (Array?.isArray(publishableItems) && publishableItems?.length > 0) {
        await extractItems(publishableItems, DataConfig, type, affix, categoriesData, termsData);
      } else {
        console.log(`No ${type} found to extract`);
      }
    }
      
      
    return readJsonFilesFromFolder(contentTypeFolderPath);
    
  } catch (error : any) {
    console.error('Error during WordPress content type extraction:', error?.message);
  }
  }

export default extractContentTypes;