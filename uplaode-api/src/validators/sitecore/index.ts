/*
sitecore Validator
 */
interface items {
  files: object;
}

interface props {
  data: items;
}

function sitecoreValidator({ data }: props) {
  try {
    const templates: any[] = [];
    const content: any[] = [];
    const configuration: any[] = [];
    const blob: any[] = [];
    const mediaLibrary: any[] = [];
    Object.keys(data?.files).forEach(async function (filename: any) {
      if (await filename?.includes?.('/templates')) {
        templates?.push(await filename);
      }
      if (await filename?.includes?.('/content')) {
        content?.push(await filename);
      }
      //optional
      if (await filename?.includes?.('/Configuration')) {
        configuration?.push(await filename);
      }
      if (await filename?.includes?.('/Blob')) {
        blob?.push(await filename);
      }
      if (await filename?.includes?.('/media library')) {
        mediaLibrary?.push(await filename);
      }
    });
    if (templates?.length > 0 || content?.length > 0 || blob?.length > 0 || mediaLibrary?.length > 0) {
      return true;
    }
    return false;
  } catch (err) {
    console.info('🚀 ~ sitecoreValidator ~ err:', err);
    return false;
  }
}

export default sitecoreValidator;
