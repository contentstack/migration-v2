import { Request } from "express";
import { getLogMessage, isEmpty, safePromise } from "../utils/index.js";
import {
  BadRequestError,
  ExceptionFunction,
} from "../utils/custom-errors.utils.js";
import {
  HTTP_TEXTS,
  HTTP_CODES,
  STEPPER_STEPS,
  NEW_PROJECT_STATUS,
  CONTENT_TYPE_STATUS,
  VALIDATION_ERRORS,
} from "../constants/index.js";
import logger from "../utils/logger.js";
import { config } from "../config/index.js";
import https from "../utils/https.utils.js";
import getAuthtoken from "../utils/auth.utils.js";
import getProjectUtil from "../utils/get-project.utils.js";
import ProjectModelLowdb from "../models/project-lowdb.js";
import FieldMapperModel from "../models/FieldMapper.js";
import { v4 as uuidv4 } from "uuid";
import ContentTypesMapperModelLowdb from "../models/contentTypesMapper-lowdb.js";
import { ContentTypesMapper } from "../models/contentTypesMapper-lowdb.js";

// Developer service to create dummy contentmapping data
/**
 * Updates the test data for a given project.
 *
 * @param req - The request object containing the project ID and content types.
 * @returns The updated project data.
 */
const putTestData = async (req: Request) => {
  const projectId = req.params.projectId;
  const contentTypes = req.body.contentTypes;

  await FieldMapperModel.read();

  /*
  this code snippet iterates over an array of contentTypes and performs 
  some operations on each element. 
  It creates a new array called fields by mapping over the fieldMapping property of each type in contentTypes. 
  It generates a unique identifier for each field, pushes it into the fieldIds array, 
  and returns an object with additional properties. 
  It then updates the field_mapper property of a data object using the FieldMapperModel.update() function. 
  Finally, it updates the fieldMapping property of each type in the contentTypes array with the fieldIds array.
  */
  contentTypes.map((type: any, index: any) => {
    const fieldIds: string[] = [];
    const fields = type?.fieldMapping?.map?.((field: any) => {
      const id = field?.id?.replace(/[{}]/g, "")?.toLowerCase() || uuidv4();
      field.id = id;
      fieldIds.push(id);
      return { id, projectId, isDeleted: false, ...field };
    });
    FieldMapperModel.update((data: any) => {
      data.field_mapper = [...(data?.field_mapper ?? []), ...fields];
    });
    contentTypes[index].fieldMapping = fieldIds;
  });

  await ContentTypesMapperModelLowdb.read();
  const contentIds: string[] = [];

  /*
  this code snippet is iterating over an array called contentTypes and 
  transforming each element by adding a unique identifier (id) if it doesn't already exist. 
  The transformed elements are then stored in the contentType variable, 
  and the generated id values are pushed into the contentIds array.
  */
  const contentType = contentTypes.map((item: any) => {
    const id = item?.id.replace(/[{}]/g, "")?.toLowerCase() || uuidv4();
    item.id = id;
    contentIds.push(id);
    return { ...item, id, projectId };
  });

  await ContentTypesMapperModelLowdb.update((data: any) => {
    data.ContentTypesMappers = [
      ...(data?.ContentTypesMappers ?? []),
      ...contentType,
    ];
  });

  await ProjectModelLowdb.read();
  const index = ProjectModelLowdb.chain
    .get("projects")
    .findIndex({ id: projectId })
    .value();
  if (index > -1) {
    ProjectModelLowdb.update((data: any) => {
      data.projects[index].content_mapper = contentIds;
    });
  }

  const pData = ProjectModelLowdb.chain
    .get("projects")
    .find({ id: projectId })
    .value();

  return pData;
};

/**
 * Retrieves the content types based on the provided request parameters.
 * @param req - The request object containing the parameters.
 * @returns An object containing the total count and the array of content types.
 */
const getContentTypes = async (req: Request) => {
  const sourceFn = "getContentTypes";
  const projectId = req?.params?.projectId;
  const skip: any = req?.params?.skip;
  const limit: any = req?.params?.limit;
  const search: string = req?.params?.searchText?.toLowerCase();

  let result: any = [];
  let totalCount = 0;

  await ProjectModelLowdb.read();
  const projectDetails = ProjectModelLowdb.chain
    .get("projects")
    .find({ id: projectId })
    .value();

  if (isEmpty(projectDetails)) {
    logger.error(
      getLogMessage(
        sourceFn,
        `${HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`
      )
    );
    throw new BadRequestError(HTTP_TEXTS.PROJECT_NOT_FOUND);
  }
  const contentMapperId = projectDetails.content_mapper;
  await ContentTypesMapperModelLowdb.read();
  await FieldMapperModel.read();

  const content_mapper: any = [];
  contentMapperId.map((data: any) => {
    const contentMapperData = ContentTypesMapperModelLowdb.chain
      .get("ContentTypesMappers")
      .find({ id: data, projectId: projectId })
      .value();
    content_mapper.push(contentMapperData);
  });

  if (!isEmpty(content_mapper)) {
    if (search) {
      const filteredResult = content_mapper
        .filter((item: any) =>
          item?.otherCmsTitle?.toLowerCase().includes(search)
        )
        ?.sort((a: any, b: any) =>
          a.otherCmsTitle.localeCompare(b.otherCmsTitle)
        );
      totalCount = filteredResult.length;
      result = filteredResult.slice(skip, Number(skip) + Number(limit));
    } else {
      totalCount = content_mapper.length;
      result = content_mapper
        ?.sort((a: any, b: any) =>
          a.otherCmsTitle.localeCompare(b.otherCmsTitle)
        )
        ?.slice(skip, Number(skip) + Number(limit));
    }
  }

  return { count: totalCount, contentTypes: result };
};

/**
 * Retrieves the field mapping for a given content type.
 * @param req - The request object containing the content type ID, skip, limit, and search text.
 * @returns An object containing the count of field mappings and the filtered/sliced field mappings.
 * @throws BadRequestError if the content type is not found.
 */
const getFieldMapping = async (req: Request) => {
  const srcFunc = "getFieldMapping";
  const contentTypeId = req?.params?.contentTypeId;
  const projectId = req?.params?.projectId;
  const skip: any = req?.params?.skip;
  const limit: any = req?.params?.limit;
  const search: string = req?.params?.searchText?.toLowerCase();

  let result: any[] = [];
  let filteredResult = [];
  let totalCount = 0;

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
  await FieldMapperModel.read();
  const fieldData = contentType?.fieldMapping?.map?.((fields: any) => {
    const fieldMapper = FieldMapperModel.chain
      .get("field_mapper")
      .find({ id: fields, projectId: projectId })
      .value();

    return fieldMapper;
  });
  const fieldMapping: any = fieldData;
  if (!isEmpty(fieldMapping)) {
    if (search) {
      filteredResult = fieldMapping?.filter?.((item: any) =>
        item?.otherCmsField?.toLowerCase().includes(search)
      );
      totalCount = filteredResult.length;
      result = filteredResult.slice(skip, Number(skip) + Number(limit));
    } else {
      totalCount = fieldMapping.length;
      result = fieldMapping.slice(skip, Number(skip) + Number(limit));
    }
  }

  return { count: totalCount, fieldMapping: result };
};

/**
 * Retrieves existing content types for a given project.
 * @param req - The request object containing the project ID and token payload.
 * @returns An object containing the retrieved content types.
 */
const getExistingContentTypes = async (req: Request) => {
  const projectId = req?.params?.projectId;

  const { token_payload } = req.body;

  const authtoken = await getAuthtoken(
    token_payload?.region,
    token_payload?.user_id
  );
  await ProjectModelLowdb.read();
  const project = ProjectModelLowdb.chain
    .get("projects")
    .find({ id: projectId })
    .value();
  const stackId = project?.destination_stack_id;
  const [err, res] = await safePromise(
    https({
      method: "GET",
      url: `${config.CS_API[
        token_payload?.region as keyof typeof config.CS_API
      ]!}/content_types`,
      headers: {
        api_key: stackId,
        authtoken: authtoken,
      },
    })
  );

  if (err)
    return {
      data: err.response.data,
      status: err.response.status,
    };

  const contentTypes = res.data.content_types.map((singleCT: any) => {
    return {
      title: singleCT.title,
      uid: singleCT.uid,
      schema: singleCT.schema,
    };
  });

  //Add logic to get Project from DB
  return { contentTypes };
};
/**
 * Updates the content type based on the provided request.
 * @param req - The request object containing the necessary parameters and data.
 * @returns An object containing the updated content type.
 * @throws BadRequestError if the request is invalid or the content type cannot be updated.
 * @throws ExceptionFunction if an error occurs while updating the content type.
 */
const updateContentType = async (req: Request) => {
  const srcFun = "updateContentType";
  const { orgId, projectId, contentTypeId } = req.params;
  const { contentTypeData, token_payload } = req.body;
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
    true
  )) as number;
  const project = ProjectModelLowdb.data.projects[projectIndex];

  // Check project status
  if (
    [NEW_PROJECT_STATUS[5], NEW_PROJECT_STATUS[4]].includes(project.status) ||
    project.current_step < STEPPER_STEPS.CONTENT_MAPPING
  ) {
    logger.error(
      getLogMessage(
        srcFun,
        HTTP_TEXTS.CANNOT_UPDATE_CONTENT_MAPPING,
        token_payload
      )
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
        `${HTTP_TEXTS.INVALID_CONTENT_TYPE} Id: ${contentTypeId}`
      )
    );
    return {
      status: 400,
      message: HTTP_TEXTS.INVALID_CONTENT_TYPE,
    };
  }

  try {
    await ContentTypesMapperModelLowdb.read();
    const updateIndex = ContentTypesMapperModelLowdb.chain
      .get("ContentTypesMappers")
      .findIndex({ id: contentTypeId, projectId: projectId })
      .value();

    if (fieldMapping) {
      for (const field of fieldMapping) {
        if (
          !field.ContentstackFieldType ||
          field.ContentstackFieldType === "" ||
          field.ContentstackFieldType === "No matches found" ||
          field.contentstackFieldUid === ""
        ) {
          logger.error(
            getLogMessage(
              srcFun,
              `${VALIDATION_ERRORS.STRING_REQUIRED.replace(
                "$",
                "ContentstackFieldType or contentstackFieldUid"
              )}`
            )
          );
          await ContentTypesMapperModelLowdb.update((data: any) => {
            data.ContentTypesMappers[updateIndex].status =
              CONTENT_TYPE_STATUS[3];
          });
          return {
            status: 400,
            message: `${VALIDATION_ERRORS.STRING_REQUIRED.replace(
              "$",
              "ContentstackFieldType or contentstackFieldUid"
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
          `${HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND} Id: ${contentTypeId}`
        )
      );
      return {
        status: 404,
        message: HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND,
      };
    }

    if (!isEmpty(fieldMapping)) {
      await FieldMapperModel.read();
      fieldMapping.forEach((field: any) => {
        const fieldIndex = FieldMapperModel.data.field_mapper.findIndex(
          (f: any) => f?.id === field?.id
        );
        if (fieldIndex > -1 && field?.ContentstackFieldType !== "") {
          FieldMapperModel.update((data: any) => {
            data.field_mapper[fieldIndex] = field;
            //data.field_mapper[fieldIndex].isDeleted = false;
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
      .get("ContentTypesMappers")
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
        error
      )
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
  const srcFunc = "resetToInitialMapping";
  const { orgId, projectId, contentTypeId } = req.params;
  const { token_payload } = req.body;

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
    true
  )) as number;

  const project = ProjectModelLowdb.data.projects[projectIndex];

  if (
    [
      NEW_PROJECT_STATUS[0],
      NEW_PROJECT_STATUS[5],
      NEW_PROJECT_STATUS[4],
    ].includes(project.status) ||
    project.current_step < STEPPER_STEPS.CONTENT_MAPPING
  ) {
    logger.error(
      getLogMessage(
        srcFunc,
        HTTP_TEXTS.CANNOT_RESET_CONTENT_MAPPING,
        token_payload
      )
    );
    throw new BadRequestError(HTTP_TEXTS.CANNOT_RESET_CONTENT_MAPPING);
  }

  await ContentTypesMapperModelLowdb.read();
  const contentTypeData = ContentTypesMapperModelLowdb.chain
    .get("ContentTypesMappers")
    .find({ id: contentTypeId, projectId: projectId })
    .value();

  await FieldMapperModel.read();
  const fieldMappingData = contentTypeData.fieldMapping.map((itemId: any) => {
    const fieldData = FieldMapperModel.chain
      .get("field_mapper")
      .find({ id: itemId, projectId: projectId })
      .value();
    return fieldData;
  });

  if (isEmpty(contentTypeData)) {
    logger.error(
      getLogMessage(
        srcFunc,
        `${HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND} Id: ${contentTypeId}`
      )
    );
    throw new BadRequestError(HTTP_TEXTS.INVALID_CONTENT_TYPE);
  }

  try {
    if (!isEmpty(fieldMappingData)) {
      await FieldMapperModel.read();
      (fieldMappingData || []).forEach((field: any) => {
        const fieldIndex = FieldMapperModel.data.field_mapper.findIndex(
          (f: any) => f?.id === field?.id
        );
        if (fieldIndex > -1) {
          FieldMapperModel.update((data: any) => {
            data.field_mapper[fieldIndex] = {
              ...field,
              contentstackField: "",
              contentstackFieldUid: "",
              ContentstackFieldType: field.backupFieldType,
            };
          });
        }
      });
    }
    const contentIndex = ContentTypesMapperModelLowdb.chain
      .get("ContentTypesMappers")
      .findIndex({ id: contentTypeId })
      .value();
    if (contentIndex > -1) {
      ContentTypesMapperModelLowdb.update((data: any) => {
        data.ContentTypesMappers[contentIndex].contentstackTitle = "";
        data.ContentTypesMappers[contentIndex].contentstackUid = "";
      });
    }
    return { message: HTTP_TEXTS.RESET_CONTENT_MAPPING };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while resetting the field mapping for the ContentType ID: ${contentTypeId}`,
        {},
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.status || error.statusCode || HTTP_CODES.SERVER_ERROR
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
  const srcFunc = "resetAllContentTypesMapping";

  await ProjectModelLowdb.read();
  const projectDetails = ProjectModelLowdb.chain
    .get("projects")
    .find({ id: projectId })
    .value();

  const contentMapperId = projectDetails?.content_mapper;
  if (isEmpty(contentMapperId)) {
    logger.error(
      getLogMessage(
        srcFunc,
        `${HTTP_TEXTS.CONTENTMAPPER_NOT_FOUND} projectId: ${projectId}`
      )
    );
    throw new BadRequestError(HTTP_TEXTS.CONTENTMAPPER_NOT_FOUND);
  }
  if (isEmpty(projectDetails)) {
    logger.error(
      getLogMessage(
        srcFunc,
        `${HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`
      )
    );
    throw new BadRequestError(HTTP_TEXTS.PROJECT_NOT_FOUND);
  }
  await ContentTypesMapperModelLowdb.read();
  const cData = contentMapperId.map((cId: any) => {
    const contentTypeData = ContentTypesMapperModelLowdb.chain
      .get("ContentTypesMappers")
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
            .get("field_mapper")
            .find({ id: field, projectId: projectId })
            .value();
          const fieldIndex = FieldMapperModel.chain
            .get("field_mapper")
            .findIndex({ id: field, projectId: projectId })
            .value();

          if (fieldIndex > -1) {
            await FieldMapperModel.update((fData: any) => {
              fData.field_mapper[fieldIndex] = {
                ...fieldData,
                contentstackField: "",
                contentstackFieldUid: "",
                ContentstackFieldType: fieldData.backupFieldType,
              };
            });
          }
        }
      }
      await ContentTypesMapperModelLowdb.read();
      if (!isEmpty(contentType?.id)) {
        const cIndex = ContentTypesMapperModelLowdb.chain
          .get("ContentTypesMappers")
          .findIndex({ id: contentType?.id, projectId: projectId })
          .value();
        if (cIndex > -1) {
          await ContentTypesMapperModelLowdb.update((data: any) => {
            data.ContentTypesMappers[cIndex].contentstackTitle = "";
            data.ContentTypesMappers[cIndex].contentstackUid = "";
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
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
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
  const srcFunc = "removeMapping";
  await ProjectModelLowdb.read();
  const projectDetails = ProjectModelLowdb.chain
    .get("projects")
    .find({ id: projectId })
    .value();

  if (isEmpty(projectDetails)) {
    logger.error(
      getLogMessage(
        srcFunc,
        `${HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`
      )
    );
    throw new BadRequestError(HTTP_TEXTS.PROJECT_NOT_FOUND);
  }
  await ContentTypesMapperModelLowdb.read();
  const cData = projectDetails?.content_mapper.map((cId: any) => {
    const contentTypeData = ContentTypesMapperModelLowdb.chain
      .get("ContentTypesMappers")
      .find({ id: cId, projectId: projectId })
      .value();
    return contentTypeData;
  });

  try {
    const contentTypes = cData;
    //TODO: remove fieldMapping ids in ContentTypesMapperModel for each content types

    for (const contentType of contentTypes) {
      if (contentType && !isEmpty(contentType.fieldMapping)) {
        for (const field of contentType.fieldMapping) {
          await FieldMapperModel.read();
          const fieldIndex = FieldMapperModel.chain
            .get("field_mapper")
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
          .get("ContentTypesMappers")
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
      .get("projects")
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
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
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
    token_payload?.user_id
  );
  await ProjectModelLowdb.read();
  const project = ProjectModelLowdb.chain
    .get("projects")
    .find({ id: projectId })
    .value();
  const stackId = project?.destination_stack_id;

  const [err, res] = await safePromise(
    https({
      method: "GET",
      url: `${config.CS_API[
        token_payload?.region as keyof typeof config.CS_API
      ]!}/content_types/${contentTypeUID}`,
      headers: {
        api_key: stackId,
        authtoken: authtoken,
      },
    })
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
 * Removes the content mapping for a project.
 * @param req - The request object containing the project ID.
 * @returns The project details after removing the content mapping.
 * @throws {BadRequestError} If the project is not found.
 * @throws {ExceptionFunction} If an error occurs while removing the content mapping.
 */
const removeContentMapper = async (req: Request) => {
  const projectId = req?.params?.projectId;
  const srcFunc = "removeMapping";
  await ProjectModelLowdb.read();
  const projectDetails = ProjectModelLowdb.chain
    .get("projects")
    .find({ id: projectId })
    .value();

  if (isEmpty(projectDetails)) {
    logger.error(
      getLogMessage(
        srcFunc,
        `${HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`
      )
    );
    throw new BadRequestError(HTTP_TEXTS.PROJECT_NOT_FOUND);
  }
  await ContentTypesMapperModelLowdb.read();
  const cData: ContentTypesMapper[] = projectDetails?.content_mapper.map(
    (cId: string) => {
      const contentTypeData: ContentTypesMapper =
        ContentTypesMapperModelLowdb.chain
          .get("ContentTypesMappers")
          .find({ id: cId, projectId: projectId })
          .value();
      return contentTypeData;
    }
  );

  try {
    const contentTypes: ContentTypesMapper[] = cData;
    //TODO: remove fieldMapping ids in ContentTypesMapperModel for each content types

    for (const contentType of contentTypes) {
      if (contentType && !isEmpty(contentType.fieldMapping)) {
        for (const field of contentType.fieldMapping) {
          await FieldMapperModel.read();
          const fieldIndex = FieldMapperModel.chain
            .get("field_mapper")
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
          .get("ContentTypesMappers")
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
      .get("projects")
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
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
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
  console.info("updateContentMapper", req.params, req.body);

  const { orgId, projectId } = req.params;
  const { token_payload, content_mapper } = req.body;
  const srcFunc = "updateContentMapper";

console.info("HERE",content_mapper)
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
    true
  )) as number;

  try {
    ProjectModelLowdb.update((data: any) => {
      // console.info("data ===============", data, content_mapper)
      data.projects[projectIndex].mapperKeys = content_mapper;
      data.projects[projectIndex].updated_at = new Date().toISOString();
    });

    logger.info(
      getLogMessage(
        srcFunc,
        `Content mapping for project [Id : ${projectId}] has been successfully updated.`,
        token_payload
      )
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
  updateContentMapper
};
