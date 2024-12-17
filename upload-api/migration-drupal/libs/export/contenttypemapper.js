const { readFileSync } = require('fs');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const _ = require('lodash');

const { MIGRATION_DATA_CONFIG } = require('../../constants/index')

const { writeFile, writeFileAsync } = require("../utils/helper");
const restrictedUid = require('../../../migration-sitecore/utils');

const { contentTypes: contentTypesConfig } = MIGRATION_DATA_CONFIG.modules;
const contentTypesFile = path.join(process.cwd(), MIGRATION_DATA_CONFIG.data, contentTypesConfig.dirName, contentTypesConfig.schemaFile);

const contentTypeFolderPath = path.resolve(MIGRATION_DATA_CONFIG.data, contentTypesConfig.dirName);

/**
 * Create folders and files
 */
function startingDir() {
  if (!fs.existsSync(contentTypeFolderPath)) {
    mkdirp.sync(contentTypeFolderPath);
    writeFile(path.join(contentTypeFolderPath, "schema_mapper.json"));
  }
}

function startsWithNumber(str) {
  return /^\d/.test(str);
}

const uidCorrector = (uid) => {
  if (startsWithNumber(uid)) {
    return `${append}_${_.replace(uid, new RegExp('[ -]', 'g'), '_')?.toLowerCase()}`?.replace?.(
      '$',
      ''
    );
  }
  const newUid = _.replace(uid, new RegExp('[ -]', 'g'), '_')?.toLowerCase();
  return newUid?.replace?.('$', '');
};

const ContentTypeSchema = ({
  type,
  name,
  uid,
  default_value = '',
  id,
  multiline,
  sitecoreKey,
  affix
}) => {
  const isPresent = restrictedUid?.find((item) => item === uid);
  if (isPresent) {
    uid = `${affix}_${uid}`;
  }
  if (type === 'text') {
    type = multiline ? 'Multi-Line Text' : 'Single-Line Text';
  }

  if (name.toLowerCase() === "title") {
    return {
      id: id,
      uid: "title",
      otherCmsField: "title",
      otherCmsType: "text",
      contentstackField: "Title",
      contentstackFieldUid: "title",
      contentstackFieldType: "text",
      backupFieldType: "text",
      advanced: { default_value: default_value !== '' ? default_value : null }
    };
  }

  if (name.toLowerCase() === "url") {
    return {
      id: id,
      uid: "url",
      otherCmsField: "url",
      otherCmsType: "text",
      contentstackField: "Url",
      contentstackFieldUid: "url",
      contentstackFieldType: "url",
      backupFieldType: "url",
      advanced: { default_value: default_value !== '' ? default_value : null }
    };
  }
  switch (type) {
    case 'Single-Line Text': {
      return {
        id: id,
        uid: sitecoreKey,
        otherCmsField: name,
        otherCmsType: type,
        contentstackField: name,
        contentstackFieldUid: uid,
        contentstackFieldType: 'single_line_text',
        backupFieldType: 'single_line_text',
        advanced: { default_value: default_value !== '' ? default_value : null }
      };
    }

    case 'json':
    case 'Rich Text': {
      return {
        id: id,
        uid: sitecoreKey,
        otherCmsField: name,
        otherCmsType: type,
        contentstackField: name,
        contentstackFieldUid: uid,
        contentstackFieldType: 'json',
        backupFieldType: 'json',
        advanced: { default_value: default_value !== '' ? default_value : null }
      };
    }

    case 'file':
    case 'Image': {
      return {
        id: id,
        uid: sitecoreKey,
        otherCmsField: name,
        otherCmsType: type,
        contentstackField: name,
        contentstackFieldUid: uid,
        contentstackFieldType: 'file',
        backupFieldType: 'file',
        advanced: { default_value: default_value !== '' ? default_value : null }
      };
    }

    case 'Multi-Line Text': {
      return {
        id: id,
        uid: sitecoreKey,
        otherCmsField: name,
        otherCmsType: type,
        contentstackField: name,
        contentstackFieldUid: uid,
        contentstackFieldType: 'multi_line_text',
        backupFieldType: 'multi_line_text',
        advanced: { default_value: default_value !== '' ? default_value : null }
      };
    }

    case 'Integer':
    case 'Number': {
      return {
        id: id,
        uid: sitecoreKey,
        otherCmsField: name,
        otherCmsType: type,
        contentstackField: name,
        contentstackFieldUid: uid,
        contentstackFieldType: 'number',
        backupFieldType: 'number',
        advanced: { default_value: default_value !== '' ? default_value : null }
      };
    }

    case 'isodate':
    case 'Date':
    case 'Time': {
      return {
        id: id,
        uid: sitecoreKey,
        otherCmsField: name,
        otherCmsType: type,
        contentstackField: name,
        contentstackFieldUid: uid,
        contentstackFieldType: 'isodate',
        backupFieldType: 'isodate',
        advanced: { default_value: default_value !== '' ? default_value : null }
      };
    }

    default: {
      return {
        id,
        uid: sitecoreKey,
        otherCmsField: name,
        otherCmsType: type,
        contentstackField: name,
        contentstackFieldUid: uid,
        contentstackFieldType: 'reference',
        backupFieldType: 'reference'
      };
    }
  }
};


const contentTypeMaker = async (affix) => {

  startingDir();
  const fileContent = readFileSync(contentTypesFile);
  const contentTypes = JSON.parse(fileContent);
  const mainSchema = contentTypes.map((element) => ({
    status: 1,
    otherCmsTitle: element.title,
    otherCmsUid: element.uid,
    isUpdated: false,
    updateAt: "",
    contentstackTitle: element.title,
    contentstackUid: element.uid,
    fieldMapping: element.schema.map(({ display_name, uid, data_type, field_metadata }) =>
      ContentTypeSchema({
        name: display_name,
        uid: uidCorrector(uid),
        type: data_type,
        default_value: field_metadata?.default_value,
        id: uid,
        multiline: field_metadata?.multiline,
        sitecoreKey: uid,
        affix
      })),
    type: "content_type"
  }));
  await writeFileAsync(
    path.join(process.cwd(), MIGRATION_DATA_CONFIG.data, contentTypesConfig.dirName, "schema_mapper.json"),
    mainSchema,
    4
  );
  return mainSchema;
};

module.exports = contentTypeMaker;
