
import fs from 'fs';
import path from 'path';
/**
 * Internal module Dependencies .
 */
import config from '../config/index.json';
import extractItems from './extractItems';
import extractAuthor from './extractAuthor';
import extractTaxonomy from './extractTaxonomy';
import { CT, DataConfig } from '../interface/interface';


const { contentTypes: contentTypesConfig } = config.modules;

const contentTypeFolderPath = path.resolve(config.data, contentTypesConfig.dirName);

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

async function extractContentTypes(affix: string, filePath: string, DataConfig: DataConfig) {
  try {
    startingDir();

    const alldata = await fs.promises.readFile(filePath, "utf8");
    const alldataParsed = JSON?.parse(alldata);
    const items = alldataParsed?.rss?.channel?.["item"];
    const authorData = alldataParsed?.rss?.channel?.["wp:author"];
    await extractAuthor(authorData, 'author');
    const categoriesData = alldataParsed?.rss?.channel?.["wp:category"];
    //await extractCategories(categoriesData, 'category');
    await extractTaxonomy(categoriesData, 'categories');
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
      
      
      // Now process each type dynamically
      for (const [type, items] of Object.entries(groupedByType)) {
        if (Array?.isArray(items) && items?.length > 0) {
          await extractItems(items, DataConfig, type, affix, categoriesData);
        } else {
          console.log(`No ${type} found to extract`);
        }
      }
      
      
    return readJsonFilesFromFolder(contentTypeFolderPath);
  } catch (error : any) {
    console.error('Error while creating content_types/schema.json:', error?.message);
  }
  }

export default extractContentTypes;