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
const {
  NAV_MENU_CONTENT_TYPE_TITLE,
  buildNavigationMenuFieldMapping,
  buildNavigationMenuEntryMapping,
  navigationReferenceTargets,
  isNavigationMenuContentType,
  isSuppressedNavigationTemplate
} = require('./navigation.js');
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

// Contentstack rejects a container with no children ("primary_content_details: should have a group
// schema"). Dropping a field can empty its group, and emptying an inner group can empty its parent,
// so prune repeatedly until stable. Shared by the per-content-type pass and the global-field
// cleanup so both prune identically.
const CONTAINER_TYPES = ['group', 'modular_blocks', 'modular_blocks_child'];

const pruneEmptyContainers = (fields, ownerUid, referenceLog) => {
  let pruned = fields ?? [];
  for (;;) {
    const hasChild = (uid) =>
      pruned.some((other) => `${other?.contentstackFieldUid ?? ''}`.startsWith(`${uid}.`));
    const next = pruned.filter((f) => {
      if (!CONTAINER_TYPES.includes(f?.contentstackFieldType)) return true;
      if (hasChild(f?.contentstackFieldUid)) return true;
      referenceLog?.push(
        `Container field "${f?.contentstackFieldUid}" (${f?.contentstackFieldType}) on ${ownerUid} was dropped: every child field was removed, and Contentstack rejects an empty container.`
      );
      return false;
    });
    if (next.length === pruned.length) return next;
    pruned = next;
  }
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
    // Navigation is denormalised: each root menu becomes one entry carrying its whole subtree in
    // nested modular blocks, so the nested groups and elements — and the container itself — ship no
    // content type of their own. Computed once here because it needs the observed item index (the
    // only place the item tree is available) plus contentTypeKeys.
    const navReferenceTargets = observed?.itemIndex
      ? navigationReferenceTargets({ itemIndex: observed.itemIndex, contentTypeKeys })
      : [];

    contentTypesPaths?.forEach((item) => {
      const contentType = helper.readFile(path?.join?.(contentFolderPath, `${item}`));

      // Nested nav groups and elements become blocks, never entries, so their content types would
      // be created empty and referenced by nothing.
      if (isSuppressedNavigationTemplate(contentType?.otherCmsUid)) {
        try {
          fs.unlinkSync(path?.join?.(contentFolderPath, `${item}`));
        } catch (err) {
          console.error('ExtractRef: could not remove suppressed navigation content type', item, err);
        }
        referenceLog.push(
          `Navigation: template "${contentType?.otherCmsUid}" ships no content type — its items are modular blocks inside a menu entry.`
        );
        return;
      }

      if (isNavigationMenuContentType(contentType) && observed?.itemIndex) {
        contentType.contentstackTitle = NAV_MENU_CONTENT_TYPE_TITLE;
        contentType.fieldMapping = buildNavigationMenuFieldMapping(navReferenceTargets);
        contentType.entryMapping = buildNavigationMenuEntryMapping({
          itemIndex: observed.itemIndex,
          contentTypeUid: contentType?.contentstackUid
        });
        referenceLog.push(
          `Navigation: ${contentType?.contentstackUid} rebuilt as ${contentType.entryMapping.length} menu entries with nested blocks (content_item targets: ${navReferenceTargets.join(', ') || 'none'}).`
        );
        // The synthetic schema replaces the template's fields wholesale, so the reference,
        // treelist and base-template passes below have nothing to contribute — and the base-template
        // pass would re-attach Navigation Element as a global field, undoing the denormalisation.
        helper.writeFile(
          path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, CONTENT_TYPES_DIR_NAME),
          JSON.stringify(contentType, null, 4),
          contentType?.contentstackUid,
          (err) => {
            if (err) throw err;
          }
        );
        return;
      }

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
            // Same rule the observed-value branch above applies: a reference that resolves to
            // nothing must not ship. Contentstack rejects `reference_to` shorter than 1
            // ("schema.0.schema.0.reference_to: should have a minimum length of 1"), and the failure
            // is not contained — the field is accepted at creation, fails on update, and then every
            // entry of a content type using it dies reading `reference_to.length`. One such field on
            // the `call_to_action` global field cost all 645 `page_title_text_and_image` entries.
            if (!field?.refrenceTo?.length) {
              referenceLog.push(
                `Reference field "${field?.uid}" on ${contentType?.contentstackUid} was dropped: it resolved to no content type, and an empty reference_to is rejected by Contentstack.`
              );
              continue;
            }
            keptFields.push(field);
          }
          // Dropping a field can empty its container; prune those before writing.
          contentType.fieldMapping = pruneEmptyContainers(
            keptFields,
            contentType?.contentstackUid,
            referenceLog
          );
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
      // A global field can lose every field once unresolvable references and the containers holding
      // them are pruned. Contentstack will not accept an empty global field, and a content type that
      // still points at one fails on update and then takes all of its entries down with it. Drop
      // both sides together.
      const emptyGlobalFieldUids = new Set(
        allGlobalFiels
          .filter((item) => !item?.fieldMapping?.length)
          .map((item) => item?.contentstackUid)
          .filter(Boolean)
      );
      if (emptyGlobalFieldUids.size) {
        for (let i = allGlobalFiels.length - 1; i >= 0; i -= 1) {
          if (emptyGlobalFieldUids.has(allGlobalFiels[i]?.contentstackUid)) {
            referenceLog.push(
              `Global field "${allGlobalFiels[i]?.contentstackUid}" was dropped: every field it held was removed.`
            );
            allGlobalFiels.splice(i, 1);
          }
        }
        // Strip the now-dangling global_field rows from every content type that referenced one.
        read(contentFolderPath)?.forEach((file) => {
          const ct = helper.readFile(path?.join?.(contentFolderPath, `${file}`));
          if (!ct?.fieldMapping?.length) return;
          const kept = ct.fieldMapping.filter((f) => {
            if (
              f?.contentstackFieldType === 'global_field' &&
              emptyGlobalFieldUids.has(f?.refrenceTo)
            ) {
              referenceLog.push(
                `Global field reference "${f?.contentstackFieldUid}" on ${ct?.contentstackUid} was dropped: ${f?.refrenceTo} ships no fields.`
              );
              return false;
            }
            return true;
          });
          if (kept.length === ct.fieldMapping.length) return;
          ct.fieldMapping = pruneEmptyContainers(kept, ct?.contentstackUid, referenceLog);
          helper.writeFile(
            path.join(process.cwd(), MIGRATION_DATA_CONFIG.DATA, CONTENT_TYPES_DIR_NAME),
            JSON.stringify(ct, null, 4),
            ct?.contentstackUid,
            (err) => {
              if (err) throw err;
            }
          );
        });
      }
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
