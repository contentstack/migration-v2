/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const _ = require('lodash');
const read = require('fs-readdir-recursive');
const helper = require('../utils/helper');
const restrictedUid = require('../utils');
const { MIGRATION_DATA_CONFIG } = require('../constants/index');

const extraField = 'title';
const configChecker = path?.join('content', 'Common', 'Configuration');
const append = 'a';
let config = {};


function getUniqueFieldMappingsByUID(fieldMappings) {
  const seen = new Set();
  return fieldMappings.filter(item => {
    if (seen.has(item.uid)) {
      return false;
    }
    seen.add(item.uid);
    return true;
  });
}

const {
  DATA_MAPPER_DIR,
  DATA_MAPPER_CONFIG_FILE,
  DATA_MAPPER_CONFIG_TREE_FILE,
  CONTENT_TYPES_DIR_NAME
} = MIGRATION_DATA_CONFIG;

function isKeyPresent(keyToFind, timeZones) {
  return timeZones?.some?.((timeZone) => Object?.keys?.(timeZone)?.includes?.(keyToFind));
}

const createTemplate = ({ components }) => {
  components.item.$.field = components?.item?.fields?.field;
  return components?.item?.$;
};

function startsWithNumber(str) {
  return /^\d/.test(str);
}

const isNotEmptyBraces = (s) => /^\{[^{}]*\}$/.test(s);

function isLikelyTemplatePath(value) {
  if (typeof value !== 'string') return false;

  const normalized = value.trim().toLowerCase();

  return (
    normalized.startsWith('/sitecore/')
  );
}

const splitByPipe = (s) => s.includes('|') ? s.split('|') : [s];

const uidCorrector = ({ uid }) => {
  if (startsWithNumber(uid)) {
    return `${append}_${_.replace(uid, new RegExp('[ -]', 'g'), '_')?.toLowerCase()}`?.replace?.(
      '$',
      ''
    );
  }
  const newUid = _.replace(uid, new RegExp('[ -]', 'g'), '_')?.toLowerCase();
  return newUid?.replace?.('$', '');
};

const templatesComponents = ({ path: newPath }) => {
  const fields = [];
  for (let i = 0; i < newPath?.length; i++) {
    const allFields = [];
    const allPaths = read(newPath?.[i]?.pth);
    for (let j = 0; j < allPaths?.length; j++) {
      if (allPaths?.[j]?.endsWith('data.json')) {
        const innerField = [];
        const components = helper.readFile(path?.join?.(newPath?.[i]?.pth, allPaths?.[j]));
        const data = components?.item?.$ ?? {};
        components?.item?.fields?.field?.forEach?.((item) => {
          if (item?.$?.key === 'type' || item?.$?.key === 'source' || item?.$?.key === extraField) {
            innerField.push({
              content: item.content,
              ...item.$
            });
          }
        });
        if (innerField?.length) {
          data.fields = innerField;
          allFields.push(data);
        }
      }
    }
    fields?.push({ meta: newPath?.[i]?.obj?.item?.$, schema: allFields });
  }
  return fields;
};

const templateStandardValues = ({ components }) => {
  const standardValues = [];
  const data = components?.item?.$ ?? {};
  components?.item?.fields?.field.forEach((item) => {
    if (!item?.$?.key.includes('__')) {
      standardValues.push({
        content: item.content,
        ...item.$
      });
    }
  });
  data.fields = standardValues;
  return data;
};

const contentTypeKeyMapper = ({ template, contentType, contentTypeKey = 'contentTypeKey' }) => {
  let keyMapper = {};
  const keys = helper.readFile(
    path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, DATA_MAPPER_DIR, `${contentTypeKey}.json`)
  );
  if (keys) {
    keyMapper = keys;
  }
  keyMapper[template?.id] = contentType?.uid;
  helper.writeFile(
    path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, DATA_MAPPER_DIR),
    JSON.stringify(keyMapper, null, 4),
    contentTypeKey,
    (err) => {
      if (err) throw err;
    }
  );
};

const ContentTypeSchema = ({
  type,
  name,
  uid,
  default_value = '',
  id,
  choices = [],
  sourLet,
  sitecoreKey,
  affix,
}) => {
  const isPresent = restrictedUid?.find((item) => item === uid);
  if (isPresent) {
    uid = `${affix}_${uid}`;
  }
  switch (type) {
    case 'SmartLink':
    case 'text':
    case 'Translate Single Line Test':
    case 'Single-Line Text':
    case 'Page Preview':
    case 'password':
    case 'Query Datasource':
    case 'Password': {
      return {
        id: id,
        uid: sitecoreKey,
        otherCmsField: name,
        otherCmsType: type,
        contentstackField: name,
        contentstackFieldUid: uid,
        contentstackFieldType: 'single_line_text',
        backupFieldType: 'single_line_text',
        backupFieldUid: uid,
        advanced: { default_value: default_value !== '' ? default_value : null }
      };
    }
    case 'checkbox':
    case 'Tristate':
    case 'Checkbox':
    case 'ComfirmCheckbox': {
      default_value = default_value === '1' ? true : false;
      return {
        id: id,
        uid: sitecoreKey,
        otherCmsField: name,
        otherCmsType: type,
        contentstackField: name,
        contentstackFieldUid: uid,
        contentstackFieldType: 'boolean',
        backupFieldType: 'boolean',
        backupFieldUid: uid,
        advanced: { default_value: default_value !== '' ? default_value : null }
      };
    }
    case 'Rich Text':
    case 'Rich Text Translate Test': {
      return {
        id: id,
        uid: sitecoreKey,
        otherCmsField: name,
        otherCmsType: type,
        contentstackField: name,
        contentstackFieldUid: uid,
        contentstackFieldType: 'html',
        backupFieldType: 'html',
        backupFieldUid: uid,
        advanced: { default_value: default_value !== '' ? default_value : null }
      };
    }

    case 'Droplist': {
      return {
        id: id,
        uid: sitecoreKey,
        otherCmsField: name,
        otherCmsType: type,
        contentstackField: name,
        contentstackFieldUid: uid,
        contentstackFieldType: 'dropdown',
        backupFieldType: 'dropdown',
        backupFieldUid: uid,
        advanced: {
          options: choices,
          default_value: default_value !== '' ? default_value : null,
          Multiple: false
        }
      };
    }
    case 'Icon':
    case 'icon':
    case 'File':
    case 'Attachment':
    case 'Image':
    case 'server file': {
      return {
        id: id,
        uid: sitecoreKey,
        otherCmsField: name,
        otherCmsType: type,
        contentstackField: name,
        contentstackFieldUid: uid,
        contentstackFieldType: 'file',
        backupFieldType: 'file',
        backupFieldUid: uid,
        advanced: { default_value: default_value !== '' ? default_value : null }
      };
    }
    case 'link':
    case 'General Link':
    case 'Internal Link': {
      return {
        id: id,
        uid: sitecoreKey,
        otherCmsField: name,
        otherCmsType: type,
        contentstackField: name,
        contentstackFieldUid: uid,
        contentstackFieldType: 'link',
        backupFieldType: 'link',
        backupFieldUid: uid,
        advanced: { default_value: default_value !== '' ? default_value : null }
      };
    }
    case 'memo':
    case 'DataSectionSelector':
    case 'Query Builder':
    case 'Multi-Line Text':
    case 'security': {
      return {
        id: id,
        uid: sitecoreKey,
        otherCmsField: name,
        otherCmsType: type,
        contentstackField: name,
        contentstackFieldUid: uid,
        contentstackFieldType: 'multi_line_text',
        backupFieldType: 'multi_line_text',
        backupFieldUid: uid,
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
        backupFieldUid: uid,
        advanced: { default_value: default_value !== '' ? default_value : null }
      };
    }
    case 'datetime':
    case 'Datetime':
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
        backupFieldUid: uid,
        advanced: { default_value: default_value !== '' ? default_value : null }
      };
    }

    case 'Grouped Droplist': {
      if (choices?.length) {
        return {
          id: id,
          uid: sitecoreKey,
          otherCmsField: name,
          otherCmsType: type,
          contentstackField: name,
          contentstackFieldUid: uid,
          contentstackFieldType: 'dropdown',
          backupFieldType: 'dropdown',
          backupFieldUid: uid,
          advanced: {
            options: choices,
            default_value: default_value !== '' ? default_value : null,
            Multiple: false
          }
        };
      }
      break;
    }
    case 'Treelist':
    case 'RelativeTreelist':
    case 'tree list':
    case 'TreelistEx':
    case 'Multilist with Search':
    case 'DropTree': {
      // console.info("🚀 ~ sourLet: =>>>", type, sourLet)
      if (sourLet?.key !== 'source') {
        // return {
        //   id: id,
        //   uid: sitecoreKey,
        //   otherCmsField: name,
        //   otherCmsType: type,
        //   contentstackField: name,
        //   contentstackFieldUid: uid,
        //   contentstackFieldType: 'reference',
        //   backupFieldUid: uid,
        //   backupFieldType: 'reference'
        // };
      }
      break;
    }
    case 'Bwin Name Value List Unsorted':
    case 'Bwin Name Value List Sorted':
    case 'BettingOfferEx':
    case 'JsonField':
    case 'BwinLink':
    case 'BwinTable':
    case 'JSON':
    case 'BwinVideo':
    case 'Rules':
    case 'BetPicker':
    case 'Custom':
    case 'Json':
    case 'PrioVisiblityList':
    case 'User and Role List':
    case 'layout':
    case 'Layout': {
      return {
        id: id,
        uid: sitecoreKey,
        otherCmsField: name,
        otherCmsType: type,
        contentstackField: name,
        contentstackFieldUid: uid,
        contentstackFieldType: 'extension',
        backupFieldUid: uid,
        backupFieldType: 'extension'
      };
    }

    case 'Name Value List':
    case 'KeyValueLookup':
    case 'Version Link':
    case 'Rendering Datasource':
    case 'LottieAttachment':
    case 'LotteImage':
    case 'checklist':
    case 'IFrameEx':
    case 'Thumbnail':
    case 'GraphQL':
    case 'Datasource':
    case 'Security':
    case 'Template Field Source':
    case 'Grouped Droplink': {
      break;
    }

    default: {
      console.info(type);
      // return {
      //   id,
      //   uid: sitecoreKey,
      //   otherCmsField: name,
      //   otherCmsType: type,
      //   contentstackField: name,
      //   contentstackFieldUid: uid,
      //   contentstackFieldType: 'reference',
      //   backupFieldUid: uid,
      //   backupFieldType: 'reference'
      // };
    }
  }
};

function makeUnique({ data }) {
  const newData = data;
  let tempMapping = {};
  if (newData?.[0]?.key) {
    newData?.forEach((choice) => {
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
        newValue?.push({ ...item, key: item?.value });
      } else {
        newValue?.push(item);
      }
    });
    return newValue;
  } else {
    let uniqueValues = [];
    const result = data?.filter((item) => {
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
        newValue?.push({ ...item, key: item?.value });
      } else {
        newValue?.push(item);
      }
    });
    return newValue;
  }
}

const groupFlat = (data, item) => {
  const flat = [];
  if (data?.data_type === 'group' && data?.schema?.[0] !== undefined) {
    const group = {
      uid: item?.meta?.key,
      otherCmsField: item?.meta?.name,
      otherCmsType: 'Group',
      contentstackField: item?.meta?.name,
      contentstackFieldUid: uidCorrector({ uid: item?.meta?.key }),
      contentstackFieldType: 'group',
      backupFieldType: 'group'
    };
    flat?.push(group);
    data?.schema?.forEach((element) => {
      const obj = {
        ...element,
        uid: `${item?.meta?.key}.${element?.uid}`,
        otherCmsField: `${item?.meta?.name} > ${element?.otherCmsField}`,
        contentstackField: `${item?.meta?.name} > ${element?.contentstackField}`,
        contentstackFieldUid: `${uidCorrector({ uid: item?.meta?.key })}.${element?.contentstackFieldUid
          }`,
        backupFieldUid: `${uidCorrector({ uid: item?.meta?.key })}.${element?.contentstackFieldUid}`
      };
      flat?.push(obj);
    });
  }
  return flat;
};

const contentTypeMapper = ({
  components,
  standardValues,
  content_type,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  basePath,
  sitecore_folder,
  affix
}) => {
  const source = helper.readFile(
    path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, DATA_MAPPER_DIR, DATA_MAPPER_CONFIG_FILE)
  );
  const sourceTree = helper.readFile(
    path.join(
      process.cwd(),
      MIGRATION_DATA_CONFIG.DATA,
      DATA_MAPPER_DIR,
      DATA_MAPPER_CONFIG_TREE_FILE
    )
  );
  let mainSchema = [];
  components?.forEach((item) => {
    if (item?.schema?.length) {
      const groupSchema = {
        data_type: 'group',
        display_name: item?.meta?.name,
        field_metadata: {},
        schema: [],
        uid: uidCorrector({ uid: item?.meta?.key }),
        multiple: true,
        mandatory: false,
        unique: false
      };
      for (let i = 0; i < item?.schema?.length; i++) {
        const field = item?.schema?.[i];
        const appendStandardValues = standardValues?.fields?.find(
          (item) => item?.key === field?.key
        );
        if (appendStandardValues) {
          field?.fields?.forEach((item) => {
            if (item?.content === appendStandardValues?.type) {
              item.standardValues = appendStandardValues;
            }
          });
        }
        let compType = {};
        let sourLet = {};
        let sourceType = [];
        let advanced = false;
        let name = field?.name;
        field?.fields?.forEach((item) => {
          if (item?.key === 'type') {
            compType = item;
          }
          if (item?.key === 'source') {
            sourLet = item;
            if (compType?.content === 'Multilist' || compType?.content === 'Checklist') {
              if (isLikelyTemplatePath(item?.content)) {
                const sourcePath = path?.join?.(sitecore_folder, 'items', 'master', item?.content);
                if (!sourcePath?.endsWith('xml')) {
                  const readAppPath = read?.(sourcePath);
                  if (readAppPath?.length) {
                    readAppPath?.forEach?.((newPath) => {
                      if (newPath?.endsWith?.('data.json')) {
                        // const data = helper.readFile(
                        //   path?.join?.(sourcePath, newPath)
                        // );
                        // console.info("umesh", data)
                      }
                    })
                  }
                }
              } else if (isNotEmptyBraces(item?.content)) {
                const refNameSplit = splitByPipe(item?.content)
                const uniqueSpilt = [...new Set(refNameSplit)];
                contentTypeKeyMapper({
                  template: { id: content_type?.contentstackUid },
                  contentType: { uid: { name, uid: field?.key, unique: uniqueSpilt } },
                  contentTypeKey: 'treeListRef'
                });
              }
            } else if (compType?.content === 'Droplink') {
              if (sourceTree) {
                if (item?.content?.includes(configChecker)) {
                  sourceType = makeUnique({ data: sourceTree?.[item?.content] });
                  compType.content = 'Droplist';
                  if (isKeyPresent('key', sourceType)) {
                    advanced = true;
                  }
                } else {
                  if (isLikelyTemplatePath(item?.content)) {
                    const sourcePath = path?.join?.(sitecore_folder, 'items', 'master', item?.content);
                    if (!sourcePath?.endsWith('xml')) {
                      const resultData = [];
                      read?.(sourcePath)?.forEach?.((newPath) => {
                        if (newPath?.endsWith?.('data.json')) {
                          const data = helper.readFile(
                            path?.join?.(sourcePath, newPath)
                          );
                          const getLastSegment = path => path?.trim().replace(/\/+$/, '').split('/').pop();
                          if (data?.item?.$?.name !== getLastSegment(sourcePath)) {
                            resultData?.push({ key: data?.item?.$?.name, value: data?.item?.$?.id })
                          }
                        }
                      })
                      // sourceType = makeUnique({ data: resultData });
                    }
                  }
                  // console.log(
                  //   '🚀 ~ file: contenttypes.js:305 ~ field?.fields?.forEach ~ item?.content:',
                  //   sitecore_folder, item
                  // );
                }
              } else {
                if (isNotEmptyBraces(item?.content)) {
                  const refNameSplit = splitByPipe(item?.content)
                  const uniqueSpilt = [...new Set(refNameSplit)];
                  contentTypeKeyMapper({
                    template: { id: content_type?.contentstackUid },
                    contentType: { uid: { name, uid: field?.key, unique: uniqueSpilt } },
                    contentTypeKey: 'treeListRef'
                  });
                } else {
                  console.log('out', item?.content)
                }
              }
            } else {
              if (source) {
                if (item?.content?.includes('datasource=')) {
                  const gUid = item?.content?.split('}')?.[0]?.replace('datasource={', '');
                  if (gUid) {
                    const dataSourcePaths = read(
                      path?.join?.(sitecore_folder, 'master', 'sitecore', 'content', 'Common')
                    );
                    let isDataSourcePresent = dataSourcePaths?.find((sur) =>
                      sur?.includes(`{${gUid}}`)
                    );
                    isDataSourcePresent = isDataSourcePresent?.split(`{${gUid}}`)?.[0];
                    if (isDataSourcePresent) {
                      const optionsPath = read(
                        path?.join?.(
                          sitecore_folder,
                          'master',
                          'sitecore',
                          'content',
                          'Common',
                          isDataSourcePresent
                        )
                      );
                      const refName = [];
                      optionsPath?.forEach((newPath) => {
                        if (newPath?.endsWith('data.json')) {
                          const data = helper.readFile(
                            path?.join?.(
                              sitecore_folder,
                              'master',
                              'sitecore',
                              'content',
                              'Common',
                              isDataSourcePresent,
                              newPath
                            )
                          );
                          if (data?.item?.$?.template) {
                            refName.push(data?.item?.$?.template);
                          }
                        }
                      });
                      if (refName?.length) {
                        const unique = [...new Set(refName)];
                        contentTypeKeyMapper({
                          template: { id: content_type?.contentstackUid },
                          contentType: { uid: { name, uid: field?.key, unique } },
                          contentTypeKey: 'treeListRef'
                        });
                      }
                    }
                  }
                } else {
                  sourceType = makeUnique({ data: source?.[item?.content] });
                  if (isKeyPresent('key', sourceType)) {
                    advanced = true;
                  }
                }
              } else {
                if (compType?.content === 'Droplist') {
                  if (isNotEmptyBraces(item?.content)) {
                    const templateSourcePath = path?.join?.(sitecore_folder, 'items', 'master', 'sitecore', 'templates');
                    const readArrayPath = read?.(templateSourcePath);
                    const contentPath = readArrayPath?.find?.((ele) => ele?.includes?.(item?.content) && ele?.includes('data.json'));
                    if (contentPath) {
                      const contentPathChild = contentPath?.split?.(item?.content)?.[0];
                      const allPathOfChild = readArrayPath?.filter((element) => element?.includes?.(contentPathChild) && element?.includes?.('data.json'));
                      const resultData = [];
                      allPathOfChild?.forEach((newPath) => {
                        const data = helper.readFile(
                          path?.join?.(templateSourcePath, newPath)
                        );
                        if (data?.item?.$?.id !== item?.content) {
                          resultData?.push({ key: data?.item?.$?.name, value: data?.item?.$?.key })
                        }
                      })
                      sourceType = makeUnique({ data: resultData });
                    }
                  } else {
                    const sourcePath = path?.join?.(sitecore_folder, 'items', 'master', item?.content);
                    if (!sourcePath?.endsWith('xml')) {
                      const resultData = [];
                      read?.(sourcePath)?.forEach?.((newPath) => {
                        if (newPath?.endsWith?.('data.json')) {
                          const data = helper.readFile(
                            path?.join?.(sourcePath, newPath)
                          );
                          const getLastSegment = path => path?.trim().replace(/\/+$/, '').split('/').pop();
                          if (data?.item?.$?.name !== getLastSegment(sourcePath)) {
                            resultData?.push({ key: data?.item?.$?.name, value: data?.item?.$?.key })
                          }
                        }
                      })
                      sourceType = makeUnique({ data: resultData });
                    }
                  }
                } else {
                  if (isNotEmptyBraces(item?.content)) {
                    const refNameSplit = splitByPipe(item?.content)
                    const uniqueSpilt = [...new Set(refNameSplit)];
                    contentTypeKeyMapper({
                      template: { id: content_type?.contentstackUid },
                      contentType: { uid: { name, uid: field?.key, unique: uniqueSpilt } },
                      contentTypeKey: 'treeListRef'
                    });
                  }
                }
              }
            }
          }
          if (item?.key === extraField) {
            if (item?.content && item?.content !== '') {
              name = item?.content;
            }
          }
        });
        if ((!['Droplink', 'Multilist', 'Checklist', 'Droptree']?.includes?.(compType?.content)) && compType?.content) {
          groupSchema?.schema?.push(
            ContentTypeSchema({
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
            })
          );
        }
      }
      mainSchema?.push(...groupFlat(groupSchema, item));
    }
    const isUrlfound = mainSchema?.find(
      (rt) => rt?.contentstackFieldUid?.toLowerCase?.() === 'url'
    );
    if (isUrlfound === undefined) {
      mainSchema?.unshift({
        uid: 'url',
        otherCmsField: 'url',
        otherCmsType: 'text',
        contentstackField: 'Url',
        contentstackFieldUid: 'url',
        contentstackFieldType: 'url',
        backupFieldType: 'url',
        backupFieldUid: 'url'
      });
    }
    const isPresent = mainSchema?.find(
      (item) => item?.contentstackFieldUid?.toLowerCase?.() === 'title'
    );
    if (isPresent === undefined) {
      mainSchema.unshift({
        uid: 'title',
        otherCmsField: 'title',
        otherCmsType: 'text',
        contentstackField: 'Title',
        contentstackFieldUid: 'title',
        contentstackFieldType: 'text',
        backupFieldType: 'text',
        backupFieldUid: 'title'
      });
    }
  });
  return getUniqueFieldMappingsByUID(mainSchema);
};

const contentTypeMaker = ({ template, basePath, sitecore_folder, affix }) => {
  const content_type = {
    id: template?.id,
    status: 1,
    otherCmsTitle: template?.name,
    otherCmsUid: template?.key,
    isUpdated: false,
    updateAt: '',
    contentstackTitle: template?.name,
    contentstackUid: uidCorrector({ uid: template?.key })
  };
  template?.field?.forEach((item) => {
    if (item?.$?.key === '__base template' && item?.$?.type === 'tree list') {
      contentTypeKeyMapper({
        template,
        contentType: { uid: { ...item?.$, content: item?.content } },
        contentTypeKey: 'base'
      });
    }
  });
  content_type.fieldMapping = contentTypeMapper({
    components: template?.components,
    standardValues: template?.standardValues,
    content_type,
    basePath,
    sitecore_folder,
    affix
  });
  return content_type;
};

function findExactPath(path, searchTerm) {
  return path?.endsWith(searchTerm);
}

function singleContentTypeCreate({ templatePaths, globalPath, sitecore_folder, affix }) {
  const newPath = read(templatePaths);
  const templatesComponentsPath = [];
  let templatesStandaedValuePath = {};
  let templatesMetaDataPath = {};
  for (let i = 0; i < newPath?.length; i++) {
    if (findExactPath(newPath?.[i], 'data.json')) {
      const data = helper?.readFile(path?.join?.(templatePaths, newPath?.[i]));
      if (data?.item?.$?.template === 'template section') {
        templatesComponentsPath?.push({
          pth: path?.join?.(templatePaths, newPath?.[i] ?? '')?.split('/{')?.[0],
          obj: data
        });
      } else if (data?.item?.$?.template === 'template') {
        templatesMetaDataPath = data;
      } else if (data?.item?.$?.key?.includes?.('standard values')) {
        templatesStandaedValuePath = data;
      }
    }
  }
  const template = createTemplate({ components: templatesMetaDataPath });
  template.components = templatesComponents({
    path: templatesComponentsPath,
    basePath: templatePaths
  });
  template.standardValues = templateStandardValues({ components: templatesStandaedValuePath });
  const contentType = contentTypeMaker({ template, basePath: globalPath, sitecore_folder, affix });
  if (contentType?.fieldMapping?.length) {
    helper?.writeFile(
      path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, CONTENT_TYPES_DIR_NAME),
      JSON.stringify(contentType, null, 4),
      contentType?.contentstackUid,
      (err) => {
        if (err) throw err;
      }
    );
    contentTypeKeyMapper({ template, contentType: { uid: contentType?.contentstackUid } });
  }
  return true;
}

function ExtractContentTypes(sitecore_folder, affix, configData) {
  config = configData;
  const folder = read(sitecore_folder);
  const templatePaths = [];
  for (let i = 0; i < folder?.length; i++) {
    if (folder?.[i]?.includes('templates') && folder?.[i]?.endsWith('data.json')) {
      const data = helper?.readFile(path?.join?.(sitecore_folder, folder?.[i]));
      if (data?.item?.$?.template === 'template') {
        templatePaths?.push(path?.join?.(sitecore_folder, folder?.[i])?.split('/{')?.[0]);
      }
    }
  }
  if (templatePaths?.length) {
    const unique = [...new Set(templatePaths)];
    unique?.forEach((item) => {
      singleContentTypeCreate({ templatePaths: item, globalPath: folder, sitecore_folder, affix });
    });
  } else {
    throw { message: 'Templates Not Found.' };
  }
}

module.exports = ExtractContentTypes;
