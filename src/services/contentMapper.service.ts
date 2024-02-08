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
  PROJECT_POPULATE_FIELDS,
  HTTP_TEXTS,
  HTTP_CODES,
} from "../constants";
import logger from "../utils/logger";
import { config } from "../config";
import https from "../utils/https.utils";
import getAuthtoken from "../utils/auth.utils";

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
    path: PROJECT_POPULATE_FIELDS,
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
  const contentTypeId = req?.params?.contentTypeId;
  const contentTypeData = req?.body;
  const { fieldMapping } = contentTypeData;

  let updatedContentType = {};

  if (isEmpty(contentTypeData)) {
    logger.error(
      getLogMessage(
        srcFun,
        `${HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND} Id: ${contentTypeId}`
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
        contentStackUid: contentTypeData?.contentStackUid,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
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
  const contentTypeId = req?.params?.contentTypeId;

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
    return { message: HTTP_TEXTS.RESET_CONTENT_MAPPING };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while resetting the field mapping for the ContentType ID: ${contentTypeId}`,
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.status || HTTP_CODES.SERVER_ERROR
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
};
