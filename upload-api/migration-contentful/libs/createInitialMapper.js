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

// const contentstackFolderPath = path.resolve(process.cwd(), config.data);

// Function to add or update schema based on UID uniqueness

const uidCorrector = (uid, prefix) => {
  let newId = uid;
  if (idArray.includes(uid)) {
    newId = uid.replace(uid, `${prefix}_${uid}`);
    newId = newId.replace(/[^a-zA-Z0-9]+/g, '_');
  }
  return newId.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`);
};

// Save content type schema by reading files and processing them
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
