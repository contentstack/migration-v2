/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request } from 'express';
import fs from 'fs';
import path from 'path';
import { getLogMessage, isEmpty, safePromise } from '../utils/index.js';
import {
  BadRequestError,
  ExceptionFunction,
} from '../utils/custom-errors.utils.js';
import {
  HTTP_TEXTS,
  HTTP_CODES,
  STEPPER_STEPS,
  NEW_PROJECT_STATUS,
  CONTENT_TYPE_STATUS,
  VALIDATION_ERRORS,
  MIGRATION_DATA_CONFIG,
  CMS,
} from '../constants/index.js';
import logger from '../utils/logger.js';
import { config } from '../config/index.js';
import https from '../utils/https.utils.js';
import getAuthtoken, { getAccessToken } from '../utils/auth.utils.js';
import getProjectUtil from '../utils/get-project.utils.js';
import fetchAllPaginatedData from '../utils/pagination.utils.js';
import { requestWithSsoTokenRefresh } from '../utils/sso-request.utils.js';
import ProjectModelLowdb from '../models/project-lowdb.js';
import FieldMapperModel from '../models/FieldMapper.js';
import { v4 as uuidv4 } from 'uuid';
import getFieldMapperDb from "../models/FieldMapper.js";
import getEntryMapperDb, { EntryMapper } from "../models/EntryMapper.js";
import getAssetMapperDb, { AssetMapper } from "../models/assetMapper.js";
import getContentTypesMapperDb, { ContentTypesMapper } from "../models/contentTypesMapper-lowdb.js";
import getUidMapperDb from "../models/uidMapper.js";
import { isDuplicateEntry } from '../utils/entry-duplicate.utils.js';
import { getSourceLocaleForDestination } from '../utils/locale-migration.utils.js';
import { loadPreviousAssetMetadata } from '../utils/asset-update.utils.js';
import { flattenNestedUidMap } from '../utils/uid-mapper.utils.js';
import { contentfulService } from './contentful.service.js';
import { sanitizeStackId, assertResolvedPathUnderBase } from '../utils/sanitize-path.utils.js';


const idCorrector = ({ id }: { id: string }) => {
  const newId = id?.replace(/[-{}]/g, (match) =>
    match === '-' ? '' : ''
  );
  if (newId) {
    return newId?.toLowerCase();
  } else {
    return id;
  }
};


// Developer service to create dummy contentmapping data
/**
 * Updates the test data for a given project.
 *
 * @param req - The request object containing the project ID and content types.
 * @returns The updated project data.
 */
const putTestData = async (req: Request) => {
  const projectId = req?.params?.projectId;
  const contentTypes = req?.body?.contentTypes;

  try {
    // Get project data to extract iteration
    await ProjectModelLowdb.read();
    const projectData = ProjectModelLowdb.chain
      .get("projects")
      .find({ id: projectId })
      .value();
    const iteration = projectData?.iteration || 1;

    /*
 this code snippet is iterating over an array called contentTypes and 
 transforming each element by adding a unique identifier (id) if it doesn't already exist. 
 The transformed elements are then stored in the contentType variable, 
 and the generated id values are pushed into the contentIds array.
 */
    const ContentTypesMapperModelLowdb = getContentTypesMapperDb(projectId, iteration);
    await ContentTypesMapperModelLowdb.read();
    if (!Array?.isArray?.(contentTypes)) {
      throw new BadRequestError(HTTP_TEXTS.CONTENT_TYPE_INVALID);
    }
    const contentIds: any[] = [];
    const contentType = contentTypes.map((item: any) => {
      const id = item?.id?.replace(/[{}]/g, '')?.toLowerCase() || uuidv4();
      item.id = id;
      contentIds.push(id);
      return { ...item, id, projectId };
    });

    contentTypes?.forEach((items: any) => {
      items?.fieldMapping?.forEach?.((item: any) => {
        if (item?.advanced) {
          item.advanced.initial = structuredClone(item?.advanced);
        }
        if (item?.refrenceTo) {
          item.initialRefrenceTo = item?.refrenceTo;
        }
      })
    });

    const sanitizeObject = (obj: Record<string, any>) => {
      const blockedKeys = ['__proto__', 'prototype', 'constructor'];
      const safeObj: Record<string, any> = {};
      for (const key in obj) {
        if (!blockedKeys.includes(key)) {
          safeObj[key] = obj[key];
        }
      }
      return safeObj;
    };

    /*
    this code snippet iterates over an array of contentTypes and performs 
    some operations on each element. 
    It creates a new array called fields by mapping over the fieldMapping property of each type in contentTypes. 
    It generates a unique identifier for each field, pushes it into the fieldIds array, 
    and returns an object with additional properties. 
    It then updates the field_mapper property of a data object using the FieldMapperModel.update() function. 
    Finally, it updates the fieldMapping property of each type in the contentTypes array with the fieldIds array.
    */

    const FieldMapperModel = getFieldMapperDb(projectId, iteration);
    await FieldMapperModel.read();
    
    // Collect all fields from all content types first
    const allFields: any[] = [];
    
    for (let index = 0; index < contentType?.length; index++) {
      const type: any = contentTypes[index];
      const fieldIds: string[] = [];

      const fields = Array.isArray(type?.fieldMapping) ?
        type.fieldMapping
          .filter(Boolean)
          .map((field: any) => {
            const safeField = sanitizeObject(field);

            const id = safeField?.id
              ? safeField.id.replace(/[{}]/g, '').toLowerCase()
              : uuidv4();
            safeField.id = id;

            fieldIds.push(id);

            return {
              ...safeField,
              id,
              projectId,
              contentTypeId: type?.id,
              isDeleted: false,
            };
          })
        : [];

      // Add to collection instead of updating DB
      allFields.push(...fields);
      
      if (
        Array?.isArray?.(contentType) &&
        Number?.isInteger?.(index) &&
        index >= 0 &&
        index < contentType?.length
      ) {
        contentType[index].fieldMapping = fieldIds;
      }
    }

    // Single update with all fields
    await FieldMapperModel.update((data: any) => {
      data.field_mapper = allFields;
    });

    const EntryMapperModel = getEntryMapperDb(projectId, iteration);
    await EntryMapperModel.read();

    const uidMapperCurrent = getUidMapperDb(projectId, iteration);
    await uidMapperCurrent.read();
    const uidMapperPrev: any = iteration > 1 ? await getNearestPriorUidMapper(projectId, iteration) : null;

    const mergeEntry = (base: any, incoming: any) => {
      const keep = { ...(base ?? {}) };
      const add = { ...(incoming ?? {}) };

      if (!keep?.contentstackEntryUid && add?.contentstackEntryUid) {
        keep.contentstackEntryUid = add.contentstackEntryUid;
      }

      if (!keep?.id && add?.id) {
        keep.id = add.id;
      }

      Object.keys(add).forEach((k) => {
        if (add[k] !== undefined) {
          keep[k] = add[k];
        }
      });

      return keep;
    };

    const entryKey = (e: any) =>
      `${e?.contentTypeId ?? e?.contentTypeUid ?? ''}:${e?.otherCmsEntryUid ?? ''}`;

    // Collect all entries from all content types first
    const allEntries: any[] = [];

    for (let index = 0; index < contentTypes?.length; index++) {
      const type: any = contentTypes[index];
      const entryIds: string[] = [];

      const entries = Array.isArray(type?.entryMapping) ?
        type.entryMapping
          .filter(Boolean)
          .map((entry: any) => {
            const id = entry?.id
              ? entry.id.replace(/[{}]/g, '').toLowerCase()
              : uuidv4();
            entry.id = id;
            entryIds.push(id);

            const otherCmsUidRaw = (entry?.otherCmsEntryUid ?? id) as string;
            const uidMapperValue = resolveContentstackEntryUidAcrossIterations(
              entry?.otherCmsEntryUid,
              id,
              uidMapperCurrent,
              uidMapperPrev,
            );

            return {
              ...entry,
              id,
              otherCmsEntryUid: entry?.otherCmsEntryUid,
              projectId,
              contentTypeUid: entry?.contentTypeUid ?? type?.otherCmsUid ?? type?.contentTypeUid,
              contentTypeId: type?.id,
              isDeleted: false,
              contentstackEntryUid: uidMapperValue,
            };
          })
        : [];

      // Add to collection instead of updating DB
      allEntries.push(...entries);

      if (
        Array?.isArray?.(contentType) &&
        Number?.isInteger?.(index) &&
        index >= 0 &&
        index < contentType?.length
      ) {
        contentType[index].entryMapping = entryIds;
      }
    }

    // Single update with all entries
    await EntryMapperModel.update((data: any) => {
      data.entry_mapper = allEntries;
    });

    // Store asset mapping rows when the connector provides them (connectors
    // that can derive stable asset uids at upload time, e.g. AEM). A matched,
    // changed asset defaults to isUpdate=true ("update the existing asset in
    // place"); unchanged matched assets default to reuse; brand-new assets are
    // imported normally.
    if (Array.isArray(req?.body?.assetMapping)) {
      const AssetMapperModel = getAssetMapperDb(projectId, iteration);
      await AssetMapperModel.read();
      const prevAssetMetadata: Record<string, any> =
        iteration > 1 ? loadPreviousAssetMetadata(projectId, iteration - 1) : {};

      const assetRows = req.body.assetMapping
        .filter(Boolean)
        .map((asset: any) => {
          const sourceUid = (asset?.otherCmsAssetUid ?? asset?.id ?? '') as string;
          const contentstackAssetUid =
            (uidMapperCurrent?.data as any)?.assets?.[sourceUid] ??
            (uidMapperPrev?.data as any)?.assets?.[sourceUid] ??
            '';
          const prev = prevAssetMetadata?.[sourceUid];
          const isChanged = prev
            ? String(prev?.filename ?? '') !== String(asset?.filename ?? '') ||
              String(prev?.file_size ?? '') !== String(asset?.file_size ?? '')
            : false;

          return {
            ...asset,
            id: String(asset?.id ?? sourceUid ?? uuidv4()).replace(/[{}]/g, '').toLowerCase(),
            projectId,
            otherCmsAssetUid: sourceUid,
            contentstackAssetUid,
            isChanged,
            isUpdate: Boolean(contentstackAssetUid) && isChanged,
          };
        })
        .filter((row: any) => row?.otherCmsAssetUid);

      await AssetMapperModel.update((data: any) => {
        data.asset_mapper = assetRows;
      });
    }

    await ContentTypesMapperModelLowdb.update((data: any) => {
      // Simple approach: just replace with new content types
      data.ContentTypesMappers = contentType;
    });

    await ProjectModelLowdb.read();
    const index = ProjectModelLowdb.chain
      .get('projects')
      .findIndex({ id: projectId })
      .value();
    if (index > -1 && contentIds?.length) {
      ProjectModelLowdb.data.projects[index].content_mapper = contentIds;
      ProjectModelLowdb.data.projects[index].extract_path =
        req?.body?.extractPath;

      // Update assetsConfig if provided (for Drupal asset URL configuration)
      if (
        req?.body?.assetsConfig &&
        ProjectModelLowdb.data.projects[index].legacy_cms
      ) {
        (
          ProjectModelLowdb.data.projects[index].legacy_cms as any
        ).assetsConfig = req.body.assetsConfig;
      }

      // Update mySQLDetails if provided (for Drupal database connection)
      if (
        req?.body?.mySQLDetails &&
        ProjectModelLowdb.data.projects[index].legacy_cms
      ) {
        (
          ProjectModelLowdb.data.projects[index].legacy_cms as any
        ).mySQLDetails = req.body.mySQLDetails;
        // Set is_sql flag when MySQL details are provided
        (ProjectModelLowdb.data.projects[index].legacy_cms as any).is_sql =
          true;
      }

      // Store taxonomies if provided
      if (req?.body?.taxonomies && Array.isArray(req.body.taxonomies)) {
        ProjectModelLowdb.data.projects[index].taxonomies = req.body.taxonomies;
      }

      await ProjectModelLowdb.write();
    } else {
      throw new BadRequestError(HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND);
    }

    const pData = ProjectModelLowdb.chain
      .get('projects')
      .find({ id: projectId })
      .value();

    await isDuplicateEntry(projectId);

    return {
      status: HTTP_CODES?.OK,
      data: pData,
    };
  } catch (error: any) {
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR,
    );
  }
};

/**
 * Splits the current iteration's content types into "new" vs "old" relative to the
 * previous iteration, by comparing on `otherCmsUid`.
 * - mode 'new': content types NOT present in the previous iteration (mapped for the first time).
 * - mode 'old': content types already present in the previous iteration (already migrated) AND
 *   that have at least one entry mapping — Step 4 (Map Entry) can only map entries for content
 *   types that actually have entries, so types with an empty entryMapping are excluded.
 * Used on delta migrations (iteration > 1) so Step 3 (Map Content Fields) only re-maps new
 * types and Step 4 (Map Entry) only maps entries of already-migrated types that have entries.
 * @param currentCts - Content types of the current iteration.
 * @param prevCts - Content types of the previous iteration.
 * @param mode - 'new' or 'old'.
 * @returns The filtered subset of `currentCts`.
 */
const filterContentTypesByIteration = (
  currentCts: ContentTypesMapper[],
  prevCts: ContentTypesMapper[],
  mode: 'new' | 'old',
): ContentTypesMapper[] => {
  const prevUids = new Set(
    (prevCts ?? [])
      .map((ct) => ct?.otherCmsUid)
      .filter((uid): uid is string => Boolean(uid)),
  );
  return (currentCts ?? []).filter((ct) => {
    if (mode === 'old') {
      const hasEntries = Array.isArray(ct?.entryMapping) && ct.entryMapping.length > 0;
      return prevUids.has(ct?.otherCmsUid) && hasEntries;
    }
    return !prevUids.has(ct?.otherCmsUid);
  });
};

/**
 * Retrieves the content types based on the provided request parameters.
 * @param req - The request object containing the parameters.
 * @returns An object containing the total count and the array of content types.
 */
const getContentTypes = async (req: Request) => {
  const sourceFn = 'getContentTypes';
  const projectId = req?.params?.projectId;
  const skip: any = req?.params?.skip;
  const limit: any = req?.params?.limit;
  const search: string = req?.params?.searchText?.toLowerCase();
  // Delta migration: 'new' (default) → first-time content types for Step 3 (field mapping);
  // 'old' → already-migrated content types for Step 4 (entry mapping). Only applied when iteration > 1.
  const filter: 'new' | 'old' = req?.query?.filter === 'old' ? 'old' : 'new';

  let result: any = [];
  let totalCount = 0;
  try {
    await ProjectModelLowdb.read();
    const projectDetails = ProjectModelLowdb.chain
      .get('projects')
      .find({ id: projectId })
      .value();

    if (isEmpty(projectDetails)) {
      logger.error(
        getLogMessage(
          sourceFn,
          `${HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`,
        ),
      );
      throw new BadRequestError(HTTP_TEXTS.PROJECT_NOT_FOUND);
    }
    const contentMapperId = projectDetails?.content_mapper;
    const iteration = projectDetails?.iteration || 0;
    const ContentTypesMapperModelLowdb = getContentTypesMapperDb(projectId, iteration);
    const FieldMapperModel = getFieldMapperDb(projectId, iteration);
    await ContentTypesMapperModelLowdb.read();
    await FieldMapperModel.read();

    const content_mapper: any = [];
    logger.info(
      `📦 [getContentTypes] Looking for content mappers with projectId: ${projectId}`,
    );
    logger.info(
      `📦 [getContentTypes] contentMapperId array: ${JSON.stringify(
        contentMapperId,
      )}`,
    );

    contentMapperId.map((data: any) => {
      const contentMapperData = ContentTypesMapperModelLowdb.chain
        .get('ContentTypesMappers')
        .find({ id: data, projectId: projectId })
        .value();
      if (contentMapperData) {
        content_mapper.push(contentMapperData);
      }
    });

    logger.info(
      `📦 [getContentTypes] Found ${content_mapper.length} content types`,
    );

    // Delta migration: from iteration 2 onwards, split content types into new vs old
    // relative to EVERY prior iteration (1..N-1) so Step 3 (field mapping) shows only
    // genuinely-never-seen types and Step 4 (entry mapping) shows every already-migrated
    // type. Comparing only against iteration N-1 misclassified any content type that
    // was migrated in iteration 1 but absent from the iteration-2 source as "new" on
    // iteration 3 — sending already-migrated types back to Map Content Fields and
    // hiding them from Map Entry. Iteration 1 is untouched.
    if (iteration > 1) {
      const seenPrevCts: ContentTypesMapper[] = [];
      const seenPrevUids = new Set<string>();
      for (let i = 1; i < iteration; i++) {
        const priorModel = getContentTypesMapperDb(projectId, i);
        await priorModel.read();
        const cts = priorModel.chain.get('ContentTypesMappers').value() ?? [];
        for (const ct of cts) {
          const uid = ct?.otherCmsUid;
          if (uid && !seenPrevUids.has(uid)) {
            seenPrevUids.add(uid);
            seenPrevCts.push(ct);
          }
        }
      }

      const filtered = filterContentTypesByIteration(content_mapper, seenPrevCts, filter);
      content_mapper.length = 0;
      content_mapper.push(...filtered);

      // For Step 4 (Map Entry), derive each content type's status from the entry mapper so the
      // list icon reflects persisted state on load: 'Updated' (2/green) when the content type has
      // at least one entry marked isUpdate, otherwise 'Mapped' (1/blue). Without this the UI would
      // show every type as blue after a reload until the user opens it.
      if (filter === 'old') {
        const EntryMapperModelLowdb = getEntryMapperDb(projectId, iteration);
        await EntryMapperModelLowdb.read();
        const entryMapperItems = EntryMapperModelLowdb.chain.get('entry_mapper').value() ?? [];
        const updatedContentTypeIds = new Set(
          entryMapperItems
            .filter((entry: any) => entry?.isUpdate)
            .map((entry: any) => entry?.contentTypeId),
        );
        content_mapper.forEach((ct: any) => {
          ct.status = updatedContentTypeIds.has(ct?.id) ? 2 : 1;
        });
      }

      logger.info(
        `📦 [getContentTypes] iteration ${iteration}, filter '${filter}' → ${content_mapper.length} content types`,
      );
    }

    if (!isEmpty(content_mapper)) {
      if (search) {
        const filteredResult = content_mapper
          .filter((item: any) =>
            item?.otherCmsTitle?.toLowerCase().includes(search),
          )
          ?.sort((a: any, b: any) =>
            a.otherCmsTitle.localeCompare(b.otherCmsTitle),
          );
        totalCount = filteredResult.length;
        result = filteredResult.slice(skip, Number(skip) + Number(limit));
      } else {
        totalCount = content_mapper.length;
        result = content_mapper
          ?.sort((a: any, b: any) =>
            a.otherCmsTitle.localeCompare(b.otherCmsTitle),
          )
          ?.slice(skip, Number(skip) + Number(limit));
      }
    }

    return {
      status: HTTP_CODES?.OK,
      count: totalCount,
      contentTypes: result,
    };
  } catch (error: any) {
    // Log error message
    logger.error(
      getLogMessage(
        sourceFn,
        'Error occurred while while getting contentTypes of projects',
        error,
      ),
    );

    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR,
    );
  }
};

/**
 * Retrieves the field mapping for a given content type.
 * @param req - The request object containing the content type ID, skip, limit, and search text.
 * @returns An object containing the count of field mappings and the filtered/sliced field mappings.
 * @throws BadRequestError if the content type is not found.
 */
const getFieldMapping = async (req: Request) => {
  const srcFunc = 'getFieldMapping';
  const contentTypeId = req?.params?.contentTypeId;
  const projectId = req?.params?.projectId;
  const skip: any = req?.params?.skip;
  const limit: any = req?.params?.limit;
  const search: string = req?.params?.searchText?.toLowerCase();

  let result: any[] = [];
  let filteredResult = [];
  let totalCount = 0;

  try {
    const project = ProjectModelLowdb.chain
      .get('projects')
      .find({ id: projectId })
      .value();
    const iteration = project?.iteration || 0;
    const ContentTypesMapperModelLowdb = getContentTypesMapperDb(projectId, iteration);
    const FieldMapperModel = getFieldMapperDb(projectId, iteration);
    await ContentTypesMapperModelLowdb.read();

    const contentType = ContentTypesMapperModelLowdb.chain
      .get('ContentTypesMappers')
      .find({ id: contentTypeId, projectId: projectId })
      .value();

    if (isEmpty(contentType)) {
      logger.error(
        getLogMessage(
          srcFunc,
          `${HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND} Id: ${contentTypeId}`,
        ),
      );
      throw new BadRequestError(HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND);
    }
    await FieldMapperModel.read();
    const fieldData = contentType?.fieldMapping?.map?.((fields: any) => {
      const fieldMapper = FieldMapperModel.chain
        .get('field_mapper')
        .find({
          id: fields,
          projectId: projectId,
          contentTypeId: contentTypeId,
        })
        .value();

      return fieldMapper;
    });

    const fieldMapping: any = fieldData?.map((field: any) => {
      if (field?.advanced?.initial) {
        return { ...field, advanced: field?.advanced };
      }
      return field;
    });

    if (!isEmpty(fieldMapping)) {
      if (search) {
        filteredResult = fieldMapping?.filter?.((item: any) =>
          item?.otherCmsField?.toLowerCase().includes(search),
        );
        totalCount = filteredResult.length;
        result = filteredResult.slice(skip, Number(skip) + Number(limit));
      } else {
        totalCount = fieldMapping.length;
        result = fieldMapping.slice(skip, Number(skip) + Number(limit));
      }
    }

    return {
      status: HTTP_CODES?.OK,
      count: totalCount,
      fieldMapping: result,
    };
  } catch (error: any) {
    // Log error message
    logger.error(
      getLogMessage(
        srcFunc,
        'Error occurred while getting field mapping of projects',
        error,
      ),
    );

    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR,
    );
  }
};

/**
 * Retrieves existing content types for a given project.
 * @param req - The request object containing the project ID and token payload.
 * @returns An object containing the retrieved content types.
 */
const getExistingContentTypes = async (req: Request) => {
  const projectId = req?.params?.projectId;
  const contentTypeUID = req?.params?.contentTypeUid ?? ''; // UID of the selected content type, if any

  const { token_payload } = req?.body;


  await ProjectModelLowdb.read();
  const project = ProjectModelLowdb.chain
    .get('projects')
    .find({ id: projectId })
    .value();

  const baseUrl = `${config.CS_API[
    token_payload?.region as keyof typeof config.CS_API
  ]!}/content_types`;
  let headers: any = {
    api_key: project?.destination_stack_id,
  }
  if(token_payload?.is_sso) {
    const accessToken = await getAccessToken(token_payload?.region, token_payload?.user_id);
    headers.authorization = `Bearer ${accessToken}`;
  } else if (token_payload?.is_sso === false) {
    const authtoken = await getAuthtoken(
      token_payload?.region,
      token_payload?.user_id
    );
    headers.authtoken = authtoken;
  }

  try {
    // Step 1: Fetch the updated list of all content types
    const contentTypes = await fetchAllPaginatedData(
      baseUrl,
      headers,
      100,
      'getExistingContentTypes',
      'content_types',
      token_payload
    );

    const processedContentTypes = contentTypes.map((singleCT: any) => ({
      title: singleCT.title,
      uid: singleCT.uid,
      schema: singleCT.schema,
    }));

    // Step 2: Fetch data for the selected content type (if `contentTypeUID` is provided)
    let selectedContentType = null;

    if (contentTypeUID) {
      const [err, res] = token_payload?.is_sso
        ? await requestWithSsoTokenRefresh(token_payload, {
          method: 'GET',
          url: `${baseUrl}/${contentTypeUID}`,
          headers,
        })
        : await safePromise(
          https({
            method: 'GET',
            url: `${baseUrl}/${contentTypeUID}`,
            headers,
          })
        );

      if (!err) {
        selectedContentType = {
          title: res?.data?.content_type?.title,
          uid: res?.data?.content_type?.uid,
          schema: res?.data?.content_type?.schema,
        };
      }
    }
    return {
      contentTypes: processedContentTypes,
      selectedContentType,
    };
  } catch (error: any) {
    return {
      data: error.message,
      status: error.status || 500,
    };
  }
};

/**
 * Retrieves existing global fields for a given project.
 * @param req - The request object containing the project ID and token payload.
 * @returns An object containing the retrieved content types.
 */
const getExistingGlobalFields = async (req: Request) => {
  const projectId = req?.params?.projectId;
  const globalFieldUID = req?.params?.globalFieldUid ?? ''; // UID of the selected global field, if any

  if (!projectId) {
    return {
      data: 'Project ID is missing in the request',
      status: 400,
    };
  }

  const { token_payload: tokenPayload } = req?.body;

  if (!tokenPayload?.region || !tokenPayload?.user_id) {
    return {
      data: 'Token payload is missing or incomplete',
      status: 400,
    };
  }

  try {
    const authtoken = await getAuthtoken(
      tokenPayload.region,
      tokenPayload.user_id,
    );

    await ProjectModelLowdb.read();
    const project = ProjectModelLowdb.chain
      .get('projects')
      .find({ id: projectId })
      .value();

    if (!project) {
      return {
        data: 'Project not found',
        status: 404,
      };
    }

    const stackId = project.destination_stack_id;

    if (!stackId) {
      return {
        data: 'Destination stack ID is missing in the project',
        status: 400,
      };
    }

    const baseUrl = `${
      config.CS_API[tokenPayload.region as keyof typeof config.CS_API]
    }/global_fields`;
    const headers = {
      api_key: stackId,
      authtoken,
    };

    // Step 1: Fetch the updated list of all global fields

    const globalFields = await fetchAllPaginatedData(
      baseUrl,
      headers,
      100,
      'getExistingGlobalFields',
      'global_fields',
    );

    const processedGlobalFields = globalFields.map((global: any) => ({
      title: global.title,
      uid: global.uid,
      schema: global.schema,
    }));

    // Step 2: Fetch data for the selected global field (if `globalFieldUID` is provided)
    let selectedGlobalField = null;

    if (globalFieldUID) {
      const [err, res] = await safePromise(
        https({
          method: 'GET',
          url: `${baseUrl}/${globalFieldUID}`,
          headers,
        }),
      );

      if (!err) {
        selectedGlobalField = {
          title: res?.data?.global_field?.title,
          uid: res?.data?.global_field?.uid,
          schema: res?.data?.global_field?.schema,
        };
      }
    }

    return { globalFields: processedGlobalFields, selectedGlobalField };
  } catch (error: any) {
    return {
      data: error.message || 'An unknown error occurred',
      status: 500,
    };
  }
};

/**
 * Updates the content type based on the provided request.
 * @param req - The request object containing the necessary parameters and data.
 * @returns An object containing the updated content type.
 * @throws BadRequestError if the request is invalid or the content type cannot be updated.
 * @throws ExceptionFunction if an error occurs while updating the content type.
 */
const updateContentType = async (req: Request) => {
  const srcFun = 'updateContentType';
  const { orgId, projectId, contentTypeId } = req?.params;
  const { contentTypeData, token_payload } = req?.body;
  const fieldMapping = contentTypeData?.fieldMapping;

  // Read project data
  await ProjectModelLowdb.read();
  const projectIndex = (await getProjectUtil(
    projectId,
    {
      id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    srcFun,
    true,
  )) as number;
  const project = ProjectModelLowdb.data?.projects[projectIndex];

  // Check project status
  if (
    [NEW_PROJECT_STATUS[5]].includes(project.status) ||
    project?.current_step < STEPPER_STEPS?.CONTENT_MAPPING
  ) {
    logger.error(
      getLogMessage(
        srcFun,
        HTTP_TEXTS.CANNOT_UPDATE_CONTENT_MAPPING,
        token_payload,
      ),
    );
    return {
      status: 400,
      message: HTTP_TEXTS.CANNOT_UPDATE_CONTENT_MAPPING,
    };
  }

  // Validate contentTypeData
  if (isEmpty(contentTypeData)) {
    logger.error(
      getLogMessage(
        srcFun,
        `${HTTP_TEXTS.INVALID_CONTENT_TYPE} Id: ${contentTypeId}`,
      ),
    );
    return {
      status: 400,
      message: HTTP_TEXTS.INVALID_CONTENT_TYPE,
    };
  }

  try {
    const iteration = project?.iteration || 0;
    const ContentTypesMapperModelLowdb = getContentTypesMapperDb(projectId, iteration);
    const FieldMapperModel = getFieldMapperDb(projectId, iteration);
    await ContentTypesMapperModelLowdb.read();
    const updateIndex = ContentTypesMapperModelLowdb.chain
      .get('ContentTypesMappers')
      .findIndex({ id: contentTypeId, projectId: projectId })
      .value();

    if (fieldMapping) {
      for (const field of fieldMapping) {
        if (
          !field.contentstackFieldType ||
          field.contentstackFieldType === '' ||
          field.contentstackFieldType === 'No matches found' ||
          field.contentstackFieldUid === ''
        ) {
          logger.error(
            getLogMessage(
              srcFun,
              `${VALIDATION_ERRORS.STRING_REQUIRED.replace(
                '$',
                'contentstackFieldType or contentstackFieldUid',
              )}`,
            ),
          );
          await ContentTypesMapperModelLowdb.update((data: any) => {
            data.ContentTypesMappers[updateIndex].status =
              CONTENT_TYPE_STATUS[3];
          });

          await ContentTypesMapperModelLowdb.read();
          const updatedContentType = ContentTypesMapperModelLowdb.chain
            .get('ContentTypesMappers')
            .find({ id: contentTypeId, projectId: projectId })
            .value();
          return {
            data: updatedContentType,
            status: 400,
            message: `${VALIDATION_ERRORS.STRING_REQUIRED.replace(
              '$',
              'contentstackFieldType or contentstackFieldUid',
            )}`,
          };
        }
      }
    }

    // const updateIndex = ContentTypesMapperModelLowdb.chain
    //   .get("ContentTypesMappers")
    //   .findIndex({ id: contentTypeId, projectId: projectId })
    //   .value();
    ContentTypesMapperModelLowdb.update((data: any) => {
      if (updateIndex >= 0) {
        data.ContentTypesMappers[updateIndex].otherCmsTitle =
          contentTypeData?.otherCmsTitle;
        data.ContentTypesMappers[updateIndex].otherCmsUid =
          contentTypeData?.otherCmsUid;
        data.ContentTypesMappers[updateIndex].isUpdated =
          contentTypeData?.isUpdated;
        data.ContentTypesMappers[updateIndex].updateAt =
          contentTypeData?.updateAt;
        data.ContentTypesMappers[updateIndex].contentstackTitle =
          contentTypeData?.contentstackTitle;
        data.ContentTypesMappers[updateIndex].contentstackUid =
          contentTypeData?.contentstackUid;
      }
    });

    if (updateIndex < 0) {
      logger.error(
        getLogMessage(
          srcFun,
          `${HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND} Id: ${contentTypeId}`,
        ),
      );
      return {
        status: 404,
        message: HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND,
      };
    }

    if (Array?.isArray?.(fieldMapping) && !isEmpty(fieldMapping)) {
      await FieldMapperModel.read();
      fieldMapping.forEach((field: any) => {
        const fieldIndex = FieldMapperModel.data?.field_mapper?.findIndex(
          (f: any) =>
            f?.id === field?.id && f?.contentTypeId === field?.contentTypeId,
        );
        if (fieldIndex > -1 && field?.contentstackFieldType !== '') {
          FieldMapperModel.update((data: any) => {
            const existingField = data?.field_mapper?.[fieldIndex];
            const preservedInitial = existingField?.advanced?.initial;

            data.field_mapper[fieldIndex] = field;

            if (preservedInitial && field?.advanced) {
              data.field_mapper[fieldIndex].advanced.initial = preservedInitial;
            }
          });
        }
      });
    }
    await ContentTypesMapperModelLowdb.update((data: any) => {
      data.ContentTypesMappers[updateIndex].status = CONTENT_TYPE_STATUS[2];
    });

    // Fetch and return updated content type
    await ContentTypesMapperModelLowdb.read();
    const updatedContentType = ContentTypesMapperModelLowdb.chain
      .get('ContentTypesMappers')
      .find({ id: contentTypeId, projectId: projectId })
      .value();

    return {
      status: 200,
      data: { updatedContentType },
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFun,
        `Error while updating ContentType Id: ${contentTypeId}`,
        error,
      ),
    );
    return {
      status: error?.status || 500,
      message: error?.message || HTTP_TEXTS.INTERNAL_ERROR,
    };
  }
};

/**
 * Resets the field mapping and content mapping for a specific content type in a project.
 *
 * @param req - The request object containing the parameters and body.
 * @returns An object with a message indicating the success of the reset operation.
 * @throws {BadRequestError} If the project status or current step is not valid for resetting the content mapping.
 * @throws {BadRequestError} If the content type is not found or invalid.
 * @throws {ExceptionFunction} If an error occurs while resetting the field mapping.
 */
const resetToInitialMapping = async (req: Request) => {
  const srcFunc = 'resetToInitialMapping';
  const { orgId, projectId, contentTypeId } = req.params;
  const { token_payload } = req?.body;

  await ProjectModelLowdb.read();
  const projectIndex = (await getProjectUtil(
    projectId,
    {
      id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    srcFunc,
    true,
  )) as number;

  const project = ProjectModelLowdb.data?.projects[projectIndex];

  if (
    [
      NEW_PROJECT_STATUS[0],
      NEW_PROJECT_STATUS[5],
      //NEW_PROJECT_STATUS[4],
    ].includes(project?.status) ||
    project?.current_step < STEPPER_STEPS?.CONTENT_MAPPING
  ) {
    logger.error(
      getLogMessage(
        srcFunc,
        HTTP_TEXTS.CANNOT_RESET_CONTENT_MAPPING,
        token_payload,
      ),
    );
    throw new BadRequestError(HTTP_TEXTS.CANNOT_RESET_CONTENT_MAPPING);
  }

  const iteration = project?.iteration || 0;
  const ContentTypesMapperModelLowdb = getContentTypesMapperDb(projectId, iteration);
  const FieldMapperModel = getFieldMapperDb(projectId, iteration);
  await ContentTypesMapperModelLowdb.read();
  const contentTypeData = ContentTypesMapperModelLowdb.chain
    .get('ContentTypesMappers')
    .find({ id: contentTypeId, projectId: projectId })
    .value();

  await FieldMapperModel.read();
  const fieldMappingData = contentTypeData?.fieldMapping?.map((itemId: any) => {
    const fieldData = FieldMapperModel.chain
      .get('field_mapper')
      .find({ id: itemId, projectId: projectId, contentTypeId: contentTypeId })
      .value();
    return fieldData;
  });

  if (isEmpty(contentTypeData)) {
    logger.error(
      getLogMessage(
        srcFunc,
        `${HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND} Id: ${contentTypeId}`,
      ),
    );
    throw new BadRequestError(HTTP_TEXTS.INVALID_CONTENT_TYPE);
  }

  try {
    if (!isEmpty(fieldMappingData)) {
      //await FieldMapperModel.read();
      (fieldMappingData || []).forEach((field: any) => {
        const fieldIndex = FieldMapperModel.data?.field_mapper?.findIndex(
          (f: any) =>
            f?.id === field?.id &&
            f?.projectId === projectId &&
            f?.contentTypeId === contentTypeId,
        );
        if (fieldIndex > -1) {
          FieldMapperModel.update((data: any) => {
            data.field_mapper[fieldIndex] = {
              ...field,
              contentstackField: field?.otherCmsField,
              contentstackFieldUid: field?.backupFieldUid,
              contentstackFieldType: field?.backupFieldType,
              advanced: {
                ...field?.advanced?.initial,
                initial: field?.advanced?.initial,
              },
              ...(field?.referenceTo && {
                referenceTo: field?.initialRefrenceTo,
              }),
              isDeleted: false,
            };
          });
        }
      });
    }

    const contentIndex = ContentTypesMapperModelLowdb.chain
      .get('ContentTypesMappers')
      .findIndex({ id: contentTypeId, projectId: projectId })
      .value();

    await ContentTypesMapperModelLowdb.update((data: any) => {
      data.ContentTypesMappers[contentIndex].status = CONTENT_TYPE_STATUS[1];
    });
    return {
      status: HTTP_CODES?.OK,
      message: HTTP_TEXTS.RESET_CONTENT_MAPPING,
      data: contentTypeData,
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while resetting the field mapping for the ContentType ID: ${contentTypeId}`,
        {},
        error,
      ),
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.status || error.statusCode || HTTP_CODES.SERVER_ERROR,
    );
  }
};
/**
 * Resets all the content types mapping for a specific project.
 *
 * @param projectId - The ID of the project.
 * @returns The project details after resetting the content types mapping.
 * @throws {BadRequestError} If the content mapper or project is not found.
 * @throws {ExceptionFunction} If an error occurs while resetting the content types mapping.
 */
const resetAllContentTypesMapping = async (projectId: string) => {
  const srcFunc = 'resetAllContentTypesMapping';

  await ProjectModelLowdb.read();
  const projectDetails = ProjectModelLowdb.chain
    .get('projects')
    .find({ id: projectId })
    .value();

  const contentMapperId = projectDetails?.content_mapper;
  if (isEmpty(contentMapperId)) {
    logger.error(
      getLogMessage(
        srcFunc,
        `${HTTP_TEXTS.CONTENTMAPPER_NOT_FOUND} projectId: ${projectId}`,
      ),
    );
    throw new BadRequestError(HTTP_TEXTS.CONTENTMAPPER_NOT_FOUND);
  }
  if (isEmpty(projectDetails)) {
    logger.error(
      getLogMessage(
        srcFunc,
        `${HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`,
      ),
    );
    throw new BadRequestError(HTTP_TEXTS.PROJECT_NOT_FOUND);
  }
  const iteration = projectDetails?.iteration || 0;
  const ContentTypesMapperModelLowdb = getContentTypesMapperDb(projectId, iteration);
  const FieldMapperModel = getFieldMapperDb(projectId, iteration);
  await ContentTypesMapperModelLowdb.read();
  const cData = contentMapperId.map((cId: any) => {
    const contentTypeData = ContentTypesMapperModelLowdb.chain
      .get('ContentTypesMappers')
      .find({ id: cId, projectId: projectId })
      .value();
    return contentTypeData;
  });

  try {
    const contentTypes = cData;
    for (const contentType of contentTypes) {
      if (contentType && !isEmpty(contentType.fieldMapping)) {
        for (const field of contentType.fieldMapping) {
          await FieldMapperModel.read();
          const fieldData = FieldMapperModel.chain
            .get('field_mapper')
            .find({ id: field, projectId: projectId })
            .value();
          const fieldIndex = FieldMapperModel.chain
            .get('field_mapper')
            .findIndex({ id: field, projectId: projectId })
            .value();

          if (fieldIndex > -1) {
            await FieldMapperModel.update((fData: any) => {
              fData.field_mapper[fieldIndex] = {
                ...fieldData,
                contentstackField: '',
                contentstackFieldUid: '',
                contentstackFieldType: fieldData.backupFieldType,
              };
            });
          }
        }
      }
      await ContentTypesMapperModelLowdb.read();
      if (!isEmpty(contentType?.id)) {
        const cIndex = ContentTypesMapperModelLowdb.chain
          .get('ContentTypesMappers')
          .findIndex({ id: contentType?.id, projectId: projectId })
          .value();
        if (cIndex > -1) {
          await ContentTypesMapperModelLowdb.update((data: any) => {
            data.ContentTypesMappers[cIndex].contentstackTitle = '';
            data.ContentTypesMappers[cIndex].contentstackUid = '';
          });
        }
      }
    }

    return projectDetails;
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while reseting all the content types mapping for the Project [Id: ${projectId}]`,
        {},
        error,
      ),
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR,
    );
  }
};
/**
 * Removes the content mapping for a project.
 * @param projectId - The ID of the project.
 * @returns The project details after removing the content mapping.
 * @throws {BadRequestError} If the project is not found.
 * @throws {ExceptionFunction} If an error occurs while removing the content mapping.
 */
const removeMapping = async (projectId: string) => {
  const srcFunc = 'removeMapping';
  await ProjectModelLowdb.read();
  const projectDetails = ProjectModelLowdb.chain
    .get('projects')
    .find({ id: projectId })
    .value();

  if (isEmpty(projectDetails)) {
    logger.error(
      getLogMessage(
        srcFunc,
        `${HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`,
      ),
    );
    throw new BadRequestError(HTTP_TEXTS.PROJECT_NOT_FOUND);
  }
  const iteration = projectDetails?.iteration || 0;
  const ContentTypesMapperModelLowdb = getContentTypesMapperDb(projectId, iteration);
  const FieldMapperModel = getFieldMapperDb(projectId, iteration);
  await ContentTypesMapperModelLowdb.read();
  await FieldMapperModel.read();
  const cData = projectDetails?.content_mapper.map((cId: any) => {
    const contentTypeData = ContentTypesMapperModelLowdb.chain
      .get('ContentTypesMappers')
      .find({ id: cId, projectId: projectId })
      .value();
    return contentTypeData;
  });

  try {
    const contentTypes = cData;

    for (const contentType of contentTypes) {
      if (contentType && !isEmpty(contentType.fieldMapping)) {
        for (const field of contentType.fieldMapping) {
          await FieldMapperModel.read();
          const fieldIndex = FieldMapperModel.chain
            .get('field_mapper')
            .findIndex({ id: field, projectId: projectId })
            .value();
          if (fieldIndex > -1) {
            await FieldMapperModel.update((fData: any) => {
              delete fData.field_mapper[fieldIndex];
            });
          }
        }
      }
      await ContentTypesMapperModelLowdb.read();
      if (!isEmpty(contentType?.id)) {
        const cIndex = ContentTypesMapperModelLowdb.chain
          .get('ContentTypesMappers')
          .findIndex({ id: contentType?.id, projectId: projectId })
          .value();
        if (cIndex > -1) {
          await ContentTypesMapperModelLowdb.update((data: any) => {
            delete data.ContentTypesMappers[cIndex];
          });
        }
      }
    }

    await ProjectModelLowdb.read();
    const projectIndex = ProjectModelLowdb.chain
      .get('projects')
      .findIndex({ id: projectId })
      .value();

    if (projectIndex > -1) {
      ProjectModelLowdb.update((data: any) => {
        data.projects[projectIndex].content_mapper = [];
      });
    }
    return projectDetails;
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while removing the content mapping for the Project [Id: ${projectId}]`,
        {},
        error,
      ),
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR,
    );
  }
};
/**
 * Retrieves a single content type from the specified project.
 * @param req - The request object containing the project ID, content type UID, and token payload.
 * @returns An object containing the title, UID, and schema of the content type, or an error object if an error occurs.
 */
const getSingleContentTypes = async (req: Request) => {
  const projectId = req?.params?.projectId;
  const contentTypeUID = req?.params?.contentTypeUid;
  const { token_payload } = req.body;

  const authtoken = await getAuthtoken(
    token_payload?.region,
    token_payload?.user_id,
  );
  await ProjectModelLowdb.read();
  const project = ProjectModelLowdb.chain
    .get('projects')
    .find({ id: projectId })
    .value();
  const stackId = project?.destination_stack_id;

  const [err, res] = await safePromise(
    https({
      method: 'GET',
      url: `${config.CS_API[
        token_payload?.region as keyof typeof config.CS_API
      ]!}/content_types/${contentTypeUID}`,
      headers: {
        api_key: stackId,
        authtoken: authtoken,
      },
    }),
  );

  if (err)
    return {
      data: err.response.data,
      status: err.response.status,
    };

  return {
    title: res?.data?.content_type?.title,
    uid: res?.data?.content_type?.uid,
    schema: res?.data?.content_type?.schema,
  };
};

/**
 * Retrieves a single global field from the specified project.
 * @param req - The request object containing the project ID, content type UID, and token payload.
 * @returns An object containing the title, UID, and schema of the content type, or an error object if an error occurs.
 */
const getSingleGlobalField = async (req: Request) => {
  const projectId = req?.params?.projectId;
  const globalFieldUID = req?.params?.globalFieldUid;
  const { token_payload } = req.body;

  const authtoken = await getAuthtoken(
    token_payload?.region,
    token_payload?.user_id,
  );
  await ProjectModelLowdb.read();
  const project = ProjectModelLowdb.chain
    .get('projects')
    .find({ id: projectId })
    .value();
  const stackId = project?.destination_stack_id;

  const [err, res] = await safePromise(
    https({
      method: 'GET',
      url: `${config.CS_API[
        token_payload?.region as keyof typeof config.CS_API
      ]!}/global_fields/${globalFieldUID}`,
      headers: {
        api_key: stackId,
        authtoken: authtoken,
      },
    }),
  );

  if (err)
    return {
      data: err.response.data,
      status: err.response.status,
    };

  return {
    title: res?.data?.global_field?.title,
    uid: res?.data?.global_field?.uid,
    schema: res?.data?.global_field?.schema,
  };
};
/**
 * Removes the content mapping for a project.
 * @param req - The request object containing the project ID.
 * @returns The project details after removing the content mapping.
 * @throws {BadRequestError} If the project is not found.
 * @throws {ExceptionFunction} If an error occurs while removing the content mapping.
 */
const removeContentMapper = async (req: Request) => {
  const projectId = req?.params?.projectId;
  const srcFunc = 'removeMapping';
  await ProjectModelLowdb.read();
  const projectDetails = ProjectModelLowdb.chain
    .get('projects')
    .find({ id: projectId })
    .value();

  if (isEmpty(projectDetails)) {
    logger.error(
      getLogMessage(
        srcFunc,
        `${HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`,
      ),
    );
    throw new BadRequestError(HTTP_TEXTS.PROJECT_NOT_FOUND);
  }
  const iteration = projectDetails?.iteration || 0;
  const ContentTypesMapperModelLowdb = getContentTypesMapperDb(projectId, iteration);
  const FieldMapperModel = getFieldMapperDb(projectId, iteration);
  await ContentTypesMapperModelLowdb.read();
  await FieldMapperModel.read();
  const cData: ContentTypesMapper[] = projectDetails?.content_mapper.map(
    (cId: string) => {
      const contentTypeData: ContentTypesMapper =
        ContentTypesMapperModelLowdb.chain
          .get('ContentTypesMappers')
          .find({ id: cId, projectId: projectId })
          .value();
      return contentTypeData;
    },
  );

  try {
    const contentTypes: ContentTypesMapper[] = cData;
    //TODO: remove fieldMapping ids in ContentTypesMapperModel for each content types

    for (const contentType of contentTypes) {
      if (contentType && !isEmpty(contentType.fieldMapping)) {
        for (const field of contentType.fieldMapping) {
          await FieldMapperModel.read();
          const fieldIndex = FieldMapperModel.chain
            .get('field_mapper')
            .findIndex({ id: field, projectId: projectId })
            .value();
          if (fieldIndex > -1) {
            await FieldMapperModel.update((fData: any) => {
              delete fData.field_mapper[fieldIndex];
            });
          }
        }
      }
      await ContentTypesMapperModelLowdb.read();
      if (!isEmpty(contentType?.id)) {
        const cIndex = ContentTypesMapperModelLowdb.chain
          .get('ContentTypesMappers')
          .findIndex({ id: contentType?.id, projectId: projectId })
          .value();
        if (cIndex > -1) {
          await ContentTypesMapperModelLowdb.update((data: any) => {
            delete data.ContentTypesMappers[cIndex];
          });
        }
      }
    }

    await ProjectModelLowdb.read();
    const projectIndex = ProjectModelLowdb.chain
      .get('projects')
      .findIndex({ id: projectId })
      .value();

    if (projectIndex > -1) {
      ProjectModelLowdb.update((data: any) => {
        data.projects[projectIndex].content_mapper = [];
      });
    }
    return projectDetails;
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while removing the content mapping for the Project [Id: ${projectId}]`,
        {},
        error,
      ),
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR,
    );
  }
};

/**
 * Updates the content mapper details for a project.
 *
 * @param req - The request object containing the parameters and body.
 * @returns An object with the status and data of the update operation.
 * @throws BadRequestError if the project status is invalid.
 * @throws ExceptionFunction if an error occurs during the update.
 */
const updateContentMapper = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const { token_payload, content_mapper } = req.body;
  const srcFunc = 'updateContentMapper';

  await ProjectModelLowdb.read();
  const projectIndex = (await getProjectUtil(
    projectId,
    {
      id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    srcFunc,
    true,
  )) as number;

  try {
    await ProjectModelLowdb.update((data: any) => {
      data.projects[projectIndex].mapperKeys = content_mapper;
      data.projects[projectIndex].updated_at = new Date().toISOString();
    });

    logger.info(
      getLogMessage(
        srcFunc,
        `Content mapping for project [Id : ${projectId}] has been successfully updated.`,
        token_payload,
      ),
    );
    return {
      status: HTTP_CODES.OK,
      data: {
        message: HTTP_TEXTS.CONTENT_MAPPER_UPDATED,
      },
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while updating content mapping for project [Id : ${projectId}].`,
        token_payload,
        error,
      ),
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR,
    );
  }
};

const getExistingTaxonomies = async (req: Request) => {
  const projectId = req?.params?.projectId;
  const { token_payload } = req.body || {};

  try {
    // Get project details
    await ProjectModelLowdb.read();
    const project = ProjectModelLowdb.chain
      .get('projects')
      .find({ id: projectId })
      .value();

    if (!project) {
      return {
        sourceTaxonomies: [],
        destinationTaxonomies: [],
        data: 'Project not found',
        status: 404,
      };
    }

    const stackId = project?.destination_stack_id;

    // Step 1: Get source taxonomies from project database (sent by upload-api)
    let sourceTaxonomies: any[] = [];

    if (project?.taxonomies && Array.isArray(project?.taxonomies)) {
      // Taxonomies stored in project database (sent from upload-api during validation)
      sourceTaxonomies = project?.taxonomies?.map((taxonomy: any) => ({
        uid: taxonomy.uid,
        name: taxonomy.name || taxonomy.uid,
        description: taxonomy.description || '',
        source: 'source_cms',
      }));
      logger.info(
        `✓ Found ${sourceTaxonomies.length} source taxonomies in project database`,
      );
    } else {
      // Fallback: Try reading from migration-data files
      logger.warn(
        'No taxonomies found in project database, checking fallback paths...',
      );

      // Path 1: Check api/migration-data (processed taxonomies)
      // Validate stackId exists before using it
      if (stackId) {
        // Sanitize stackId to prevent path traversal
        const sanitizedStackId = path.basename(stackId);

        const apiMigrationDataPath = path.join(
          MIGRATION_DATA_CONFIG.DATA,
          sanitizedStackId,
          MIGRATION_DATA_CONFIG.TAXONOMIES_DIR_NAME,
          MIGRATION_DATA_CONFIG.TAXONOMIES_FILE_NAME,
        );

        // Resolve to absolute path and validate it's within allowed directory
        const baseDirectory = path.resolve(MIGRATION_DATA_CONFIG.DATA);
        const resolvedPath = path.resolve(apiMigrationDataPath);

        // Ensure the resolved path is within the base directory using path.relative()
        // This is safer than startsWith() which can be bypassed on Windows (e.g., C:\data_evil vs C:\data)
        const relativePath = path.relative(baseDirectory, resolvedPath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
          logger.error(
            `Path traversal attempt detected: ${resolvedPath} is outside ${baseDirectory}`,
          );
          throw new BadRequestError('Invalid file path');
        }

        try {
          // Use lstat to check file exists WITHOUT following symlinks (prevents TOCTOU attacks)
          const stats = await fs.promises.lstat(resolvedPath).catch(() => null);
          if (stats && stats.isFile() && !stats.isSymbolicLink()) {
            // Re-validate the real path after confirming it's not a symlink using path.relative()
            const realPath = await fs.promises.realpath(resolvedPath);
            const realRelativePath = path.relative(baseDirectory, realPath);
            if (
              realRelativePath.startsWith('..') ||
              path.isAbsolute(realRelativePath)
            ) {
              logger.error(
                `Symlink escape attempt detected: ${realPath} is outside ${baseDirectory}`,
              );
              throw new BadRequestError('Invalid file path');
            }
            const taxonomiesData = await fs.promises.readFile(realPath, 'utf8');
            const taxonomiesObject = JSON.parse(taxonomiesData);

            // Convert object to array with proper structure
            const apiTaxonomies = Object.entries(taxonomiesObject).map(
              ([uid, data]: [string, any]) => ({
                uid: data.uid || uid,
                name: data.name || uid,
                description: data.description || '',
                source: 'source_cms',
              }),
            );
            sourceTaxonomies.push(...apiTaxonomies);
          }
        } catch (fileError: any) {
          logger.error(
            `Error reading migration-data taxonomies: ${fileError.message}`,
          );
        }
      } else {
        logger.warn(
          'stackId is null or undefined, skipping api/migration-data path. Will try upload-api fallback.',
        );
      }

      // Path 2: Fallback to upload-api drupalMigrationData (if api/migration-data not found)
      if (sourceTaxonomies?.length === 0) {
        try {
          // Try to find upload-api directory relative to api directory
          const uploadApiPath = path.join(
            process.cwd(),
            '..',
            'upload-api',
            'drupalMigrationData',
            'taxonomySchema',
            'taxonomySchema.json',
          );
          const uploadApiResolved = path.resolve(uploadApiPath);

          // Basic safety check - ensure it's within expected directory structure
          if (
            uploadApiResolved.includes('upload-api') &&
            uploadApiResolved.includes('drupalMigrationData')
          ) {
            const stats = await fs.promises
              .lstat(uploadApiResolved)
              .catch(() => null);
            if (stats && stats.isFile() && !stats.isSymbolicLink()) {
              const taxonomyData = await fs.promises.readFile(
                uploadApiResolved,
                'utf8',
              );
              const taxonomiesArray = JSON.parse(taxonomyData);

              // Convert array to proper structure
              const uploadApiTaxonomies = (
                Array.isArray(taxonomiesArray)
                  ? taxonomiesArray
                  : Object.values(taxonomiesArray)
              ).map((taxonomy: any) => ({
                uid: taxonomy.uid || taxonomy.vid || '',
                name: taxonomy.name || taxonomy.uid || taxonomy.vid || '',
                description: taxonomy.description || '',
                source: 'source_cms',
              }));

              sourceTaxonomies.push(...uploadApiTaxonomies);
              logger.info(
                `✓ Found ${uploadApiTaxonomies.length} taxonomies from upload-api drupalMigrationData`,
              );
            }
          }
        } catch (uploadApiError: any) {
          logger.warn(
            `Could not read taxonomies from upload-api: ${uploadApiError.message}`,
          );
        }
      }

      // Path 3: Contentful export validation (upload-api contentfulMigrationData)
      if (sourceTaxonomies?.length === 0) {
        try {
          const contentfulTaxonomyPath = path.join(
            process.cwd(),
            '..',
            'upload-api',
            'contentfulMigrationData',
            'taxonomySchema',
            'taxonomySchema.json',
          );
          const resolvedCf = path.resolve(contentfulTaxonomyPath);
          if (
            resolvedCf.includes('upload-api') &&
            resolvedCf.includes('contentfulMigrationData')
          ) {
            const stats = await fs.promises
              .lstat(resolvedCf)
              .catch(() => null);
            if (stats && stats.isFile() && !stats.isSymbolicLink()) {
              const taxonomyData = await fs.promises.readFile(
                resolvedCf,
                'utf8',
              );
              const taxonomiesArray = JSON.parse(taxonomyData);
              const cfTaxonomies = (
                Array.isArray(taxonomiesArray)
                  ? taxonomiesArray
                  : Object.values(taxonomiesArray)
              ).map((taxonomy: any) => ({
                uid: taxonomy?.uid || '',
                name: taxonomy?.name || taxonomy?.uid || '',
                description: taxonomy?.description || '',
                source: 'source_cms',
              }));
              sourceTaxonomies.push(...cfTaxonomies);
              logger.info(
                `Found ${cfTaxonomies?.length} taxonomies from upload-api contentfulMigrationData`,
              );
            }
          }
        } catch (cfTaxError: any) {
          logger.warn(
            `Could not read Contentful taxonomies from upload-api: ${cfTaxError.message}`,
          );
        }
      }
    }

    // Step 2: Get destination taxonomies from Contentstack (if stack exists and token_payload is available)
    let destinationTaxonomies: any[] = [];

    if (token_payload?.region && token_payload?.user_id && stackId) {
      try {
        const authtoken = await getAuthtoken(
          token_payload.region,
          token_payload.user_id,
        );

        const baseUrl = `${config.CS_API[
          token_payload?.region as keyof typeof config.CS_API
        ]!}/taxonomies`;

        const headers = {
          api_key: stackId,
          authtoken,
        };

        // Fetch taxonomies from Contentstack
        const taxonomies = await fetchAllPaginatedData(
          baseUrl,
          headers,
          100,
          'getExistingTaxonomies',
          'taxonomies',
        );

        destinationTaxonomies = taxonomies.map((taxonomy: any) => ({
          uid: taxonomy.uid,
          name: taxonomy.name,
          description: taxonomy.description || '',
          source: 'destination_stack',
        }));
      } catch (apiError: any) {
        logger.error(
          `Error fetching destination taxonomies: ${apiError.message}`,
        );
      }
    }

    const response = {
      sourceTaxonomies,
      destinationTaxonomies,
      status: 200, // GET requests should return 200 OK, not 201 Created
    };

    return response;
  } catch (error: any) {
    logger.error(`Error in getExistingTaxonomies: ${error.message}`);
    return {
      sourceTaxonomies: [],
      destinationTaxonomies: [],
      data: error.message,
      status: error?.statusCode || error?.status || 500, // Check statusCode first (custom errors use this)
    };
  }
};
const getExistingExtensions = async ({existingStackId, token_payload}: any) => {
  try {
    const url = `${config?.CS_API[
      token_payload?.region as keyof typeof config.CS_API
    ]!}/extensions`;

    const headers: Record<string, string> = { api_key: existingStackId };
    if (token_payload?.is_sso) {
      const accessToken = await getAccessToken(
        token_payload?.region,
        token_payload?.user_id,
      );
      headers.authorization = `Bearer ${accessToken}`;
    } else {
      headers.authtoken = await getAuthtoken(
        token_payload?.region,
        token_payload?.user_id,
      );
    }

    const requestConfig = {
      method: 'GET' as const,
      url,
      headers,
    };

    const [err, res] = token_payload?.is_sso
      ? await requestWithSsoTokenRefresh(token_payload, requestConfig)
      : await safePromise(https(requestConfig));

    if (err) {
      const e = err as {
        message?: string;
        response?: { status?: number; data?: unknown };
      };
      const detail =
        e.response?.data != null
          ? typeof e.response.data === 'string'
            ? e.response.data
            : JSON.stringify(e.response.data)
          : e.message;
      const httpErr = new Error(`Error in getExistingExtensions: ${detail}`);
      if (e.response?.status != null) {
        Object.assign(httpErr, { statusCode: e.response.status });
      }
      throw httpErr;
    }

    const extensions = res?.data?.extensions;
    if (!Array.isArray(extensions)) {
      throw new Error(
        'Error in getExistingExtensions: extensions is not an array',
      );
    }

    return extensions.filter((ext: { type?: string }) => ext?.type === 'field');

  } catch (error: any) {
    logger.error(`Error in getExistingExtensions: ${error.message}`, error);
    return {
      data: error?.message,
      status: error?.statusCode || error?.status || 500,
    };

    
  }

}

const updateEntryStatus = async (req: Request) => {
  const { projectId } = req?.params;
  const { ids, locale } = req?.body;
  const validatedUids: string[] = Array.isArray(ids) ? ids : [];
  const srcFunc = "updateEntryMapping";
  if (isEmpty(validatedUids)) {
    logger.error(
      getLogMessage(
        srcFunc,
        "Invalid ids"
      )
    );
    return {
      status: HTTP_CODES?.BAD_REQUEST,
      data: {
        message: "Invalid ids",
      },
    };
  }
  try {
    await ProjectModelLowdb.read();
    const projectData = ProjectModelLowdb.chain
      .get("projects")
      .find({ id: projectId })
      .value();
    const iteration = projectData?.iteration || 1;
    // Rows in entry_mapper are per-(entry × source-locale); each id is unique per row.
    // Also scope the toggle by source-locale as a safety net so a same-id collision
    // (if it ever happens) can't flip a sibling locale's row and clobber the user's
    // selection state on the other locale. Only enforced when the row actually carries
    // a language — legacy rows created before language-tagging existed have none, and
    // requiring a match against them would make them permanently untoggleable.
    const sourceLocale = locale
      ? getSourceLocaleForDestination(projectData ?? {}, locale)
      : null;

    const toggleInModel = async (iter: number): Promise<EntryMapper[]> => {
      const model = getEntryMapperDb(projectId, iter);
      await model.read();
      const matched: EntryMapper[] = [];
      await model.update((data: any) => {
        data?.entry_mapper?.forEach((entry: any) => {
          if (!validatedUids.includes(entry?.id)) return;
          if (sourceLocale && entry?.language && entry.language !== sourceLocale) return;
          entry.isUpdate = !entry.isUpdate;
          matched.push(entry);
        });
      });
      return matched;
    };

    let foundEntry = await toggleInModel(iteration);

    // Fallback: mirrors getEntryMapping's read-side fallback (contentMapper.service.ts
    // ~2119-2131) — right after a restart, before iteration N's entry-mapper rows exist,
    // Map Entry renders rows sourced from iteration N-1. Without this, saving those rows
    // 404s here even though the user is looking at exactly what the read path showed them.
    if (!foundEntry.length && iteration > 1) {
      foundEntry = await toggleInModel(iteration - 1);
    }

    if (foundEntry.length) {
      return {
        status: HTTP_CODES?.OK,
        data: foundEntry
      };
    }

    return {
      status: HTTP_CODES?.NOT_FOUND,
      data: {
        message: "Entry not found",
      },
    };

  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        "Error occurred while updating entry mapping",
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR,
    );
  }


}

const getEntryMapping = async (req: Request) => {

  const srcFunc = "getEntryMapping";
  const contentTypeId = req?.params?.contentTypeId;
  const projectId = req?.params?.projectId;
  const skip: any = req?.params?.skip;
  const limit: any = req?.params?.limit;
  const search: string = req?.params?.searchText?.toLowerCase();
  const locale: string | undefined =
    (req?.query?.locale as string) || (req?.params as any)?.locale;

  let result: any[] = [];
  let filteredResult = [];
  let totalCount = 0;

  try {
    // Get project iteration
    await ProjectModelLowdb.read();
    const projectData = ProjectModelLowdb.chain
      .get("projects")
      .find({ id: projectId })
      .value();
    const iteration = projectData?.iteration || 1;

    const ContentTypesMapperModelLowdb = getContentTypesMapperDb(projectId, iteration);
    await ContentTypesMapperModelLowdb.read();

    const contentType = ContentTypesMapperModelLowdb.chain
      .get("ContentTypesMappers")
      .find({ id: contentTypeId, projectId: projectId })
      .value();

    if (isEmpty(contentType)) {
      logger.error(
        getLogMessage(
          srcFunc,
          `${HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND} Id: ${contentTypeId}`
        )
      );
      throw new BadRequestError(HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND);
    }
    const EntryMapperModel = getEntryMapperDb(projectId, iteration);
    await EntryMapperModel.read();
    // Convert the destination locale param (e.g. "en-in") to its source locale code
    // (e.g. "en-IN") so we can filter the per-source-locale entry_mapper rows.
    const sourceLocale = locale
      ? getSourceLocaleForDestination(projectData ?? {}, locale)
      : null;
    let entryMapping = contentType?.entryMapping?.map?.((mapperUId: any) => {
      const entryMapper = EntryMapperModel.chain
        .get("entry_mapper")
        .find({ id: mapperUId, projectId: projectId, contentTypeId: contentTypeId })
        .value();

      return entryMapper;
    });

    // Fallback: If no entry mappings found in current iteration and we have previous iteration
    if ((!entryMapping || entryMapping?.length === 0 || entryMapping?.every((e: any) => !e)) && iteration > 1) {
      const PrevEntryMapperModel = getEntryMapperDb(projectId, iteration - 1);
      await PrevEntryMapperModel.read();
      entryMapping = contentType?.entryMapping?.map?.((mapperUId: any) => {
        const entryMapper = PrevEntryMapperModel.chain
          .get("entry_mapper")
          .find({ id: mapperUId, projectId: projectId, contentTypeId: contentTypeId })
          .value();

        return entryMapper;
      });
    }

    const enrichedMapping = await enrichEntriesWithUidMapper(
      projectId,
      iteration,
      entryMapping ?? [],
    );

    // entry_mapper rows are already per-source-locale (one row per language variant).
    // Filter to just the rows whose `language` matches the selected destination locale's
    // source code. Falls open when no locale is provided so legacy callers still work.
    const localeFiltered = sourceLocale
      ? (enrichedMapping ?? []).filter(
          (row: any) => row && (row?.language ?? '') === sourceLocale,
        )
      : enrichedMapping;

    if (!isEmpty(localeFiltered)) {
      if (search) {
        filteredResult = localeFiltered?.filter?.((item: any) =>
          item?.entryName?.toLowerCase().includes(search)
        );
        totalCount = filteredResult?.length;
        result = filteredResult?.slice(skip, Number(skip) + Number(limit));
      } else {
        totalCount = localeFiltered?.length;
        result = localeFiltered?.slice(skip, Number(skip) + Number(limit));
      }
    }
    return {
      status: HTTP_CODES?.OK,
      count: totalCount,
      entryMapping: result
    };

  } catch (error: any) {
    // Log error message
    logger.error(
      getLogMessage(
        srcFunc,
        "Error occurred while getting field mapping of projects",
        error
      )
    );

    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );

  }
};

const resolveContentstackEntryUidAcrossIterations = (
  otherCmsEntryUid: string | undefined,
  fallbackId: string | undefined,
  currentModel: any,
  prevModel: any | null,
): string | undefined => {
  const fromCurrent = lookupContentstackEntryUidFromUidMap(
    otherCmsEntryUid,
    fallbackId,
    currentModel,
  );
  if (fromCurrent) return fromCurrent;
  if (prevModel) {
    return lookupContentstackEntryUidFromUidMap(
      otherCmsEntryUid,
      fallbackId,
      prevModel,
    );
  }
  return undefined;
};

const lookupContentstackEntryUidFromUidMap = (
  otherCmsEntryUid: string | undefined,
  fallbackId: string | undefined,
  uidMapperModel: any,
): string | undefined => {
  const map = getEntryUidMap(uidMapperModel);
  const otherCmsUidRaw = (otherCmsEntryUid ?? fallbackId ?? '') as string;
  if (!otherCmsUidRaw) return undefined;
  const otherCmsUid = otherCmsUidRaw.replace(/[{}]/g, '');
  const otherCmsUidLower = otherCmsUid ? otherCmsUid.toLowerCase() : '';
  const resolved =
    map[otherCmsUid] ||
    map[otherCmsUidRaw] ||
    map[otherCmsUidLower] ||
    map[idCorrector({ id: otherCmsUid })] ||
    (otherCmsUidLower ? map[idCorrector({ id: otherCmsUidLower })] : undefined);
  if (resolved == null || resolved === '' || resolved === ' ') return undefined;
  return String(resolved).trim() || undefined;
};

/**
 * Loads the nearest prior iteration's uid-mapper model, walking backward from
 * `iteration - 1` down to 1 — not just `iteration - 1` alone. `writeUidMapping` already
 * merges each successful run's uid-mapper.json forward from the one before it, so the
 * nearest prior iteration that actually has a file already carries everything from every
 * iteration before it; we only need to skip iterations where the file is simply absent
 * (e.g. a restart that skipped an actual "Start Migration" run for that iteration — see
 * CMG-1095, the same gap for content types). Without this, a single skipped iteration
 * permanently breaks uid resolution for every iteration after it.
 */
const getNearestPriorUidMapper = async (projectId: string, iteration: number): Promise<any | null> => {
  for (let i = iteration - 1; i >= 1; i--) {
    const model = getUidMapperDb(projectId, i);
    await model.read();
    const data = model?.data as any;
    const hasData =
      Object.keys(data?.entry ?? {}).length > 0 ||
      Object.keys(data?.assets ?? {}).length > 0;
    if (hasData) return model;
  }
  return null;
};

const getEntryUidMap = (uidMapperModel: any): Record<string, any> => {
  const d = uidMapperModel?.data ?? {};
  const pick = (x: unknown): Record<string, any> => {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return {};
    return x as Record<string, any>;
  };
  const fromEntryUid = flattenNestedUidMap(pick(d.entryUid));
  const fromEntry = flattenNestedUidMap(pick(d.entry));
  const nUid = Object?.keys(fromEntryUid).length;
  const nEnt = Object?.keys(fromEntry).length;
  if (nUid > 0 && nEnt > 0) {
    return { ...fromEntry, ...fromEntryUid };
  }
  if (nUid > 0) return fromEntryUid;
  if (nEnt > 0) return fromEntry;
  return {};
};

/**
 * Fill missing contentstackEntryUid from uid-mapper. Uses **current** iteration first
 * (where the latest CLI import writes), then iteration-1 so step 3 still works right
 * after restart before a re-import.
 */
const enrichEntriesWithUidMapper = async (
  projectId: string,
  iteration: number,
  entries: any[],
): Promise<any[]> => {
  if (!Array.isArray(entries) || entries?.length === 0) return entries;

  const currentModel = getUidMapperDb(projectId, iteration);
  await currentModel.read();

  const prevModel: any = iteration > 1 ? await getNearestPriorUidMapper(projectId, iteration) : null;

  return entries?.map((item: any) => {
    if (!item) return item;
    const existing = item?.contentstackEntryUid;
    if (existing != null && String(existing).trim() !== '' && existing !== ' ') {
      return item;
    }
    const resolved = resolveContentstackEntryUidAcrossIterations(
      item?.otherCmsEntryUid,
      item?.id,
      currentModel,
      prevModel,
    );
    return resolved ? { ...item, contentstackEntryUid: resolved } : item;
  });
};



const updateAssetStatus = async (req: Request) => {
  const { projectId } = req?.params;
  const { ids } = req?.body;
  const validatedUids: string[] = Array.isArray(ids) ? ids : [];
  const srcFunc = "updateAssetStatus";
  if (isEmpty(validatedUids)) {
    logger.error(
      getLogMessage(
        srcFunc,
        "Invalid ids"
      )
    );
    return {
      status: HTTP_CODES?.BAD_REQUEST,
      data: {
        message: "Invalid ids",
      },
    };
  }
  try {
    await ProjectModelLowdb.read();
    const projectData = ProjectModelLowdb.chain
      .get("projects")
      .find({ id: projectId })
      .value();
    const iteration = projectData?.iteration || 1;
    const AssetMapperModel = getAssetMapperDb(projectId, iteration);
    await AssetMapperModel.read();
    const foundAssets: AssetMapper["asset_mapper"] = [];
    await AssetMapperModel.update((data: any) => {
      data?.asset_mapper?.forEach((asset: any) => {
        if (validatedUids.includes(asset?.id)) {
          asset.isUpdate = !asset.isUpdate;
          foundAssets.push(asset);
        }
      });
    });

    if (foundAssets.length > 0) {
      return {
        status: HTTP_CODES?.OK,
        data: foundAssets
      };
    }

    return {
      status: HTTP_CODES?.NOT_FOUND,
      data: {
        message: "Asset not found",
      },
    };

  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        "Error occurred while updating asset mapping",
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR,
    );
  }
};

/**
 * Re-attempts the download for one asset that failed during the last migration run
 * (currently CMS Contentful only — the `cs_failed.json` file this reads is written by
 * contentfulService.createAssets). Only re-stages the asset locally; it lands in the
 * destination stack on the next migration run (Start Migration), same as any other asset.
 */
const retryAssetDownload = async (req: Request) => {
  const srcFunc = "retryAssetDownload";
  const projectId = req?.params?.projectId;
  const assetUid = req?.params?.assetUid;

  if (!assetUid) {
    return {
      status: HTTP_CODES?.BAD_REQUEST,
      data: { message: "Missing assetUid" },
    };
  }

  try {
    await ProjectModelLowdb.read();
    const projectData: any = ProjectModelLowdb.chain
      .get("projects")
      .find({ id: projectId })
      .value();

    const destinationStackId = projectData?.destination_stack_id;
    const filePath = projectData?.legacy_cms?.file_path;
    const cms = projectData?.legacy_cms?.cms;

    if (!destinationStackId || !filePath) {
      return {
        status: HTTP_CODES?.BAD_REQUEST,
        data: { message: "Project is missing a destination stack or source file path." },
      };
    }
    if (cms !== CMS.CONTENTFUL) {
      return {
        status: HTTP_CODES?.BAD_REQUEST,
        data: { message: "Asset retry is only supported for Contentful projects." },
      };
    }

    const cleanLocalPath = filePath.replace(/\/$/, '');
    const result = await contentfulService.retryFailedAsset(
      cleanLocalPath,
      destinationStackId,
      projectId,
      assetUid,
    );

    return {
      status: result.success ? HTTP_CODES?.OK : HTTP_CODES?.BAD_REQUEST,
      data: result,
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        "Error occurred while retrying asset download",
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR,
    );
  }
};

const getAssetMapping = async (req: Request) => {
  const srcFunc = "getAssetMapping";
  const projectId = req?.params?.projectId;
  const skip: any = req?.params?.skip;
  const limit: any = req?.params?.limit;
  const search: string = req?.params?.searchText?.toLowerCase();
  // Optional status filter: ?status=failed | missing | ok. Absent/anything else = no filter.
  const statusFilter = req?.query?.status as string | undefined;

  let result: any[] = [];
  let filteredResult = [];
  let totalCount = 0;

  try {
    await ProjectModelLowdb.read();
    const projectData = ProjectModelLowdb.chain
      .get("projects")
      .find({ id: projectId })
      .value();
    const iteration = projectData?.iteration || 1;

    const AssetMapperModel = getAssetMapperDb(projectId, iteration);
    await AssetMapperModel.read();
    let assetMapping = AssetMapperModel.chain
      .get("asset_mapper")
      .filter({ projectId })
      .value();

    // Fallback: right after a restart and before a re-upload the current
    // iteration has no rows yet — show the previous iteration's mapping.
    if ((!assetMapping || assetMapping?.length === 0) && iteration > 1) {
      const PrevAssetMapperModel = getAssetMapperDb(projectId, iteration - 1);
      await PrevAssetMapperModel.read();
      assetMapping = PrevAssetMapperModel.chain
        .get("asset_mapper")
        .filter({ projectId })
        .value();
    }

    // Fill missing contentstackAssetUid from uid-mapper (current first, then
    // the nearest prior iteration that actually has one) so rows saved before
    // the import resolve later.
    const uidMapperCurrent = getUidMapperDb(projectId, iteration);
    await uidMapperCurrent.read();
    const uidMapperPrev: any = iteration > 1 ? await getNearestPriorUidMapper(projectId, iteration) : null;

    // Whether we actually have any uid data to resolve against yet. getUidMapperDb creates
    // the file with an empty `assets: {}` default, so a fresh iteration directory (visited
    // right after a restart, before this iteration's CLI import has run and written
    // writeUidMapping's output) legitimately has none — distinct from "this project simply
    // has no previously-migrated assets". Also true if any row already carries a
    // pre-resolved uid from creation time (putTestData resolves it then, see ~line 280).
    const hasAnyUidData =
      Object.keys((uidMapperCurrent?.data as any)?.assets ?? {}).length > 0 ||
      Object.keys((uidMapperPrev?.data as any)?.assets ?? {}).length > 0 ||
      (assetMapping ?? []).some((item: any) => {
        const uid = item?.contentstackAssetUid;
        return uid != null && String(uid).trim() !== '';
      });

    let uidEnriched = (assetMapping ?? []).map((item: any) => {
      if (!item) return item;
      const existing = item?.contentstackAssetUid;
      if (existing != null && String(existing).trim() !== '') {
        return item;
      }
      const resolved =
        (uidMapperCurrent?.data as any)?.assets?.[item?.otherCmsAssetUid] ??
        (uidMapperPrev?.data as any)?.assets?.[item?.otherCmsAssetUid];
      return resolved ? { ...item, contentstackAssetUid: resolved } : item;
    });

    // Status per row for the UI: 'missing' (no url/upload in the source at all — nothing
    // to retry), 'failed' (had a source but the last migration run's download attempt
    // threw — retriable), or 'ok'. Read once per request; cs_failed.json is only written
    // after an actual migration run, so it's absent (empty status) before that.
    let failedAssets: Record<string, any> = {};
    const destinationStackId = projectData?.destination_stack_id;
    // destination_stack_id is DB-stored, but Snyk's taint tracker still traces it back to
    // the HTTP projectId param via the lowdb lookup above — sanitize it the same way the
    // rest of this codebase does (sanitizeStackId strips it to an allowlisted charset,
    // assertResolvedPathUnderBase re-confirms the joined path can't escape the data dir)
    // before it reaches a readFileSync sink.
    const safeDestinationStackId = sanitizeStackId(destinationStackId);
    if (safeDestinationStackId) {
      const assetsBase = path.resolve(MIGRATION_DATA_CONFIG.DATA);
      const failedPath = path.join(assetsBase, safeDestinationStackId, MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME, MIGRATION_DATA_CONFIG.ASSETS_FAILED_FILE);
      try {
        assertResolvedPathUnderBase(assetsBase, failedPath);
        if (fs.existsSync(failedPath)) {
          failedAssets = JSON.parse(fs.readFileSync(failedPath, 'utf-8')) || {};
        }
      } catch {
        failedAssets = {};
      }
    }
    const enrichedMapping = uidEnriched.map((item: any) => {
      if (!item) return item;
      if (item?.hasSource === false) {
        return { ...item, status: 'missing', errorMessage: 'No source file found for this asset — nothing to migrate.' };
      }
      const failure = failedAssets?.[item?.otherCmsAssetUid];
      if (failure) {
        return { ...item, status: 'failed', errorMessage: failure?.reason_for_error || 'Failed to download this asset during the last migration run.' };
      }
      return { ...item, status: 'ok' };
    });

    // Delta migration intent: on iteration 2+ the Assets tab lists ONLY assets that
    // were already migrated in a prior iteration — i.e. those with a Contentstack
    // uid. The user selects which of those to update with the current file's newer
    // version. Brand-new assets in this iteration have no prior uid; they upload
    // automatically during the run and don't need a Map Entry row (nothing to
    // select or update yet). Iteration 1 is untouched — everything is new then.
    //
    // Exception: always surface 'failed'/'missing' rows even without a uid. A brand-new
    // asset that fails to download NEVER gets a Contentstack uid (it never successfully
    // migrates), so the has-uid check alone would hide it from view forever — the user
    // would have no way to discover or retry it.
    // Only apply the delta filter once we actually have uid data to filter with —
    // otherwise a race right after restart (this iteration's uid-mapper.json not written
    // yet) would filter out EVERY row and render an empty tab indistinguishable from "no
    // previously-migrated assets", which could be mistaken for correct behavior since
    // CMG-1097 already gives that empty state a legitimate-looking layout.
    const displayMapping = iteration > 1 && hasAnyUidData
      ? enrichedMapping.filter((item: any) => {
          const uid = item?.contentstackAssetUid;
          const hasUid = uid != null && String(uid).trim() !== '';
          return hasUid || item?.status === 'failed' || item?.status === 'missing';
        })
      : enrichedMapping;

    // Aggregate counts across the FULL (unpaginated, unsearched) visible set — the banner
    // needs "3 assets won't migrate" regardless of which page or search term is active.
    const missingCount = displayMapping.filter((item: any) => item?.status === 'missing').length;
    const failedCount = displayMapping.filter((item: any) => item?.status === 'failed').length;

    const statusFiltered = statusFilter && ['ok', 'missing', 'failed'].includes(statusFilter)
      ? displayMapping.filter((item: any) => item?.status === statusFilter)
      : displayMapping;

    if (!isEmpty(statusFiltered)) {
      if (search) {
        filteredResult = statusFiltered?.filter?.((item: any) =>
          item?.filename?.toLowerCase().includes(search) ||
          item?.title?.toLowerCase().includes(search)
        );
        totalCount = filteredResult?.length;
        result = filteredResult?.slice(skip, Number(skip) + Number(limit));
      } else {
        totalCount = statusFiltered?.length;
        result = statusFiltered?.slice(skip, Number(skip) + Number(limit));
      }
    }
    return {
      status: HTTP_CODES?.OK,
      count: totalCount,
      assetMapping: result,
      missingCount,
      failedCount,
    };

  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        "Error occurred while getting asset mapping of projects",
        error
      )
    );

    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

export const contentMapperService = {
  putTestData,
  getContentTypes,
  getFieldMapping,
  getExistingContentTypes,
  updateContentType,
  resetToInitialMapping,
  resetAllContentTypesMapping,
  removeContentMapper,
  removeMapping,
  getSingleContentTypes,
  updateContentMapper,
  getExistingGlobalFields,
  getSingleGlobalField,
  getExistingTaxonomies,
  getExistingExtensions,
  getEntryMapping,
  updateEntryStatus,
  getAssetMapping,
  updateAssetStatus,
  retryAssetDownload,
};
