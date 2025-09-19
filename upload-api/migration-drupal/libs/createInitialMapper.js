'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * External module dependencies.
 */
const fs = require('fs');             // for existsSync
const fsp = require('fs/promises');   // for async file operations
const path = require('path');
const contentTypeMapper = require('./contentTypeMapper');

/**
 * Internal module dependencies.
 */
const { dbConnection, writeFile } = require('../utils/helper');
const config = require('../config');
const idArray = require('../utils/restrictedKeyWords');

/**
 * Corrects the UID by adding a prefix and sanitizing the string if it is found in a specified list.
 */
const uidCorrector = (uid, prefix) => {
  let newId = uid;
  if (idArray.includes(uid) || uid.startsWith('_ids') || uid.endsWith('_ids')) {
    newId = uid.replace(uid, `${prefix}_${uid}`);
    newId = newId.replace(/[^a-zA-Z0-9]+/g, '_');
  }
  return newId.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`);
};

/**
 * Creates an initial mapping for content types by processing Drupal database data.
 */
const createInitialMapper = async (systemConfig, prefix) => {
  try {
    const drupalFolderPath = path.resolve(config.data, config.drupal.drupal);
    
    if (!fs.existsSync(drupalFolderPath)) {
      await fsp.mkdir(drupalFolderPath, { recursive: true });
    }
    
    // Get database connection
    const connection = dbConnection(systemConfig);
    
    // SQL query to get field configurations
    const query = "SELECT *, CONVERT(data USING utf8) as data FROM config WHERE name LIKE '%field.field.node%'";

    // Execute query
    const [rows] = await connection.promise().query(query);

    const details_data = [];

    // Process each row to extract field data
    for (let i = 0; i < rows.length; i++) {
      try {
        const { unserialize } = require('php-serialize');
        const conv_details = unserialize(rows[i].data);
        
        details_data.push({
          field_label: conv_details?.label,
          description: conv_details?.description,
          field_name: conv_details?.field_name,
          content_types: conv_details?.bundle,
          type: conv_details?.field_type,
          handler: conv_details?.settings?.handler,
          reference: conv_details?.settings?.handler_settings?.target_bundles,
          min: conv_details?.settings?.min,
          max: conv_details?.settings?.max,
          default_value: conv_details?.default_value?.[0]?.value
        });
      } catch (error) {
        console.warn(`Couldn't parse row ${i}:`, error.message);
      }
    }

    if (details_data.length === 0) {
      return { contentTypes: [] };
    }


    const initialMapper = [];
    const contentTypes = Object.keys(require('lodash').keyBy(details_data, 'content_types'));

    // Process each content type
    for (const contentType of contentTypes) {
      const contentTypeFields = require('lodash').filter(details_data, { content_types: contentType });
      const contenttypeTitle = contentType.split('_').join(' ');

      const contentTypeObject = {
        status: 1,
        isUpdated: false,
        updateAt: '',
        otherCmsTitle: contenttypeTitle,
        otherCmsUid: contenttypeTitle,
        contentstackTitle: contenttypeTitle.charAt(0).toUpperCase() + contenttypeTitle.slice(1),
        contentstackUid: uidCorrector(contenttypeTitle, prefix),
        type: 'content_type',
        fieldMapping: []
      };

      // Map fields using contentTypeMapper
      const contentstackFields = await contentTypeMapper(contentTypeFields, contentTypes, prefix, systemConfig.mysql);
      contentTypeObject.fieldMapping = contentstackFields;

      initialMapper.push(contentTypeObject);

      // Save individual content type file
      const main = {
        title: contenttypeTitle,
        uid: contentType,
        schema: contentstackFields,
        description: `Schema for ${contenttypeTitle}`,
        options: {
          is_page: true,
          singleton: false,
          sub_title: [],
          title: `title`,
          url_pattern: '/:title',
          url_prefix: `/${contenttypeTitle.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase()}/`
        }
      };

      await fsp.writeFile(
        path.join(drupalFolderPath, `${contentType}.json`),
        JSON.stringify(main, null, 4)
      );
    }

    // Close database connection
    connection.end();
    return { contentTypes: initialMapper };
  } catch (error) {
    console.error('Error in content type extraction:', error);
    throw error;
  }
};

module.exports = createInitialMapper;
