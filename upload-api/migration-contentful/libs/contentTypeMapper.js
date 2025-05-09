/* eslint-disable @typescript-eslint/no-var-requires */

const restrictedUid = require('../utils/restrictedKeyWords');

/**
 * Corrects the UID by applying a custom affix and sanitizing the string.
 *
 * @param {string} uid - The original UID that needs to be corrected.
 * @param {string} affix - The affix to be prepended to the UID if it's restricted.
 * @returns {string} The corrected UID with the affix (if applicable) and sanitized characters.
 *
 * @description
 * This function checks if the provided `uid` is included in the `restrictedUid` list. If it is, the function will:
 * 1. Prepend the provided `affix` to the `uid`.
 * 2. Replace any non-alphanumeric characters in the `uid` with underscores.
 * 
 * It then converts any uppercase letters to lowercase and prefixes them with an underscore (to match a typical snake_case format).
 *
 * If the `uid` is not restricted, the function simply returns it after converting uppercase letters to lowercase and adding an underscore before each uppercase letter.
 * // Outputs: 'prefix_my_restricted_uid'
 */
const uidCorrector = (uid, affix) => {
  let newId = uid;
  if (restrictedUid.includes(uid)) {
    newId = uid.replace(uid, `${affix}_${uid}`);
    newId = newId.replace(/[^a-zA-Z0-9]+/g, '_');
  }
  return newId.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`);
};

/**
 * Extracts advanced field configurations from a content type item.
 *
 * @param {Object} item - The content type field item containing properties like `defaultValue`, `validations`, `settings`, etc.
 * @param {Array} [referenceFields=[]] - Optional array of reference field names to associate with the field.
 * @returns {Object} An object containing advanced field configurations, such as default value, validation rules, mandatory status, and more.
 *
 * @description
 * This function extracts advanced configuration details for a content type field from the provided `item`. It gathers
 * various settings like default values, validation patterns, uniqueness, mandatory status, localization settings, and
 * description (with a maximum length of 255 characters).
 *
 * Special handling is included for certain field types (`Link`, `Array`) to determine whether the field is "multiple"
 * based on the widget ID. It also considers whether the field is localized and whether reference fields are provided.
 *
 * The result is an object that includes all these advanced properties, which can be used to configure fields in a CMS or other systems.
 *
 * // Outputs an object with the advanced field configurations, including default value, validation, mandatory, and more.
 */
const extractAdvancedFields = (
  item,
  referenceFields = [],
) => {
  const defaultText = item.defaultValue ? Object.values(item.defaultValue)[0] : undefined;
  const validation = item.validations?.[0] || {};
  const regrexValue = validation?.regexp?.pattern;
  const validationErrorMessage = validation?.message;
  const uniqueValue = validation?.unique;
  let singleRef = false;
  if (['Link', 'Array'].includes(item.type)) {
    singleRef = !['assetLinkEditor', 'entryLinkEditor', 'entryCardEditor'].includes(item.widgetId);
  }
  let description = item?.settings?.helpText || item?.contentDescription || '';
  if (description.length > 255) {
    description = description.slice(0, 255);
  }

  return {
    default_value: defaultText,
    validationRegex: regrexValue,
    mandatory: ["title", "url"].includes(item.id)? true : item?.required,
    multiple: singleRef,
    unique: uniqueValue,
    nonLocalizable: !(item?.localized === true),
    validationErrorMessage: validationErrorMessage,
    referenceFields: referenceFields.length ? referenceFields : undefined,
    description:description,
  };
};

/**
 * Creates a field object for a content type, including both the main and backup field configurations.
 *
 * @param {Object} item - The content type field item that contains properties like `id`, `name`, and `type`.
 * @param {string} contentstackFieldType - The type of field for Contentstack (e.g., 'text', 'json').
 * @param {string} backupFieldType - The type of backup field (e.g., 'text', 'json').
 * @param {Array} [referenceFields=[]] - Optional array of reference field names to associate with the field.
 * @returns {Object} A field object that includes the UID, CMS field names, field types, and advanced configurations.
 *
 * @description
 * This function generates a field object to be used in the context of a content management system (CMS),
 * specifically for fields that have both a primary and backup configuration. It extracts the necessary field
 * details from the provided `item` and augments it with additional information such as UID, field names, and field types.
 * 
 * The advanced field properties are extracted using the `extractAdvancedFields` function, including any reference fields,
 * field types, and other metadata related to the field configuration.
 *
 * // Outputs an object containing the field configuration for Contentstack and backup fields
 */
const createFieldObject = (item, contentstackFieldType, backupFieldType, referenceFields = []) => ({
  uid: item.id,
  otherCmsField: item.name,
  otherCmsType: item.type,
  contentstackField: item.name,
  contentstackFieldUid: uidCorrector(item.id),
  contentstackFieldType: contentstackFieldType,
  backupFieldType: backupFieldType,
  advanced: extractAdvancedFields(item, referenceFields, contentstackFieldType, backupFieldType)
});

/**
 * Creates a field object for dropdown or radio field types with appropriate options and validations.
 *
 * @param {Object} item - The content type item that includes field details like `validations`, `type`, etc.
 * @param {string} fieldType - The type of field being created (e.g., 'dropdown', 'radio').
 * @returns {Object} A field object that includes the field configuration and validation options.
 *
 * @description
 * This function generates a field object for dropdown or radio field types based on the provided item.
 * It checks if the item has validations, and if so, it extracts possible values for the field's choices.
 * If there are no validations, it defaults to adding a 'value' and 'key' field.
 *
 * The function ensures that:
 * - The choices for the dropdown or radio field are populated with values from `validations.in` or default values if no validations are present.
 * - The field's advanced properties are extracted from the item, including validation options.
 * 
 */
const createDropdownOrRadioFieldObject = (item, fieldType) => {
  let choices = [];
  if (!item?.validations?.length) {
    choices.push({ value: 'value', key: 'key' });
  } else {
    item.validations.forEach((valid) => {
      valid.in?.forEach((value) => choices.push({ value: ["Symbol","Text","Array" ].includes(item.type) ? `${value}`: value, key: `${value}` }));
    });
  }
  return {
    ...createFieldObject(item, fieldType, fieldType),
    advanced: {
      ...extractAdvancedFields(item),
      options: choices
    }
  };
};

/**
 * Maps a collection of content type items to a schema array with specific field types and properties.
 *
 * @param {Array} data - An array of content type items, each containing metadata like type, widgetId, contentNames, etc.
 * @returns {Array} A schema array with field objects and corresponding properties based on the content type item.
 *
 * @description
 * This function processes each content type item from the input data and maps them to a specific schema structure.
 * It handles various field types (e.g., RichText, Symbol, Integer, Array, Boolean) and associates them with the 
 * appropriate field configuration based on the content type's attributes such as `type`, `widgetId`, `validations`, 
 * and `contentNames`.
 * 
 * The function supports processing of:
 * - RichText fields with associated reference fields
 * - Text fields with widget-specific mappings
 * - Integer/Number fields with widget-specific mappings
 * - Date, Link, Array, Boolean, Object, and Location fields
 * - Special handling for complex types like Asset links, Entry links, and Geo-location fields.
 */
const contentTypeMapper = (data) => {
  const schemaArray = data.reduce((acc, item) => {
    switch (item.type) {
      case 'RichText': {
        const referenceFields = (item.contentNames?.slice(0, 9) || []).concat('sys_assets');
        acc.push(createFieldObject(item, 'json', 'json', referenceFields));
        break;
      }
      case 'Symbol':
      case 'Text':
        switch (item.widgetId) {
          case 'singleLine':
          case 'urlEditor':
          case 'slugEditor':
            acc.push(createFieldObject(item, 'single_line_text', 'single_line_text'));
            break;
          case 'multipleLine':
            acc.push(createFieldObject(item, 'multi_line_text', 'multi_line_text'));
            break;
          case 'markdown':
            acc.push(createFieldObject(item, 'markdown', 'markdown'));
            break;
          case 'dropdown':
          case 'radio':
            acc.push(createDropdownOrRadioFieldObject(item, item.widgetId));
            break;
        }
        break;
      case 'Integer':
      case 'Number':
        switch (item.widgetId) {
          case 'numberEditor':
            acc.push(createFieldObject(item, 'number', 'number'));
            break;
          case 'dropdown':
          case 'radio':
            acc.push(createDropdownOrRadioFieldObject(item, item.widgetId));
            break;
          case 'rating':
            acc.push(createDropdownOrRadioFieldObject(item, 'dropdown'));
            break;
        }
        break;
      case 'Date':
        acc.push(createFieldObject(item, 'isodate', 'isodate'));
        break;

      case 'Array':
      case 'Link':
        switch (item.widgetId) {
          case 'assetLinksEditor':
          case 'assetGalleryEditor':
            acc.push(createFieldObject(item, 'file', 'file'));
            break;

          case 'entryLinksEditor':
          case 'entryCardsEditor': {
            let referenceFields = [];
            let commonRef = [];

            // Helper function to process linkContentType and match contentNames
            const processLinkContentType = (linkContentType) => {
              return linkContentType
                .filter((e) =>
                  item.contentNames.includes(e.replace(/([A-Z])/g, '_$1').toLowerCase())
                )
                .map((e) => e.replace(/([A-Z])/g, '_$1').toLowerCase());
            };

            // Process validations and content names when data.items is not defined
            if (!item.items) {
              if (item.validations?.length > 0) {
                item.validations.forEach((entries) => {
                  if (entries.linkContentType?.length) {
                    commonRef = processLinkContentType(entries.linkContentType);
                    referenceFields =
                      commonRef.length > 0 ? commonRef : item.contentNames?.slice(0, 9);
                  }
                });
              } else {
                referenceFields =
                item?.contentNames?.length < 25 ? item?.contentNames
                    : item?.contentNames?.slice(0, 9);
              }
            } else {
              // Handle case when data.items is defined
              const firstValidation = item.items.validations?.[0];
              if (firstValidation) {
                commonRef = processLinkContentType(firstValidation.linkContentType);
                referenceFields = commonRef.length > 0 ? commonRef : item.contentNames?.slice(0, 9);
              } else if (item.validations?.length > 0) {
                item.validations.forEach((entries) => {
                  if (entries.linkContentType?.length) {
                    referenceFields = entries?.linkContentType;
                  }
                });
              } else {
                referenceFields =
                item.contentNames?.length < 25 ? item?.contentNames
                    : item?.contentNames?.slice(0, 9);
              }
            }
            acc.push(createFieldObject(item, 'file', 'file', referenceFields));
            break;
          }
          case 'checkbox':
            acc.push(createDropdownOrRadioFieldObject(item, item.widgetId));
            break;
          case 'tagEditor':
            acc.push(createFieldObject(item, 'json', 'json'));
            break;
        }
        break;
      case 'Boolean':
        acc.push(createFieldObject(item, 'boolean', 'boolean'));
        break;
      case 'Object':
        acc.push(createFieldObject(item, 'json', 'json'));
        break;
      case 'Location': {
        acc.push(createFieldObject(item, 'group', 'group'));
        acc.push({
          uid: `${item.name}.lat`,
          otherCmsField: `${item.name} > lat`,
          otherCmsType: 'Number',
          contentstackField: `${item.name} > lat`,
          contentstackFieldUid: `${uidCorrector(item?.id)}.lat`,
          contentstackFieldType: 'number',
          backupFieldType: 'number',
          advanced: {
            mandatory: item?.required,
            unique: false,
            nonLocalizable: !(item?.localized === true) || false
          }
        });
        acc.push({
          uid: `${item.name}.lon`,
          otherCmsField: `${item.name} > lon`,
          otherCmsType: 'Number',
          contentstackField: `${item.name} > lon`,
          contentstackFieldUid: `${uidCorrector(item?.id)}.lon`,
          contentstackFieldType: 'number',
          backupFieldType: 'number',
          advanced: {
            mandatory: item?.required,
            unique: false,
            nonLocalizable: !(item?.localized === true) || false
          }
        });
        break;
      }
    }
    return acc;
  }, []);
  return schemaArray;
};
module.exports = contentTypeMapper;
