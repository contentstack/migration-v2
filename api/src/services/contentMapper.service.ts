import { Request } from "express";
import ProjectModel from "../models/project.js";
import { getLogMessage, isEmpty, safePromise } from "../utils/index.js";
import {
  BadRequestError,
  ExceptionFunction,
} from "../utils/custom-errors.utils.js";
import {
  HTTP_TEXTS,
  HTTP_CODES,
  POPULATE_CONTENT_MAPPER,
  POPULATE_FIELD_MAPPING,
  PROJECT_STATUS,
  STEPPER_STEPS,
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

// Developer service to create dummy contentmapping data
const putTestData = async (req: Request) => {
  const projectId = req.params.projectId;
  const contentTypes = req.body.contentTypes;

  await FieldMapperModel.read();
  contentTypes.map((type: any, index: any) => {
    const fieldIds: string[] = [];
    const fields = type.fieldMapping.map((field: any) => {
      const id = uuidv4();
      fieldIds.push(id);
      return { id, isDeleted: false, ...field };
    });
    FieldMapperModel.update((data: any) => {
      data.field_mapper = [...data.field_mapper, ...fields];
    });
    contentTypes[index].fieldMapping = fieldIds;
  });

  await ContentTypesMapperModelLowdb.read();
  const contentIds: string[] = [];
  const contentType = contentTypes.map((item: any) => {
    const id = uuidv4();
    contentIds.push(id);
    return { id, ...item };
  });

  await ContentTypesMapperModelLowdb.update((data: any) => {
    data.ContentTypesMappers = contentType;
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
  const content_mapper: any = [];
  contentMapperId.map((data: any) => {
    const contentMapperData = ContentTypesMapperModelLowdb.chain
      .get("ContentTypesMappers")
      .find({ id: data })
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

const getFieldMapping = async (req: Request) => {
  const srcFunc = "getFieldMapping";
  const contentTypeId = req?.params?.contentTypeId;
  const skip: any = req?.params?.skip;
  const limit: any = req?.params?.limit;
  const search: string = req?.params?.searchText?.toLowerCase();

  let result: any[] = [];
  let filteredResult = [];
  let totalCount = 0;

  await ContentTypesMapperModelLowdb.read();

  const contentType = ContentTypesMapperModelLowdb.chain
    .get("ContentTypesMappers")
    .find({ id: contentTypeId })
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
  const fieldData = contentType.fieldMapping.map((fields: any) => {
    const fieldMapper = FieldMapperModel.chain
      .get("field_mapper")
      .find({ id: fields })
      .value();
    return fieldMapper;
  });

  const fieldMapping: any = fieldData;
  if (!isEmpty(fieldMapping)) {
    if (search) {
      filteredResult = fieldMapping.filter((item: any) =>
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
const updateContentType = async (req: Request) => {
  const srcFun = "udateContentType";
  const { orgId, projectId, contentTypeId } = req.params;
  const { contentTypeData, token_payload } = req.body;
  const fieldMapping = contentTypeData?.fieldMapping;

  // const updatedContentType: any = {};

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

  if (
    [
      PROJECT_STATUS.DRAFT,
      PROJECT_STATUS.SUCCESS,
      PROJECT_STATUS.INPROGRESS,
    ].includes(project.status) ||
    project.current_step < STEPPER_STEPS.CONTENT_MAPPING
  ) {
    logger.error(
      getLogMessage(
        srcFun,
        HTTP_TEXTS.CANNOT_UPDATE_CONTENT_MAPPING,
        token_payload
      )
    );
    throw new BadRequestError(HTTP_TEXTS.CANNOT_UPDATE_CONTENT_MAPPING);
  }

  if (isEmpty(contentTypeData)) {
    logger.error(
      getLogMessage(
        srcFun,
        `${HTTP_TEXTS.INVALID_CONTENT_TYPE} Id: ${contentTypeId}`
      )
    );
    throw new BadRequestError(HTTP_TEXTS.INVALID_CONTENT_TYPE);
  }
  try {
    await ContentTypesMapperModelLowdb.read();
    const updateIndex = ContentTypesMapperModelLowdb.chain
      .get("ContentTypesMappers")
      .findIndex({ id: contentTypeId })
      .value();

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
      throw new BadRequestError(HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND);
    }
    if (!isEmpty(fieldMapping)) {
      await FieldMapperModel.read();
      (fieldMapping || []).forEach((field: any) => {
        const fieldIndex = FieldMapperModel.data.field_mapper.findIndex(
          (f: any) => f?.id === field?.id
        );
        if (fieldIndex > -1) {
          FieldMapperModel.update((data: any) => {
            data.field_mapper[fieldIndex] = field;
          });
        }
      });
    }
    // fetch updated data to return in response
    await ContentTypesMapperModelLowdb.read();
    const updatedContentType = ContentTypesMapperModelLowdb.chain
      .get("ContentTypesMappers")
      .find({ id: contentTypeId })
      .value();

    return { updatedContentType };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFun,
        `Error while updating ContentType Id: ${contentTypeId}`,
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};
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
      PROJECT_STATUS.DRAFT,
      PROJECT_STATUS.SUCCESS,
      PROJECT_STATUS.INPROGRESS,
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
    .find({ id: contentTypeId })
    .value();

  await FieldMapperModel.read();
  const fieldMappingData = contentTypeData.fieldMapping.map((itemId: any) => {
    const fieldData = FieldMapperModel.chain
      .get("field_mapper")
      .find({ id: itemId })
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
const resetAllContentTypesMapping = async (projectId: string) => {
  const srcFunc = "resetAllContentTypesMapping";
  // const projectId = req?.params?.projectId;

  // const projectDetails: any = await ProjectModel.findOne({
  //   _id: projectId,
  // }).populate({
  //   path: POPULATE_CONTENT_MAPPER,
  //   populate: { path: POPULATE_FIELD_MAPPING },
  // });
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
  await ContentTypesMapperModelLowdb.read();
  const data = contentMapperId.map((id: any) => {
    const getFeildMappingData = ContentTypesMapperModelLowdb.chain
      .get("ContentTypesMappers")
      .find({ id: id })
      .value();
    return getFeildMappingData;
  });

  if (isEmpty(projectDetails)) {
    logger.error(
      getLogMessage(
        srcFunc,
        `${HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`
      )
    );
    throw new BadRequestError(HTTP_TEXTS.PROJECT_NOT_FOUND);
  }

  try {
    // const contentTypes = projectDetails?.content_mapper;
    const contentTypes = data;
    const contentTypesbulkWriteOperations: any = await Promise.all(
      contentTypes?.map(async (contentType: any) => {
        if (!isEmpty(contentType?.fieldMapping)) {
          await FieldMapperModel.read();
          (contentType?.fieldMapping || []).forEach((field: any) => {
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
        return {
          updateOne: {
            filter: { _id: contentType._id },
            update: {
              $set: {
                contentstackTitle: "",
                contentstackUid: "",
              },
            },
          },
        };
      })
    );

    await ContentTypesMapperModelLowdb.read();
    ContentTypesMapperModelLowdb.update((data: any) => {
      data.ContentTypesMappers.push(contentTypesbulkWriteOperations);
    });
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
const removeMapping = async (projectId: string) => {
  const srcFunc = "removeMapping";

  const projectDetails: any = await ProjectModel.findOne({
    _id: projectId,
  }).populate({
    path: POPULATE_CONTENT_MAPPER,
    populate: { path: POPULATE_FIELD_MAPPING },
  });

  if (isEmpty(projectDetails)) {
    logger.error(
      getLogMessage(
        srcFunc,
        `${HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`
      )
    );
    throw new BadRequestError(HTTP_TEXTS.PROJECT_NOT_FOUND);
  }

  try {
    const contentTypes = projectDetails?.content_mapper;

    //TODO: remove fieldMapping ids in ContentTypesMapperModel for each content types
    const contentTypesbulkWriteOperations: any = await Promise.all(
      contentTypes?.map(async (contentType: any) => {
        if (!isEmpty(contentType?.fieldMapping)) {
          await FieldMapperModel.read();
          (contentType?.fieldMapping || []).forEach((field: any) => {
            const fieldIndex = FieldMapperModel.data.field_mapper.findIndex(
              (f: any) => f?.id === field?.id
            );
            if (fieldIndex > -1) {
              FieldMapperModel.update((data: any) => {
                delete data.field_mapper[fieldIndex];
              });
            }
          });
        }
        return {
          deleteOne: {
            filter: { _id: contentType._id },
          },
        };
      })
    );

    await ContentTypesMapperModelLowdb.read();
    ContentTypesMapperModelLowdb.update((data: any) => {
      data.ContentTypesMappers.push(contentTypesbulkWriteOperations);
    });
    projectDetails.content_mapper = [];
    await projectDetails?.save();
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
export const contentMapperService = {
  putTestData,
  getContentTypes,
  getFieldMapping,
  getExistingContentTypes,
  updateContentType,
  resetToInitialMapping,
  resetAllContentTypesMapping,
  removeMapping,
};
