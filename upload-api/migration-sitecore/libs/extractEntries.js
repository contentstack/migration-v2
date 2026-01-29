const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const read = require('fs-readdir-recursive');
const helper = require('../utils/helper');
const restrictedUid = require('../utils');
const { MIGRATION_DATA_CONFIG } = require('../constants/index');

const idCorrector = ({ id }) => {
  const newId = id?.replace(/[-{}]/g, (match) =>
    match === '-' ? '' : ''
  );
  if (newId) {
    return newId?.toLowerCase();
  } else {
    return id;
  }
};

const uidCorrector = ({ uid } ) => {
  if (!uid || typeof uid !== 'string') {
    return '';
  }

  let newUid = uid;

  // Note: UIDs starting with numbers and restricted keywords are handled externally in Sitecore
  // The prefix is applied in contentTypeMaker function when needed

  // Clean up the UID
  newUid = newUid
    .replace(/[ -]/g, '_') // Replace spaces and hyphens with underscores
    .replace(/[^a-zA-Z0-9_]+/g, '_') // Replace non-alphanumeric characters (except underscore)
    .replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`) // Handle camelCase
    .toLowerCase() // Convert to lowercase
    .replace(/_+/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores

  // Ensure UID doesn't start with underscore (Contentstack requirement)
  if (newUid.startsWith('_')) {
    newUid = newUid.substring(1);
  }

  return newUid;
};

const extractEntries = async (newPath) => {
  try {

    const srcFunc = 'extractEntries';

    const folderName = path.join(newPath,'master', 'sitecore', 'content');

    const entriesData = [];
    if (fs.existsSync(folderName)) {

      const entryPath = read?.(folderName);
      for await (const file of entryPath) {
        if (file?.endsWith('data.json')) {
          const data = await fs.promises.readFile(
            path.join(folderName, file),
            'utf8'
          );
          const jsonData = JSON.parse(data);

          const { language, template, tid } = jsonData?.item?.$ ?? {};
          const id = idCorrector({ id: jsonData?.item?.$?.id });
          const entries = {};
          entries[id] = {
            meta: jsonData?.item?.$,
            fields: jsonData?.item?.fields,
          };
          const templateIndex = entriesData?.findIndex(
            (ele) => ele?.template === template
          );
          if (templateIndex >= 0) {
            const entry = entriesData?.[templateIndex]?.locale?.[language];
            if (entry !== undefined) {
              entry[id] = {
                meta: jsonData?.item?.$,
                fields: jsonData?.item?.fields,
              };
            } else {
              entriesData[templateIndex].locale[language] = entries;
            }
          } else {
            const locale = {};
            locale[language] = entries;
            entriesData?.push({ template, locale, tid });
          }
        }
      }
    }
    const contentTypeUids = fs.readFileSync(
      path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, MIGRATION_DATA_CONFIG?.DATA_MAPPER_DIR, 'contentTypeKey.json'),
      'utf8'
    );
    const contentTypes = JSON.parse(contentTypeUids);
    if(!fs.existsSync(path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, MIGRATION_DATA_CONFIG?.ENTRIES_DIR_NAME))){
        fs.mkdirSync(path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, MIGRATION_DATA_CONFIG?.ENTRIES_DIR_NAME), { recursive: true });
    }
    

    Object.entries(contentTypes).map(([key, value]) => {
        console.info(`🚀 ~ extractEntries ~ Processing Content Type UID:`, value, key);
        let contentTypeTitle = '';
        const entryPresent = entriesData?.find(
        (item) =>
         item?.tid  === key
        );
        const AllentryArray = Array.isArray(entryPresent) ? entryPresent : [entryPresent];
        const entriesArray = [];

        if (AllentryArray && AllentryArray.length > 0) {
            //console.info(`🚀 ~ extractEntries ~ AllentryArray:`, AllentryArray);
            for(const entry of AllentryArray){
                const locales = entry?.locale && Object?.keys(entry?.locale);

                if(locales?.length <= 0) continue;

                if(!locales) continue;

                for  (const locale of locales) {
                    Object.entries(entry?.locale?.[locale] || {}).map(([uid, item])=>{
                        contentTypeTitle = entry?.template;
                    
                        entriesArray.push({
                        contentTypeUid: key,
                        entryName: item?.meta?.name,
                        otherCmsEntryUid: item?.meta?.id,
                        otherCmsCTName: item?.template,
                        isUpdate: false,
                        });

                    })
                }
                
              
 
            };
            const message = `${srcFunc} Transforming entries of Content Type ${contentTypeTitle} has begun.`;
            console.info(message);

        }
        const contentType ={
            "id": key,
            "status": 1,
            "otherCmsTitle": contentTypeTitle,
            "otherCmsUid": value,
            "isUpdated": false,
            "updateAt": "",
            "contentstackTitle": contentTypeTitle,
            "contentstackUid": value,
            "entryMapping": entriesArray,

        }

        if(entriesArray?.length > 0){
            if(fs.existsSync(path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, MIGRATION_DATA_CONFIG?.CONTENT_TYPES_DIR_NAME, `${contentType?.contentstackUid}.json`))){
                const data = fs.readFileSync(
                    path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, MIGRATION_DATA_CONFIG?.CONTENT_TYPES_DIR_NAME, `${contentType?.contentstackUid}.json`),
                    'utf8'
                );
                const existingContentType = JSON.parse(data);
                existingContentType.entryMapping = entriesArray;
                fs.writeFileSync(
                    path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, MIGRATION_DATA_CONFIG?.CONTENT_TYPES_DIR_NAME, `${contentType?.contentstackUid}.json`),
                    JSON.stringify(existingContentType, null, 4));
            }
            
        }

    });
      
    return true;
  } catch (err) {
    console.error('🚀 ~ createEntry ~ err:', err);
  }
};

module.exports = extractEntries;