"use strict";

const isAssetField = (value) =>
    value && typeof value === 'object' && !Array.isArray(value) &&
    'urlPath' in value && 'filename' in value;

/** Shape produced by processField's 'reference' case: { uid, _content_type_uid }. */
const isReferenceValue = (value) =>
    value && typeof value === 'object' && !Array.isArray(value) &&
    'uid' in value && '_content_type_uid' in value;

const isReferenceArray = (value) =>
    Array.isArray(value) && value.length > 0 && value.every(isReferenceValue);

/**
 * Resolves a source-side entry uid to its real Contentstack destination uid.
 *
 * The export JSON's reference fields carry the SOURCE cms entry id (see
 * `contentful.service.ts`'s `createRefrence`), which only happens to equal the
 * Contentstack uid when entries are imported preserving source ids. The
 * bulk/master-locale import resolves this correctly via the CLI's own
 * reference pass; this update path does not, so it needs the same uid-mapper
 * data the asset resolution above already uses (see `entryMapping`).
 *
 * Preference order: per-locale mapping (most precise — handles entries that
 * ended up as distinct Contentstack uids per locale across iterations) →
 * flat mapping → identity fallback (keeps existing behavior when no mapping
 * data exists, e.g. simple setups where source id equals destination uid).
 */
const resolveReferenceUid = (sourceUid, locale, entryMapping) => {
    if (!sourceUid) return sourceUid;
    const newByLocale = entryMapping?.new?.byLocale?.[locale]?.[sourceUid];
    if (newByLocale) return newByLocale;
    const oldByLocale = entryMapping?.old?.byLocale?.[locale]?.[sourceUid];
    if (oldByLocale) return oldByLocale;
    const newFlat = entryMapping?.new?.flat?.[sourceUid];
    if (newFlat) return newFlat;
    const oldFlat = entryMapping?.old?.flat?.[sourceUid];
    if (oldFlat) return oldFlat;
    return sourceUid;
};

/**
 * Remaps the uid(s) inside a reference field value (single link object or
 * array of link objects) to their Contentstack destination uids.
 */
const resolveReferenceField = (fieldName, entryUid, value, locale, entryMapping) => {
    if (isReferenceValue(value)) {
        const resolved = resolveReferenceUid(value.uid, locale, entryMapping);
        if (resolved !== value.uid) {
            console.info(`[${entryUid}] "${fieldName}"${locale ? ` (${locale})` : ''}: resolved reference uid "${value.uid}" → "${resolved}"`);
        }
        return { ...value, uid: resolved };
    }
    if (isReferenceArray(value)) {
        return value.map((item) => {
            const resolved = resolveReferenceUid(item.uid, locale, entryMapping);
            return { ...item, uid: resolved };
        });
    }
    return value;
};

/** Export JSON metadata — not Contentstack content-type field UIDs (WordPress entries are flat). */
const FLAT_PAYLOAD_SKIP = new Set([
    'uid',
    'publish_details',
    'locale',
    'tags',
    'ACL',
    '_version',
    'created_at',
    'updated_at',
    'created_by',
    'updated_by',
    '_content_type_uid',
    'content',
    '__locale',
    '__csUid',
]);

/**
 * 3-way asset resolution:
 *  1. newMapping has a UID for this source asset  → asset was re-imported, always use it
 *  2. oldMapping has a UID but stack differs      → user changed it manually, keep user's choice
 *  3. oldMapping has a UID and stack matches      → nothing changed, keep as-is
 *  4. No mapping at all                           → keep whatever is on the stack
 */
const resolveAssetField = (fieldName, entryUid, updateValue, stackValue, oldMapping, newMapping) => {
    const sourceCmsUid = updateValue?.uid;
    if (!sourceCmsUid) {
        return stackValue || updateValue;
    }

    const newMappedUid = newMapping[sourceCmsUid];
    const oldMappedUid = oldMapping[sourceCmsUid];
    const currentStackUid = stackValue?.uid;

    if (newMappedUid) {
        console.info(`[${entryUid}] "${fieldName}": Using newly imported asset "${newMappedUid}" (source: ${sourceCmsUid})`);
        if (stackValue && typeof stackValue === 'object') {
            return { ...stackValue, uid: newMappedUid };
        }
        return { uid: newMappedUid };
    }

    if (oldMappedUid && currentStackUid && currentStackUid !== oldMappedUid) {
        console.info(`[${entryUid}] "${fieldName}": Keeping user-modified asset "${currentStackUid}" (original was: ${oldMappedUid})`);
        return stackValue;
    }

    if (oldMappedUid) {
        console.info(`[${entryUid}] "${fieldName}": Keeping original mapped asset "${oldMappedUid}"`);
        if (stackValue && typeof stackValue === 'object') {
            return stackValue;
        }
        return { ...updateValue, uid: oldMappedUid };
    }

    console.info(`[${entryUid}] "${fieldName}": No mapping found, keeping stack asset`);
    return stackValue || updateValue;
};

/**
 * WordPress (and similar) write migration JSON with fields at the root (email, url, …).
 * Fetched stack entries keep custom fields under entry.content — merge flat updateData there.
 */
const mergeFlatPayloadIntoEntry = async (entry, entryUid, updateData, oldMapping, newMapping, updateOpts, locale, entryMapping) => {
    for (const field of Object.keys(updateData)) {
        if (FLAT_PAYLOAD_SKIP.has(field)) {
            continue;
        }
        if (field === 'title') {
            if (updateData?.title !== undefined && updateData?.title !== null) {
                entry.title = updateData?.title;
            }
            continue;
        }
        let nextVal = updateData[field];
        if (isAssetField(nextVal)) {
            nextVal = resolveAssetField(
                field,
                entryUid,
                nextVal,
                entry?.content[field],
                oldMapping,
                newMapping
            );
        } else if (isReferenceValue(nextVal) || isReferenceArray(nextVal)) {
            nextVal = resolveReferenceField(field, entryUid, nextVal, locale, entryMapping);
        }
        entry.content[field] = nextVal;
    }
    await entry.update(updateOpts);
};

module.exports = async ({
    migration,
    config,
    stackSDKInstance
}) => {
    const assetMapping = config.__assetMapping__ || { old: {}, new: {} };
    delete config.__assetMapping__;

    const entryMapping = config.__entryMapping__ || { old: { flat: {}, byLocale: {} }, new: { flat: {}, byLocale: {} } };
    delete config.__entryMapping__;

    // Assets the user chose to update in place (same UID, new file).
    const assetUpdates = Array.isArray(config.__assetUpdates__) ? config.__assetUpdates__ : [];
    delete config.__assetUpdates__;

    const oldMapping = assetMapping.old || {};
    const newMapping = assetMapping.new || {};
    console.info(`Asset mappings loaded — old: ${Object.keys(oldMapping).length}, new: ${Object.keys(newMapping).length}`);
    console.info(`Entry mappings loaded — old: ${Object.keys(entryMapping?.old?.flat || {}).length} flat / ${Object.keys(entryMapping?.old?.byLocale || {}).length} locales, new: ${Object.keys(entryMapping?.new?.flat || {}).length} flat / ${Object.keys(entryMapping?.new?.byLocale || {}).length} locales`);
    console.info(`Asset updates to replace in place: ${assetUpdates.length}`);

    const contentTypes = Object.keys(config);
    console.info('contentTypes', contentTypes);

    /**
     * Replaces each selected asset's binary on the existing Contentstack asset
     * UID. A single asset failing is logged and skipped so it never aborts the
     * remaining asset or entry updates.
     */
    const updateAssetTask = () => {
        return {
            title: "Update Assets",
            successMessage: 'Assets updated successfully',
            failedMessage: "Failed to update assets",
            task: async () => {
                for (const asset of assetUpdates) {
                    if (!asset || !asset.uid || !asset.filePath) {
                        continue;
                    }
                    try {
                        await stackSDKInstance
                            .asset(asset.uid)
                            .replace({ upload: asset.filePath, title: asset.title });
                        console.info(`Replaced asset in place: ${asset.uid} (${asset.filename})`);
                    } catch (error) {
                        console.error(`Failed to replace asset ${asset.uid} (${asset.filename}):`, error?.message || error);
                    }
                }
                console.info('All asset updates processed');
            },
        };
    };

    const updateEntryTask = () => {
        return {
            title: "Update Entries",
            successMessage: 'Entries Updated Successfully',
            failedMessage: "Failed to update entries",
            task: async () => {
                try {
                    for (const contentType of contentTypes) {
                        const entryUids = Object.keys(config[contentType]);
                        console.info(`Processing content type: ${contentType}, entries: ${entryUids.length}`);

                        for (const entryUid of entryUids) {
                            const updateData = JSON.parse(JSON.stringify(config[contentType][entryUid]));
                            // Per-locale config keys are "<csUid>::<locale>" with __locale/__csUid
                            // on the payload. Fall back to the bare key for legacy single-locale
                            // configs.
                            const locale = updateData?.__locale;
                            const realEntryUid = updateData?.__csUid || entryUid;
                            delete updateData?.__locale;
                            delete updateData?.__csUid;
                            const fetchOpts = locale ? { locale } : undefined;
                            const updateOpts = locale ? { locale } : undefined;

                            const entryRef = stackSDKInstance
                                .contentType(contentType)
                                .entry(realEntryUid);

                            const entry = await entryRef?.fetch(fetchOpts);

                            const hasStackContent = entry?.content && typeof entry?.content === 'object';
                            const hasNestedUpdate = updateData?.content && typeof updateData?.content === 'object';

                            if (hasStackContent && hasNestedUpdate) {
                                for (const field of Object.keys(updateData?.content)) {
                                    if (isAssetField(updateData?.content[field])) {
                                        updateData.content[field] = resolveAssetField(
                                            field,
                                            entryUid,
                                            updateData?.content[field],
                                            entry?.content[field],
                                            oldMapping,
                                            newMapping
                                        );
                                    } else if (isReferenceValue(updateData?.content[field]) || isReferenceArray(updateData?.content[field])) {
                                        updateData.content[field] = resolveReferenceField(
                                            field,
                                            entryUid,
                                            updateData?.content[field],
                                            locale,
                                            entryMapping
                                        );
                                    }
                                }
                                Object.assign(entry?.content, updateData?.content);
                                await entry.update(updateOpts);
                            } else if (hasStackContent) {
                                console.info(`[${realEntryUid}] Merging flat migration payload into entry.content (e.g. WordPress export)${locale ? ` for locale "${locale}"` : ''}`);
                                await mergeFlatPayloadIntoEntry(entry, realEntryUid, updateData, oldMapping, newMapping, updateOpts, locale, entryMapping);
                            } else {
                                if (updateData && entry) {
                                    for (const field of Object.keys(updateData)) {
                                        if (isAssetField(updateData[field])) {
                                            updateData[field] = resolveAssetField(
                                                field,
                                                entryUid,
                                                updateData[field],
                                                entry[field],
                                                oldMapping,
                                                newMapping
                                            );
                                        } else if (isReferenceValue(updateData[field]) || isReferenceArray(updateData[field])) {
                                            updateData[field] = resolveReferenceField(
                                                field,
                                                entryUid,
                                                updateData[field],
                                                locale,
                                                entryMapping
                                            );
                                        }
                                    }
                                }
                                Object.assign(entry, updateData);
                                await entry.update(updateOpts);
                            }
                            console.info(`Updated entry: ${realEntryUid}${locale ? ` (locale "${locale}")` : ''}`);
                        }
                    }
                    console.info('All entries updated successfully');
                } catch (error) {
                    console.error(error);
                    throw error;
                }
            },
        };
    };

    if (assetUpdates.length) {
        migration.addTask(updateAssetTask());
    }
    migration.addTask(updateEntryTask());
};

// Exposed for unit testing only. The CLI invokes the default function export
// above; these pure helpers are attached as properties on it so `require()`
// consumers keep calling the function directly while tests can exercise the
// helpers in isolation.
module.exports.isAssetField = isAssetField;
module.exports.resolveAssetField = resolveAssetField;
module.exports.mergeFlatPayloadIntoEntry = mergeFlatPayloadIntoEntry;
module.exports.isReferenceValue = isReferenceValue;
module.exports.isReferenceArray = isReferenceArray;
module.exports.resolveReferenceUid = resolveReferenceUid;
module.exports.resolveReferenceField = resolveReferenceField;
