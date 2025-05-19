
/*
sitecore Validator
 */

import path from "path";
interface items {
  files: object;
}

interface props {
  data: items;
}

async function sitecoreValidator({ data }: props) {
  try {
    let templates: any[] = [];
    let content: any[] = [];
    const configuration: any[] = [];
    let blob: any[] = [];
    let mediaLibrary: any[] = [];
    for (const filenameRaw of Object.keys(data?.files)) {
      // Normalize and convert to POSIX format (forward slashes)
      const filename = path?.posix?.normalize?.(filenameRaw.replace(/\\/g, '/'));
      if (filename.includes('/templates') && !filename.includes('properties/items/master/sitecore/templates')) {
        templates?.push(filename);
      }
      if (filename.includes('/content')) {
        content?.push(filename);
      }
      // optional
      if (filename.includes('/Configuration')) {
        configuration.push(filename);
      }
      if (filename?.includes('/blob')) {
        blob?.push(filename);
      }
      if (filename?.includes('/media library')) {
        mediaLibrary?.push(filename);
      }
      // Early exit optimization
      if (templates.length > 0 && content.length > 0) break;
    }
    templates = await Promise.all(templates);
    content = await Promise.all(content);
    blob = await Promise.all(blob);
    mediaLibrary = await Promise.all(mediaLibrary);
    // && blob?.length > 0 && mediaLibrary?.length > 0

    if (templates?.length > 0 && content?.length > 0) {
      return true;
    }
    return false;
  } catch (err) {
    console.info('🚀 ~ sitecoreValidator ~ err:', err);
    return false;
  }
}

export default sitecoreValidator;
