'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * External module dependencies.
 */
const fs = require('fs/promises');
const path = require('path');
// const contentTypeMapper = require('./contentTypeMapper');
const contentTypeMapper = require('./contentTypeMapper');

/**
 * Internal module dependencies.
 */
const { readFile, writeFile, deleteFolderSync } = require('../utils/helper');
const config = require('../config');
const idArray = require('../utils/restrictedKeyWords');

/**
 * Corrects the UID by adding a prefix and sanitizing the string if it is found in a specified list.
 *
 * @param {string} uid - The original UID that may need correction.
 * @param {string} prefix - The prefix to be added to the UID if it's in the specified list.
 * @returns {string} The corrected UID, potentially with a prefix and sanitized characters.
 *
 * @description
 * This function checks if the provided `uid` is included in the `idArray` list. If it is:
 * 1. The function will prepend the provided `prefix` to the `uid`.
 * 2. Replace any non-alphanumeric characters in the `uid` with underscores.
 *
 * It then converts any uppercase letters in the `uid` to lowercase and prefixes them with an underscore (to convert to snake_case format).
 *
 * If the `uid` is not found in the `idArray` list, it will simply return the `uid` after applying the lowercase transformation and underscores for uppercase letters.
 * // Outputs: 'prefix_my_special_id'
 */
const uidCorrector = (uid, prefix) => {
  let newId = uid;
  if (idArray.includes(uid)) {
    newId = uid.replace(uid, `${prefix}_${uid}`);
    newId = newId.replace(/[^a-zA-Z0-9]+/g, '_');
  }
  return newId.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`);
};

/**
 * Creates an initial mapping for content types by processing files in a specified directory.
 * 
 * @returns {Promise<{ contentTypes: object[] }>} A promise that resolves to an object containing an array of content type objects.
 * 
 * @description
 * This function performs the following steps:
 * 1. Reads all files in a specified directory containing data about content types.
 * 2. For each file, it processes the data to construct an object representing the content type.
 * 3. The content type object includes metadata such as the title, UID, status, field mappings, etc.
 * 4. It checks if the `title` and `url` fields are present and includes them if not.
 * 5. The content type fields are further enriched by mapping the fields from the data using a helper function `contentTypeMapper`.
 * 6. After processing all the files, the content type objects are returned as an array.
 * 7. The function handles errors and logs them to the console if any occur during the process.
 * 
 * The function also deletes a folder at the end of the process (using `deleteFolderSync`), which may be used for cleanup purposes.
 * 
 * // Outputs: an array of content type objects, each containing metadata and field mappings.
 */
const createInitialMapper = async () => {
  try {
    const initialMapper = [];
    const files = await fs.readdir(
      path.resolve(process.cwd(), `${config.data}/${config.contentful.contentful}`)
    );

    for (const file of files) {
      const data = readFile(
        path.resolve(process.cwd(), `${config.data}/${config.contentful.contentful}/${file}`)
      );
      const title = file.split('.')[0];
      
      const contentTypeObject = {
        status: 1,
        isUpdated: false,
        updateAt: '',
        otherCmsTitle: title,
        otherCmsUid: data[0]?.contentUid,
        contentstackTitle: title.charAt(0).toUpperCase() + title.slice(1),
        contentstackUid: uidCorrector(data[0]?.contentUid),
        type: 'content_type',
        fieldMapping: []
      };
      const titleArray = data.map((item) => item.id);
      const uidTitle = titleArray.includes('title') ? []
        : [
            {
              uid: 'title',
              otherCmsField: 'title',
              otherCmsType: 'text',
              contentstackField: 'title',
              contentstackFieldUid: 'title',
              contentstackFieldType: 'text',
              backupFieldType: 'text',
              advanced:{ mandatory:true}
            }
          ];
      const uidUrl = titleArray.includes('url') ? []
        : [
            {
              uid: 'url',
              otherCmsField: 'url',
              otherCmsType: 'text',
              contentstackField: 'Url',
              contentstackFieldUid: 'url',
              contentstackFieldType: 'url',
              backupFieldType: 'url',
              advanced:{ mandatory:true}
            }
          ];
      const contentstackFields = [...uidTitle, ...uidUrl, ...contentTypeMapper(data)].filter(
        Boolean
      );

      contentTypeObject.fieldMapping = contentstackFields;
      initialMapper.push(contentTypeObject);
    }
    // writeFile(path.join(path.resolve(process.cwd(), `${config.data}/${config.contentful.contentful}`), 'schemaTest.json'), JSON.stringify(initialMapper, null, 4));
    deleteFolderSync(path.resolve(process.cwd(), config.data));
    return { contentTypes: initialMapper };
  } catch (error) {
    console.error('Error saving content type:', error);
  }
};

module.exports = createInitialMapper;
