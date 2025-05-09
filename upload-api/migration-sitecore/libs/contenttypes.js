/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const _ = require("lodash");
const read = require("fs-readdir-recursive");
const helper = require("../utils/helper");
const restrictedUid = require("../utils");
const { MIGRATION_DATA_CONFIG } = require("../constants/index");

const extraField = "title";
const configChecker = path?.join('content', 'Common', 'Configuration');
const append = "a";
let config = {};

const {
  DATA_MAPPER_DIR,
  DATA_MAPPER_CONFIG_FILE,
  DATA_MAPPER_CONFIG_TREE_FILE,
  CONTENT_TYPES_DIR_NAME
} = MIGRATION_DATA_CONFIG;


function isKeyPresent(keyToFind, timeZones) {
  return timeZones?.some?.(timeZone => Object?.keys?.(timeZone)?.includes?.(keyToFind));
}

const createTemplate = ({ components }) => {
  components.item.$.field = components?.item?.fields?.field
  return components?.item?.$
}

function startsWithNumber(str) {
  return /^\d/.test(str);
}

const uidCorrector = ({ uid }) => {
  if (startsWithNumber(uid)) {
    return `${append}_${_.replace(uid, new RegExp("[ -]", "g"), '_')?.toLowerCase()}`?.replace?.("$", "");
  }
  const newUid = _.replace(uid, new RegExp("[ -]", "g"), '_')?.toLowerCase()
  return newUid?.replace?.("$", "")
}


const templatesComponents = ({ path: newPath }) => {
  const fields = [];
  for (let i = 0; i < newPath?.length; i++) {
    const allFields = [];
    const allPaths = read(newPath?.[i]?.pth)
    for (let j = 0; j < allPaths?.length; j++) {
      if (allPaths?.[j]?.endsWith("data.json")) {
        const innerField = [];
        const components = helper.readFile(
          path?.join?.(newPath?.[i]?.pth, allPaths?.[j]),
        );
        const data = components?.item?.$ ?? {};
        components?.item?.fields?.field.forEach((item) => {
          if (item?.$?.key === "type" || item?.$?.key === "source" || item?.$?.key === extraField) {
            innerField.push({
              content: item.content,
              ...item.$
            })
          }
        })
        if (innerField?.length) {
          data.fields = innerField;
          allFields.push(data);
        }
      }
    }
    fields?.push({ meta: newPath?.[i]?.obj?.item?.$, schema: allFields })
  }
  return fields;
}

const templateStandardValues = ({ components }) => {
  const standardValues = [];
  const data = components?.item?.$ ?? {};
  components?.item?.fields?.field.forEach((item) => {
    if (!item?.$?.key.includes("__")) {
      standardValues.push({
        content: item.content,
        ...item.$
      })
    }
  })
  data.fields = standardValues;
  return data;
}

const contentTypeKeyMapper = ({ template, contentType, contentTypeKey = "contentTypeKey" }) => {
  let keyMapper = {};
  const keys = helper.readFile(
    path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, DATA_MAPPER_DIR, `${contentTypeKey}.json`)
  );
  if (keys) {
    keyMapper = keys;
  }
  keyMapper[template?.id] = contentType?.uid;
  helper.writeFile(
    path.join(
      process.cwd(),
      MIGRATION_DATA_CONFIG.DATA,
      DATA_MAPPER_DIR
    ),
    JSON.stringify(keyMapper, null, 4),
    contentTypeKey,
    (err) => {
      if (err) throw err;
    }
  );
}

const ContentTypeSchema = ({ type, name, uid, default_value = "", id, choices = [], sourLet, sitecoreKey, affix }) => {
  const isPresent = restrictedUid?.find((item) => item === uid);
  if (isPresent) {
    uid = `${affix}_${uid}`
  }
  switch (type) {
    case 'Single-Line Text': {
      return {
        id: id,
        uid: sitecoreKey,
        "otherCmsField": name,
        "otherCmsType": type,
        "contentstackField": name,
        "contentstackFieldUid": uid,
        "contentstackFieldType": "single_line_text",
        "backupFieldType": "single_line_text",
        "advanced": { default_value: default_value !== "" ? default_value : null }
      }
    }
    case 'Checkbox': {
      default_value = default_value === "1" ? true : false;
      return {
        id: id,
        uid: sitecoreKey,
        "otherCmsField": name,
        "otherCmsType": type,
        "contentstackField": name,
        "contentstackFieldUid": uid,
        "contentstackFieldType": "boolean",
        "backupFieldType": "boolean",
        "advanced": { default_value: default_value !== "" ? default_value : null }
      }
    }
    case 'Rich Text': {
      return {
        id: id,
        uid: sitecoreKey,
        "otherCmsField": name,
        "otherCmsType": type,
        "contentstackField": name,
        "contentstackFieldUid": uid,
        "contentstackFieldType": "json",
        "backupFieldType": "json",
        "advanced": { default_value: default_value !== "" ? default_value : null }
      }
    }

    case 'Droplist': {
      return {
        id: id,
        uid: sitecoreKey,
        "otherCmsField": name,
        "otherCmsType": type,
        "contentstackField": name,
        "contentstackFieldUid": uid,
        "contentstackFieldType": "dropdown",
        "backupFieldType": "dropdown",
        "advanced": { options: choices, default_value: default_value !== "" ? default_value : null, Multiple: false }
      }
    }
    case "Image": {
      return {
        id: id,
        uid: sitecoreKey,
        "otherCmsField": name,
        "otherCmsType": type,
        "contentstackField": name,
        "contentstackFieldUid": uid,
        "contentstackFieldType": "file",
        "backupFieldType": "file",
        "advanced": { default_value: default_value !== "" ? default_value : null }
      }
    }
    case "General Link":
    case "Internal Link": {
      return {
        id: id,
        uid: sitecoreKey,
        "otherCmsField": name,
        "otherCmsType": type,
        "contentstackField": name,
        "contentstackFieldUid": uid,
        "contentstackFieldType": "link",
        "backupFieldType": "link",
        "advanced": { default_value: default_value !== "" ? default_value : null }
      }
    }

    case "Multi-Line Text": {
      return {
        id: id,
        uid: sitecoreKey,
        "otherCmsField": name,
        "otherCmsType": type,
        "contentstackField": name,
        "contentstackFieldUid": uid,
        "contentstackFieldType": "multi_line_text",
        "backupFieldType": "multi_line_text",
        "advanced": { default_value: default_value !== "" ? default_value : null }
      }
    }


    case "Integer":
    case "Number": {
      return {
        id: id,
        uid: sitecoreKey,
        "otherCmsField": name,
        "otherCmsType": type,
        "contentstackField": name,
        "contentstackFieldUid": uid,
        "contentstackFieldType": "number",
        "backupFieldType": "number",
        "advanced": { default_value: default_value !== "" ? default_value : null }
      }
    }


    case "Date":
    case "Time": {
      return {
        id: id,
        uid: sitecoreKey,
        "otherCmsField": name,
        "otherCmsType": type,
        "contentstackField": name,
        "contentstackFieldUid": uid,
        "contentstackFieldType": "isodate",
        "backupFieldType": "isodate",
        "advanced": { default_value: default_value !== "" ? default_value : null }
      }
    }

    case 'Grouped Droplist': {
      if (choices?.length) {
        return {
          id: id,
          uid: sitecoreKey,
          "otherCmsField": name,
          "otherCmsType": type,
          "contentstackField": name,
          "contentstackFieldUid": uid,
          "contentstackFieldType": "dropdown",
          "backupFieldType": "dropdown",
          "advanced": { options: choices, default_value: default_value !== "" ? default_value : null, Multiple: false }
        }
      }
      break;
    }
    case "Treelist": {
      if (sourLet?.key !== "source") {
        return {
          id: id,
          uid: sitecoreKey,
          "otherCmsField": name,
          "otherCmsType": type,
          "contentstackField": name,
          "contentstackFieldUid": uid,
          "contentstackFieldType": "reference",
          "backupFieldType": "reference"
        }
      }
      break;
    }
    default: {
      return {
        id,
        uid: sitecoreKey,
        "otherCmsField": name,
        "otherCmsType": type,
        "contentstackField": name,
        "contentstackFieldUid": uid,
        "contentstackFieldType": "reference",
        "backupFieldType": "reference"
      }
    }
  }
}

function makeUnique({ data }) {
  const newData = data;
  let tempMapping = {};
  if (newData?.[0]?.key) {
    newData?.forEach(choice => {
      if (choice?.key) {
        if (!tempMapping?.[choice?.value]) {
          tempMapping[choice?.value] = [];
        }
        tempMapping[choice?.value].push(choice?.key);
      }
    });
    const result = Object?.entries(tempMapping).map(([value, keys]) => {
      return {
        key: keys?.join('/'),
        value: value
      };
    });
    const newValue = [];
    result?.forEach((item) => {
      if (item?.key === undefined) {
        newValue?.push({ ...item, key: item?.value })
      } else {
        newValue?.push(item)
      }
    })
    return newValue;
  } else {
    let uniqueValues = [];
    const result = data?.filter(item => {
      if (uniqueValues?.includes(item?.value)) {
        return false;
      } else {
        uniqueValues?.push(item?.value);
        return true;
      }
    });
    const newValue = [];
    result?.forEach((item) => {
      if (item?.key === undefined) {
        newValue?.push({ ...item, key: item?.value })
      } else {
        newValue?.push(item)
      }
    })
    return newValue;
  }
}

const groupFlat = (data, item) => {
  const flat = [];
  if (data?.data_type === "group" && data?.schema?.[0] !== undefined) {
    const group = {
      uid: item?.meta?.key,
      otherCmsField: item?.meta?.name,
      otherCmsType: 'Group',
      contentstackField: item?.meta?.name,
      contentstackFieldUid: uidCorrector({ uid: item?.meta?.key }),
      contentstackFieldType: 'group',
      backupFieldType: 'group'
    }
    flat?.push(group);
    data?.schema?.forEach((element) => {
      const obj = {
        ...element,
        uid: `${item?.meta?.key}.${element?.uid}`,
        otherCmsField: `${item?.meta?.name} > ${element?.otherCmsField}`,
        contentstackField: `${item?.meta?.name} > ${element?.contentstackField}`,
        contentstackFieldUid: `${uidCorrector({ uid: item?.meta?.key })}.${element?.contentstackFieldUid}`,
      }
      flat?.push(obj);
    })
  }
  return flat;
}


const contentTypeMapper = ({ components, standardValues, content_type, basePath, sitecore_folder, affix }) => {
  const source = helper.readFile(
    path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, DATA_MAPPER_DIR, DATA_MAPPER_CONFIG_FILE)
  );
  const sourceTree = helper.readFile(
    path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, DATA_MAPPER_DIR, DATA_MAPPER_CONFIG_TREE_FILE)
  );
  let mainSchema = [];
  components?.forEach((item) => {
    if (item?.schema?.length) {
      const groupSchema = {
        "data_type": "group",
        "display_name": item?.meta?.name,
        "field_metadata": {},
        "schema": [],
        "uid": uidCorrector({ uid: item?.meta?.key }),
        "multiple": true,
        "mandatory": false,
        "unique": false
      };
      for (let i = 0; i < item?.schema?.length; i++) {
        const field = item?.schema?.[i];
        const appendStandardValues = standardValues?.fields?.find((item) => item?.key === field?.key)
        if (appendStandardValues) {
          field?.fields?.forEach((item) => {
            if (item?.content === appendStandardValues?.type) {
              item.standardValues = appendStandardValues
            }
          })
        }
        let compType = {};
        let sourLet = {};
        let sourceType = [];
        let advanced = false;
        let name = field?.name;
        field?.fields?.forEach((item) => {
          if (item?.key === "type") {
            compType = item;
          }
          if (item?.key === "source") {
            sourLet = item;
            if (compType?.content === "Droplink") {
              if (sourceTree) {
                if (item?.content?.includes(configChecker)) {
                  sourceType = makeUnique({ data: sourceTree?.[item?.content] })
                  compType.content = "Droplist"
                  if (isKeyPresent("key", sourceType)) {
                    advanced = true;
                  }
                } else {
                  console.log("🚀 ~ file: contenttypes.js:305 ~ field?.fields?.forEach ~ item?.content:", item?.content)
                }
              } else {
                console.log("🚀 ~ file: contenttypes.js:371 ~ field?.fields?.forEach ~ compType:", compType?.standardValues?.key)

              }
            } else {
              if (source) {
                if (item?.content?.includes("datasource=")) {
                  const gUid = item?.content?.split("}")?.[0]?.replace("datasource={", "")
                  if (gUid) {
                    const dataSourcePaths = read(path?.join?.(sitecore_folder, 'master', 'sitecore', 'content', 'Common'))
                    let isDataSourcePresent = dataSourcePaths?.find((sur) => sur?.includes(`{${gUid}}`));
                    isDataSourcePresent = isDataSourcePresent?.split(`{${gUid}}`)?.[0]
                    if (isDataSourcePresent) {
                      const optionsPath = read(path?.join?.(sitecore_folder, 'master', 'sitecore', 'content', 'Common', isDataSourcePresent));
                      const refName = [];
                      optionsPath?.forEach((newPath) => {
                        if (newPath?.endsWith("data.json")) {
                          const data = helper.readFile(path?.join?.(sitecore_folder, 'master', 'sitecore', 'content', 'Common', isDataSourcePresent, newPath));
                          if (data?.item?.$?.template) {
                            refName.push(data?.item?.$?.template)
                          }
                        }
                      })
                      if (refName?.length) {
                        const unique = [...new Set(refName)]
                        contentTypeKeyMapper({ template: { id: content_type?.contentstackUid }, contentType: { uid: { name, uid: field?.key, unique } }, contentTypeKey: "treeListRef" })
                      }
                    }
                  }
                } else {
                  sourceType = makeUnique({ data: source?.[item?.content] })
                  if (isKeyPresent("key", sourceType)) {
                    advanced = true;
                  }
                }
              }
            }
          }
          if (item?.key === extraField) {
            if (item?.content && item?.content !== "") {
              name = item?.content
            }
          }
        })
        if (compType?.content !== "Droptree") {
          groupSchema?.schema?.push(ContentTypeSchema({
            name,
            uid: uidCorrector({ uid: field?.key }),
            type: compType?.content,
            default_value: compType?.standardValues?.content,
            id: field?.id,
            choices: sourceType?.slice(0, config?.plan?.dropdown?.optionLimit - 2 ?? 98),
            advanced,
            sourLet,
            sitecoreKey: field?.key,
            isFromMapper: true,
            affix
          }));
        }
      }
      mainSchema?.push(...groupFlat(groupSchema, item));
    }
    const isUrlfound = mainSchema?.find((rt) => rt?.contentstackFieldUid?.toLowerCase?.() === "url")
    if (isUrlfound === undefined) {
      mainSchema?.unshift(
        {
          uid: "url",
          "otherCmsField": "url",
          "otherCmsType": "text",
          "contentstackField": "Url",
          "contentstackFieldUid": "url",
          "contentstackFieldType": "url",
          "backupFieldType": "url"
        })
    }
    const isPresent = mainSchema?.find((item) =>
      item?.contentstackFieldUid?.toLowerCase?.() === "title"
    )
    if (isPresent === undefined) {
      mainSchema.unshift({
        uid: "title",
        "otherCmsField": "title",
        "otherCmsType": "text",
        "contentstackField": "Title",
        "contentstackFieldUid": "title",
        "contentstackFieldType": "text",
        "backupFieldType": "text"
      })
    }
  })
  return mainSchema;
}

const contentTypeMaker = ({ template, basePath, sitecore_folder, affix }) => {
  const content_type = {
    id: template?.id,
    status: 1,
    "otherCmsTitle": template?.name,
    "otherCmsUid": template?.key,
    "isUpdated": false,
    "updateAt": "",
    "contentstackTitle": template?.name,
    "contentstackUid": uidCorrector({ uid: template?.key }),
  }
  template?.field?.forEach((item) => {
    if (item?.$?.key === "__base template" && item?.$?.type === "tree list") {
      contentTypeKeyMapper({ template, contentType: { uid: { ...item?.$, content: item?.content } }, contentTypeKey: "base" })
    }
  })
  content_type.fieldMapping = contentTypeMapper({ components: template?.components, standardValues: template?.standardValues, content_type, basePath, sitecore_folder, affix })
  return content_type;
}

function findExactPath(path, searchTerm) {
  return path?.endsWith(searchTerm);
}


function singleContentTypeCreate({ templatePaths, globalPath, sitecore_folder, affix }) {
  const newPath = read(templatePaths);
  const templatesComponentsPath = [];
  let templatesStandaedValuePath = {};
  let templatesMetaDataPath = {};
  for (let i = 0; i < newPath?.length; i++) {
    if (findExactPath(newPath?.[i], "data.json")) {
      const data = helper?.readFile(path?.join?.(templatePaths, newPath?.[i]));
      if (data?.item?.$?.template === "template section") {
        templatesComponentsPath?.push(
          {
            pth: path?.join?.(templatePaths, newPath?.[i] ?? '')?.split("/{")?.[0],
            obj: data
          }
        );
      } else if (data?.item?.$?.template === "template") {
        templatesMetaDataPath = data;
      } else if (data?.item?.$?.key?.includes?.("standard values")) {
        templatesStandaedValuePath = data;
      }
    }
  }
  const template = createTemplate({ components: templatesMetaDataPath });
  template.components = templatesComponents({ path: templatesComponentsPath, basePath: templatePaths });
  template.standardValues = templateStandardValues({ components: templatesStandaedValuePath })
  const contentType = contentTypeMaker({ template, basePath: globalPath, sitecore_folder, affix })
  if (contentType?.fieldMapping?.length) {
    helper?.writeFile(
      path.join(
        process.cwd(),
        MIGRATION_DATA_CONFIG.DATA, CONTENT_TYPES_DIR_NAME,
      ),
      JSON.stringify(contentType, null, 4),
      contentType?.contentstackUid,
      (err) => {
        if (err) throw err;
      }
    );
    contentTypeKeyMapper({ template, contentType: { uid: contentType?.contentstackUid } })
  }
  return true;
}


function ExtractContentTypes(sitecore_folder, affix, configData) {
  config = configData;
  const folder = read(sitecore_folder);
  const templatePaths = [];
  for (let i = 0; i < folder?.length; i++) {
    if (folder?.[i]?.includes("templates") && (folder?.[i]?.endsWith("data.json"))) {
      const data = helper?.readFile(path?.join?.(sitecore_folder, folder?.[i]));
      if (data?.item?.$?.template === "template") {
        templatePaths?.push(path?.join?.(sitecore_folder, folder?.[i])?.split("/{")?.[0])
      }
    }
  }
  if (templatePaths?.length) {
    const unique = [...new Set(templatePaths)]
    unique?.forEach((item) => {
      singleContentTypeCreate({ templatePaths: item, globalPath: folder, sitecore_folder, affix })
    })
  } else {
    throw { message: "Templates Not Found." }
  }
}



module.exports = ExtractContentTypes;