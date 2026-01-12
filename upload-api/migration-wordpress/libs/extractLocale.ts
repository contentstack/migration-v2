import fs from 'fs';
import path from 'path';

const extractLocale = async(filePath: string) => {
    try {
        const rawData = fs.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(rawData);
        const uniqueLanguages = new Set();
    
        // Extract global language (if exists)
        if (jsonData.rss?.channel?.language) {
          uniqueLanguages.add(jsonData.rss.channel.language);
        }
    
        // Extract entry-level languages (if available)
        const items = jsonData?.rss?.channel?.item || [];
        items.forEach((item : any) => {
          if (item['wp:postmeta']) {
            const postMeta = Array.isArray(item['wp:postmeta'])? item['wp:postmeta']
              : [item['wp:postmeta']];
            postMeta.forEach((meta) => {
              if (meta['wp:meta_key']?.toLowerCase() === 'language' && meta['wp:meta_value']) {
                uniqueLanguages.add(meta['wp:meta_value']);
              }
            });
          }
        });
    
        return [...uniqueLanguages];
      } catch (err :any) {
        throw new Error(`Error reading JSON file: ${err.message}`);
      }
}

export default extractLocale;