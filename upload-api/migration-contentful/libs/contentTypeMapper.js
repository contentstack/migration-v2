/* eslint-disable @typescript-eslint/no-var-requires */

const restrictedUid = require('../utils/restrictedKeyWords');
const uidCorrector = (uid, affix) => {
  let newId = uid;
  if (restrictedUid.includes(uid)) {
    newId = uid.replace(uid, `${affix}_${uid}`);
    newId = newId.replace(/[^a-zA-Z0-9]+/g, '_');
  }
  return newId.replace(/([A-Z])/g, (match) => `_${match.toLowerCase()}`);
};

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
