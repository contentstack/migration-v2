import { Request } from "express";
import ContentTypesMapperModel from "../models/contentTypesMapper";
import FieldMapperModel from "../models/FieldMapper";
import ProjectModel from "../models/project";
import { getLogMessage, isEmpty, safePromise } from "../utils";
import {
  BadRequestError,
  ExceptionFunction,
} from "../utils/custom-errors.utils";
import {
  CONTENT_TYPE_POPULATE_FIELDS,
  HTTP_TEXTS,
  HTTP_CODES,
  POPULATE_CONTENT_MAPPER,
  POPULATE_FIELD_MAPPING,
  EXCLUDE_CONTENT_MAPPER,
  PROJECT_STATUS,
  STEPPER_STEPS,
} from "../constants";
import logger from "../utils/logger";
import { config } from "../config";
import https from "../utils/https.utils";
import getAuthtoken from "../utils/auth.utils";
import getProjectUtil from "../utils/get-project.utils";

// Developer service to create dummy contentmapping data
const putTestData = async (req: Request) => {
  const projectId = req.params.projectId;
  const contentTypes = req.body;

  // console.log(contentTypes)
  await Promise.all(
    contentTypes.map(async (type: any, index: any) => {
      await FieldMapperModel.insertMany(type.fieldMapping, {
        ordered: true,
      })
        .then(function (docs: any) {
          // do something with docs
          contentTypes[index].fieldMapping = docs.map((item: any) => {
            return item._id;
          });
        })
        .catch(function () {
          // console.log("type.fieldMapping")
          //  console.log(err)
          // error handling here
        });
    })
  );

  let typeIds: any = [];

  await ContentTypesMapperModel.insertMany(contentTypes, {
    ordered: true,
  })
    .then(async function (docs) {
      // do something with docs
      typeIds = docs.map((item) => {
        return item._id;
      });
    })
    .catch(function () {
      // console.log(err)
      // error handling here
    });

  const projectDetails: any = await ProjectModel.findOne({
    _id: projectId,
  });
  projectDetails.content_mapper = typeIds;
  projectDetails.save();
  //Add logic to get Project from DB
  return projectDetails;
};

const getContentTypes = async (req: Request) => {
  const sourceFn = "getContentTypes";
  const projectId = req?.params?.projectId;
  const skip: any = req?.params?.skip;
  const limit: any = req?.params?.limit;
  const search: string = req?.params?.searchText?.toLowerCase();

  let result = [];
  let totalCount = 0;
  const projectDetails = await ProjectModel.findOne({
    _id: projectId,
  }).populate({
    path: POPULATE_CONTENT_MAPPER,
    select: CONTENT_TYPE_POPULATE_FIELDS,
  });

  if (isEmpty(projectDetails)) {
    logger.error(
      getLogMessage(
        sourceFn,
        `${HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`
      )
    );
    throw new BadRequestError(HTTP_TEXTS.PROJECT_NOT_FOUND);
  }
  const { content_mapper }: any = projectDetails;

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

  let result = [];
  let filteredResult = [];
  let totalCount = 0;

  const contentType = await ContentTypesMapperModel.findOne({
    _id: contentTypeId,
  }).populate("fieldMapping");

  if (isEmpty(contentType)) {
    logger.error(
      getLogMessage(
        srcFunc,
        `${HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND} Id: ${contentTypeId}`
      )
    );
    throw new BadRequestError(HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND);
  }

  const { fieldMapping }: any = contentType;
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
  const project = await ProjectModel.findById(projectId);
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
  // const token_payload = req?.body?.token_payload;
  const fieldMapping = contentTypeData?.fieldMapping;

  let updatedContentType: any = {};

  const project = await getProjectUtil(
    projectId,
    {
      _id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    EXCLUDE_CONTENT_MAPPER,
    srcFun
  );

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
    updatedContentType = await ContentTypesMapperModel.findOneAndUpdate(
      {
        _id: contentTypeId,
      },
      {
        otherCmsTitle: contentTypeData?.otherCmsTitle,
        otherCmsUid: contentTypeData?.otherCmsUid,
        isUpdated: contentTypeData?.isUpdated,
        updateAt: contentTypeData?.updateAt,
        contentstackTitle: contentTypeData?.contentstackTitle,
        contentstackUid: contentTypeData?.contentstackUid,
      },
      { new: true, setDefaultsOnInsert: true }
    );
    if (isEmpty(updatedContentType)) {
      logger.error(
        getLogMessage(
          srcFun,
          `${HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND} Id: ${contentTypeId}`
        )
      );
      throw new BadRequestError(HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND);
    }
    if (!isEmpty(fieldMapping)) {
      const bulkWriteOperations = fieldMapping?.map((doc: any) => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true,
        },
      }));
      await FieldMapperModel.bulkWrite(bulkWriteOperations, { ordered: false });
    }

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

  const project = await getProjectUtil(
    projectId,
    {
      _id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    EXCLUDE_CONTENT_MAPPER,
    srcFunc
  );

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

  const contentType: any = await ContentTypesMapperModel.findOne({
    _id: contentTypeId,
  }).populate(POPULATE_FIELD_MAPPING);

  if (isEmpty(contentType)) {
    logger.error(
      getLogMessage(
        srcFunc,
        `${HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND} Id: ${contentTypeId}`
      )
    );
    throw new BadRequestError(HTTP_TEXTS.INVALID_CONTENT_TYPE);
  }

  try {
    if (!isEmpty(contentType?.fieldMapping)) {
      const bulkWriteOperations: any = contentType?.fieldMapping?.map(
        (doc: any) => ({
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: {
                contentstackField: "",
                contentstackFieldUid: "",
                ContentstackFieldType: doc.backupFieldType,
              },
            },
          },
        })
      );
      await FieldMapperModel.bulkWrite(bulkWriteOperations, { ordered: false });
    }
    contentType.contentstackTitle = "";
    contentType.contentstackUid = "";
    contentType?.save();
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

    const contentTypesbulkWriteOperations: any = await Promise.all(
      contentTypes?.map(async (contentType: any) => {
        if (!isEmpty(contentType?.fieldMapping)) {
          const bulkWriteOperations: any = contentType?.fieldMapping?.map(
            (doc: any) => ({
              updateOne: {
                filter: { _id: doc._id },
                update: {
                  $set: {
                    contentstackField: "",
                    contentstackFieldUid: "",
                    ContentstackFieldType: doc.backupFieldType,
                  },
                },
              },
            })
          );
          await FieldMapperModel.bulkWrite(bulkWriteOperations, {
            ordered: false,
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
    await ContentTypesMapperModel.bulkWrite(contentTypesbulkWriteOperations, {
      ordered: false,
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

    const contentTypesbulkWriteOperations: any = await Promise.all(
      contentTypes?.map(async (contentType: any) => {
        if (!isEmpty(contentType?.fieldMapping)) {
          const bulkWriteOperations: any = contentType?.fieldMapping?.map(
            (doc: any) => ({
              deleteOne: {
                filter: { _id: doc._id },
              },
            })
          );
          await FieldMapperModel.bulkWrite(bulkWriteOperations, {
            ordered: false,
          });
        }
        return {
          deleteOne: {
            filter: { _id: contentType._id },
          },
        };
      })
    );
    await ContentTypesMapperModel.bulkWrite(contentTypesbulkWriteOperations, {
      ordered: false,
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
