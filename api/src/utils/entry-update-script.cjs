"use strict";

const isAssetField = (value) =>
    value && typeof value === 'object' && !Array.isArray(value) &&
    'urlPath' in value && 'filename' in value;

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

module.exports = async ({
    migration,
    config,
    stackSDKInstance
}) => {
    const assetMapping = config.__assetMapping__ || { old: {}, new: {} };
    delete config.__assetMapping__;

    const oldMapping = assetMapping.old || {};
    const newMapping = assetMapping.new || {};
    console.info(`Asset mappings loaded — old: ${Object.keys(oldMapping).length}, new: ${Object.keys(newMapping).length}`);

    const contentTypes = Object.keys(config);
    console.info('contentTypes', contentTypes);

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


                            const entry = await entryRef.fetch();
                            const updateData = JSON.parse(JSON.stringify(config[contentType][entryUid]));

                            if (entry.content && updateData.content) {
                                if (updateData.content && entry.content) {
                                    for (const field of Object.keys(updateData.content)) {
                                        if (isAssetField(updateData.content[field])) {
                                            updateData.content[field] = resolveAssetField(
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
                                Object.assign(entry.content, updateData.content);
                                await entry.update();
                            }
                            else {
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

    migration.addTask(updateEntryTask());
};
