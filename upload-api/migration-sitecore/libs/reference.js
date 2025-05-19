/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const read = require('fs-readdir-recursive');
const helper = require('../utils/helper');
const restrictedUid = require('../utils');
const { MIGRATION_DATA_CONFIG } = require('../constants/index.js');
const append = 'a';
const { DATA_MAPPER_DIR, CONTENT_TYPES_DIR_NAME, GLOBAL_FIELDS_FILE, GLOBAL_FIELDS_DIR_NAME } =
  MIGRATION_DATA_CONFIG;
const contentFolderPath = path.resolve(MIGRATION_DATA_CONFIG.DATA, CONTENT_TYPES_DIR_NAME) || {};

function startsWithNumber(str) {
  return /^\d/.test(str);
}

const uidCorrector = ({ uid }) => {
  if (startsWithNumber(uid)) {
    return `${append}_${_.replace(uid, new RegExp('[ -]', 'g'), '_')?.toLowerCase()}`;
  }
  return _.replace(uid, new RegExp('[ -]', 'g'), '_')?.toLowerCase();
};

const emptyGlobalFiled = () => {
  helper.writeFile(
    path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, GLOBAL_FIELDS_DIR_NAME),
    JSON.stringify([], null, 4),
    GLOBAL_FIELDS_FILE,
    (err) => {
      if (err) throw err;
    }
  );
};

function ExtractRef() {
  emptyGlobalFiled();
  const basePages = helper.readFile(
    path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, DATA_MAPPER_DIR, 'base.json')
  );
  const contentTypeKeys = helper.readFile(
    path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, DATA_MAPPER_DIR, 'contentTypeKey.json')
  );
  const treeListRef = helper.readFile(
    path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, DATA_MAPPER_DIR, 'treeListRef.json')
  );
  const globalFieldUids = [];
  const contentTypesPaths = read(contentFolderPath);
  if (contentTypesPaths?.length && (basePages || contentTypeKeys || treeListRef)) {
    contentTypesPaths?.forEach((item) => {
      const contentType = helper.readFile(path?.join?.(contentFolderPath, `${item}`));
      if (contentType?.id || contentType?.contentstackUid) {
        const refTree = treeListRef?.[contentType?.contentstackUid];
        if (refTree?.unique?.length) {
          const contentTypesPathsMaped = contentTypesPaths?.map((item) =>
            item?.replace?.('.json', '')
          );
          // refTree.unique = refTree?.unique?.map((item) => uidCorrector({ uid: item }));
          // const uids = contentTypesPathsMaped?.filter((item) => refTree?.unique?.includes(item));
          const uids = [];
          refTree?.unique?.forEach((item) => uids?.push(contentTypeKeys?.[item]))
          console.info(uids)
          if (uids?.length && uids?.[0] !== undefined) {
            let newUid = uidCorrector({ uid: refTree?.uid });
            const isPresent = restrictedUid?.find((item) => item === newUid);
            if (isPresent) {
              newUid = `${newUid}_changed`;
            }
            const schemaObject = {
              uid: refTree?.uid,
              otherCmsField: refTree?.name,
              otherCmsType: 'reference',
              contentstackField: refTree?.name,
              contentstackFieldUid: newUid,
              contentstackFieldType: 'reference',
              isDeleted: false,
              backupFieldType: 'reference',
              backupFieldUid: newUid,
              refrenceTo: uids
            };
            contentType.fieldMapping.push(schemaObject);
          }
        }
        const itHasBasePresent = basePages?.[contentType?.id];
        if (itHasBasePresent?.content) {
          const references = itHasBasePresent?.content?.split('|');
          if (references?.length) {
            const uids = [];
            references?.forEach((ref) => {
              const singleRef = contentTypeKeys?.[ref];
              if (singleRef) {
                uids?.push(singleRef);
              }
            });
            const newUid = contentType?.fieldMapping?.map((item) => item?.contentstackFieldUid);
            if (uids?.length) {
              uids?.forEach((key) => {
                globalFieldUids?.push(key);
                let newKey = key;
                const isPresent = newUid?.find((item) => item === key);
                if (isPresent) {
                  newKey = `${isPresent}_changed`;
                }
                const schemaObject = {
                  uid: newKey,
                  otherCmsField: newKey,
                  otherCmsType: 'base template',
                  contentstackField: newKey,
                  contentstackFieldUid: uidCorrector({ uid: newKey }),
                  contentstackFieldType: 'global_field',
                  isDeleted: false,
                  backupFieldType: 'global_field',
                  backupFieldUid: uidCorrector({ uid: newKey }),
                  refrenceTo: key
                };
                contentType.fieldMapping.push(schemaObject);
              });
            }
          }
        }
      }
      helper.writeFile(
        path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, CONTENT_TYPES_DIR_NAME),
        JSON.stringify(contentType, null, 4),
        contentType?.contentstackUid,
        (err) => {
          if (err) throw err;
        }
      );
    });
  }
  if (globalFieldUids?.length) {
    const unique = [...new Set(globalFieldUids)];
    const allGlobalFiels = [];
    const data = helper.readFile(
      path.join(
        process.cwd(),
        MIGRATION_DATA_CONFIG.DATA,
        GLOBAL_FIELDS_DIR_NAME,
        GLOBAL_FIELDS_FILE
      )
    );
    if (data?.length) {
      allGlobalFiels.push(...data);
    }
    unique?.forEach((item) => {
      const content = helper.readFile(path?.join?.(contentFolderPath, `${item}.json`));
      allGlobalFiels?.push(content);
    });
    if (allGlobalFiels?.length) {
      allGlobalFiels?.forEach((item) => {
        if (item?.fieldMapping) {
          const schemaData = [];
          item?.fieldMapping?.forEach?.((schema) => {
            if (!['title', 'url']?.includes(schema?.contentstackFieldUid)) {
              schemaData?.push(schema);
            }
          });
          item.fieldMapping = schemaData;
        } else {
          console.warn(`Item does not have fieldMapping:`, item);
        }
      });
      helper.writeFile(
        path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, GLOBAL_FIELDS_DIR_NAME),
        JSON.stringify(allGlobalFiels, null, 4),
        GLOBAL_FIELDS_FILE,
        (err) => {
          if (err) throw err;
        }
      );
    }
    unique?.forEach((item) => {
      fs.unlinkSync(path?.join?.(contentFolderPath, `${item}.json`));
    });
  }
  return {
    path: path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA),
    contentTypeUids: read(
      path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, CONTENT_TYPES_DIR_NAME)
    ),
    globalFieldUids: read(
      path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, GLOBAL_FIELDS_DIR_NAME)
    )
  };
}

module.exports = ExtractRef;
