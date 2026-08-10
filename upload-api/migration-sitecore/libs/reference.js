/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path');
const fs = require('fs');
const _ = require('lodash');
const read = require('fs-readdir-recursive');
const helper = require('../utils/helper');
const restrictedUid = require('../utils');
const { MIGRATION_DATA_CONFIG } = require('../constants/index.js');
const {
  observePackage,
  resolveObservation,
  describeResolution,
  needsUnionBlock,
  observedKinds,
  buildUnionBlockMapping
} = require('./observedReferences.js');
const append = 'a';
const {
  DATA_MAPPER_DIR,
  CONTENT_TYPES_DIR_NAME,
  GLOBAL_FIELDS_FILE,
  GLOBAL_FIELDS_DIR_NAME,
  USED_TEMPLATES_FILE_NAME
} = MIGRATION_DATA_CONFIG;
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

// A template that entries use directly AND other templates inherit from ships as both a content
// type (for its own entries) and a global field (inlined into the templates inheriting it).
// The content type keeps the plain uid — it's the natural owner of the name — so the global
// field copy takes this suffix to avoid colliding with it in the destination stack.
const DUAL_PURPOSE_GF_SUFFIX = '_base';

// Appended to the global field copy's id. The mapper strips braces and lowercases ids, so this
// suffix has to survive that normalization and stay distinct from the content type's id.
const DUAL_PURPOSE_GF_ID_SUFFIX = '-gf';

// The uid a base template's global field is published under. Pure base templates keep their
// uid as-is; dual-purpose ones yield the plain uid to their content type and take `_base`.
const globalFieldUidFor = (uid, usedContentTypeUids) =>
  usedContentTypeUids?.has?.(uid) ? `${uid}${DUAL_PURPOSE_GF_SUFFIX}` : uid;

// `sitecoreFolder` is the extracted package path. It is optional so existing callers
// keep working; without it the observed-value pass is skipped and reference fields fall
// back to the `source` definition, which only yields targets for the minority of
// definitions that spell their sources out as GUIDs.
function ExtractRef(sitecoreFolder) {
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
  // Template ids that content entries point at directly (written by ExtractContentTypes),
  // translated to contentstack uids so they can be matched against globalFieldUids.
  const usedTemplateIds = helper.readFile(
    path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, DATA_MAPPER_DIR, USED_TEMPLATES_FILE_NAME)
  );
  const usedContentTypeUids = new Set(
    (usedTemplateIds ?? [])
      .map((id) => contentTypeKeys?.[id])
      .filter(Boolean)
  );
  const globalFieldUids = [];
  // Resolve reference targets from the values entries actually hold. ExtractRef runs
  // after extractEntries, so the items are on disk by now — which is what makes this
  // possible here and not in the schema builder, which sees only template definitions.
  const observed = sitecoreFolder ? observePackage({ sitecoreFolder }) : null;
  const referenceLog = [];
  const contentTypesPaths = read(contentFolderPath);
  if (contentTypesPaths?.length || basePages || contentTypeKeys || treeListRef) {
    contentTypesPaths?.forEach((item) => {
      const contentType = helper.readFile(path?.join?.(contentFolderPath, `${item}`));
      if (contentType?.id || contentType?.contentstackUid) {
        if (contentType?.fieldMapping?.length) {
          const keptFields = [];
          for (const field of contentType?.fieldMapping ?? []) {
            if (field?.contentstackFieldType !== 'reference') {
              keptFields.push(field);
              continue;
            }
            // Prefer what the entries actually reference; the `source` definition is only
            // usable when it happens to list GUIDs.
            // Keyed on the template's `key`, not its `name`: an entry's `template`
            // attribute carries the key ("generic content page"), while the template
            // item's name is title-cased ("Generic Content Page"), so matching on name
            // would never hit. Lowercased on both sides as a further guard.
            const observation =
              observed?.observations?.[
                `${`${contentType?.otherCmsUid ?? ''}`.toLowerCase()}|${`${field?.uid ?? ''}`.toLowerCase()}`
              ];
            if (observation) {
              const resolved = resolveObservation({ observation, contentTypeKeys });
              referenceLog.push(describeResolution(observation, resolved));
              // A field pointing at more than one kind of thing (entries plus assets
              // and/or media folders) cannot be a reference — a reference holds only
              // entries, so the other values would be silently dropped. Emit a
              // single-select modular block with one branch per kind instead.
              if (needsUnionBlock(observation)) {
                keptFields.push(
                  ...buildUnionBlockMapping({
                    field,
                    observation,
                    referenceTo: resolved.referenceTo
                  })
                );
                referenceLog.push(
                  `Reference field "${observation.fieldKey}" on ${observation.template} was emitted as a single-select modular block (${observedKinds(
                    observation
                  ).join(' / ')}) because its targets span more than one kind.`
                );
                continue;
              }
              if (!resolved.usable) {
                // A reference with no valid target is the bug this replaces — leave the
                // field out rather than emitting one that points nowhere.
                delete field?.sourceKey;
                continue;
              }
              field.refrenceTo = resolved.referenceTo;
              field.multiple = resolved.multiple;
              delete field?.sourceKey;
              keptFields.push(field);
              continue;
            }
            if (field?.sourceKey) {
              const matches = field?.sourceKey?.content?.match?.(/\{[A-F0-9-]{36}\}/gi);
              const uids = [];
              if (matches?.length) {
                for (const uid of matches) {
                  contentTypeKeys?.[uid] ? uids?.push(contentTypeKeys?.[uid]) : null
                }
              }
              field.refrenceTo = uids;
              delete field?.sourceKey;
            }
            keptFields.push(field);
          }
          contentType.fieldMapping = keptFields;
        }
        const refTree = treeListRef?.[contentType?.contentstackUid];
        if (refTree?.unique?.length) {
          const contentTypesPathsMaped = contentTypesPaths?.map((item) =>
            item?.replace?.('.json', '')
          );
          refTree.unique = refTree?.unique?.map((item) => uidCorrector({ uid: item }));
          const uids = contentTypesPathsMaped?.filter((item) => refTree?.unique?.includes(item));
          if (uids?.length) {
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
                // Point at the uid the base template's global field is actually published
                // under: plain for a pure base template, `_base`-suffixed when it also ships
                // as a content type for its own entries.
                const globalFieldUid = globalFieldUidFor(key, usedContentTypeUids);
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
                  refrenceTo: globalFieldUid
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
      if (usedContentTypeUids?.has?.(item)) {
        // Dual-purpose template: it stays on disk as a content type too, so hand the global
        // field a deep clone — the title/url strip below mutates fieldMapping in place and
        // would otherwise gut the content type that entries still rely on. The clone yields
        // the plain uid to the content type and takes `_base`, and needs its own id since the
        // mapper keys records by id and the content type keeps the template GUID.
        const clone = _.cloneDeep(content);
        clone.contentstackUid = globalFieldUidFor(item, usedContentTypeUids);
        clone.id = `${content?.id ?? item}${DUAL_PURPOSE_GF_ID_SUFFIX}`;
        allGlobalFiels?.push(clone);
        return;
      }
      allGlobalFiels?.push(content);
    });
    if (allGlobalFiels?.length) {
      allGlobalFiels?.forEach((item) => {
        const schemaData = [];
        item?.fieldMapping?.forEach?.((schema) => {
          if (!['title', 'url']?.includes(schema?.contentstackFieldUid)) {
            schemaData?.push(schema);
          }
        });
        item.fieldMapping = schemaData;
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
      // A base template that entries also point at directly is both a global field (for the
      // templates inheriting it) and a content type (for its own entries). Only drop the
      // content type for pure base templates — nothing has entries under those.
      if (usedContentTypeUids?.has?.(item)) return;
      fs.unlinkSync(path?.join?.(contentFolderPath, `${item}.json`));
    });
  }
  // Surfaced so the caller can write these into the migration log: a field that ends up
  // dropped, or narrower than expected, should be visible rather than just absent.
  if (referenceLog.length) {
    console.info(
      `Reference resolution: ${referenceLog.length} reference field(s) processed from observed entry values.`
    );
  }
  return {
    path: path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA),
    referenceLog,
    contentTypeUids: read(
      path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, CONTENT_TYPES_DIR_NAME)
    ),
    globalFieldUids: read(
      path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, GLOBAL_FIELDS_DIR_NAME)
    )
  };
}

module.exports = ExtractRef;
