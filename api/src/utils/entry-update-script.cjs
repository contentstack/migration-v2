"use strict";

const isAssetField = (value) =>
    value && typeof value === 'object' && !Array.isArray(value) &&
    'urlPath' in value && 'filename' in value;

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
const mergeFlatPayloadIntoEntry = async (entry, entryUid, updateData, oldMapping, newMapping) => {
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
        }
        entry.content[field] = nextVal;
    }
    await entry.update();
};

module.exports = async ({
    migration,
    config,
    stackSDKInstance
}) => {
    const assetMapping = config.__assetMapping__ || { old: {}, new: {} };
    delete config.__assetMapping__;

    // Assets the user chose to update in place (same UID, new file).
    const assetUpdates = Array.isArray(config.__assetUpdates__) ? config.__assetUpdates__ : [];
    delete config.__assetUpdates__;

    const oldMapping = assetMapping.old || {};
    const newMapping = assetMapping.new || {};
    console.info(`Asset mappings loaded — old: ${Object.keys(oldMapping).length}, new: ${Object.keys(newMapping).length}`);
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
                            const entryRef = stackSDKInstance
                                .contentType(contentType)
                                .entry(entryUid);


                            const entry = await entryRef?.fetch();
                            const updateData = JSON.parse(JSON.stringify(config[contentType][entryUid]));

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
                                    }
                                }
                                Object.assign(entry?.content, updateData?.content);
                                await entry.update();
                            } else if (hasStackContent) {
                                console.info(`[${entryUid}] Merging flat migration payload into entry.content (e.g. WordPress export)`);
                                await mergeFlatPayloadIntoEntry(entry, entryUid, updateData, oldMapping, newMapping);
                            } else {
                                if (updateData && entry) {
                                    for (const field of Object.keys(updateData)) {
                                        if (isAssetField(updateData[field])) {
                                            console.info('field is asset field');
                                            updateData[field] = resolveAssetField(
                                                field,
                                                entryUid,
                                                updateData[field],
                                                entry[field],
                                                oldMapping,
                                                newMapping
                                            );
                                        }
                                    }
                                }
                                Object.assign(entry, updateData);
                                await entry.update();
                            }
                            console.info(`Updated entry: ${entryUid}`);
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
