import fs from 'fs';

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
        const itemArray = Array.isArray(items) ? items : [items];
        
        itemArray.forEach((item : any) => {
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

        // If no locales found, add default English
        if (uniqueLanguages.size === 0) {
          uniqueLanguages.add('en-US');
        }

        return [...uniqueLanguages];
      } catch (err :any) {
        console.error('❌ Error extracting locales:', err.message);
        // Return default locale instead of throwing
        return ['en-US'];
      }
}

export default extractLocale;