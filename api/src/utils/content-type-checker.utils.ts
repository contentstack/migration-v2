import path from 'path';
import fs from 'fs';
import getContentTypesMapperDb from '../models/contentTypesMapper-lowdb.js';

/**
 * Checks if a content type has already been created in any previous iteration.
 * This prevents duplicate content type creation during delta migrations.
 * 
 * @param projectId - The project ID to check
 * @param contentTypeUid - The content type UID (otherCmsUid) to check
 * @param currentIteration - The current iteration number
 * @returns true if content type already exists in previous iterations, false otherwise
 */
export const isContentTypeAlreadyCreated = async (
    projectId: string,
    contentTypeUid: string,
    currentIteration: number
): Promise<boolean> => {
    // For iteration 1, no previous iterations exist
    if (currentIteration <= 1) {
        return false;
    }

    // Check all previous iterations (1 to currentIteration-1)
    for (let i = 1; i < currentIteration; i++) {
        try {
            // Check if iteration directory exists
            const iterationPath = path.join(process.cwd(), 'database', projectId, i.toString());
            if (!fs.existsSync(iterationPath)) {
                continue; // Skip missing iterations
            }

            // Read the contentTypesMapper database for this iteration
            const contentTypesMapperDb = getContentTypesMapperDb(projectId, i);
            await contentTypesMapperDb.read();

            // Check if any content type matches the given UID
            const contentTypes = contentTypesMapperDb.data?.ContentTypesMappers || [];
            const exists = contentTypes.some(
                (ct: any) => ct.otherCmsUid === contentTypeUid
            );

            if (exists) {
                console.info(`Content type '${contentTypeUid}' already created in iteration ${i}`);
                return true;
            }
        } catch (error) {
            console.warn(`Failed to check iteration ${i} for content type '${contentTypeUid}' : `, error);
            // Continue checking other iterations even if one fails
            continue;
        }
    }

    return false;
};

/**
 * Gets all content type UIDs that have been created in previous iterations.
 * Useful for bulk checking or debugging purposes.
 * 
 * @param projectId - The project ID to check
 * @param currentIteration - The current iteration number
 * @returns Array of content type UIDs that already exist
 */
export const getPreviouslyCreatedContentTypes = async (
    projectId: string,
    currentIteration: number
): Promise<string[]> => {
    const existingContentTypes = new Set<string>();

    // For iteration 1, no previous iterations exist
    if (currentIteration <= 1) {
        return [];
    }

    // Check all previous iterations
    for (let i = 1; i < currentIteration; i++) {
        try {
            // Check if iteration directory exists
            const iterationPath = path.join(process.cwd(), 'database', projectId, i.toString());
            if (!fs.existsSync(iterationPath)) {
                continue; // Skip missing iterations
            }

            // Read the contentTypesMapper database for this iteration
            const contentTypesMapperDb = getContentTypesMapperDb(projectId, i);
            await contentTypesMapperDb.read();


            // Collect all content type UIDs from this iteration
            const contentTypes = contentTypesMapperDb.data?.ContentTypesMappers || [];
            contentTypes.forEach((ct: any) => {
                if (ct?.otherCmsUid) {
                    existingContentTypes.add(ct?.otherCmsUid);
                }
            });
        } catch (error) {
            console.warn(`Failed to read iteration ${i}: `, error);
            // Continue checking other iterations
            continue;
        }
    }

    return Array.from(existingContentTypes);
};

/**
 * Checks if a content type should be skipped during creation.
 * This is a convenience wrapper around isContentTypeAlreadyCreated.
 * 
 * @param projectId - The project ID to check
 * @param contentTypeUid - The content type UID to check
 * @param currentIteration - The current iteration number
 * @returns true if content type should be skipped, false if it should be created
 */
export const shouldSkipContentTypeCreation = async (
    projectId: string,
    contentTypeUid: string,
    currentIteration: number
): Promise<boolean> => {
    return await isContentTypeAlreadyCreated(projectId, contentTypeUid, currentIteration)
};