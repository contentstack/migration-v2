import { Request } from "express";
import { EXCLUDE_CONTENT_MAPPER, HTTP_TEXTS, HTTP_CODES } from "../constants";
import { initialize, preSignedUrls, finalize } from "../utils/s3-uploads.utils";
import getProjectUtil from "../utils/get-project.utils";
import { getLogMessage } from "../utils/index";
import { S3Error } from "../utils/custom-errors.utils";
import logger from "../utils/logger";

const initializeUpload = async (req: Request) => {
  const srcFun = "initializeUpload";
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const fileName = req.body.file_name;
  const { token_payload } = req.body;
  const { user_id = "", region = "" } = token_payload;

  try {
    // Find the project based on both orgId and projectId, region, owner
    await getProjectUtil(
      projectId,
      {
        _id: projectId,
        org_id: orgId,
        region: region,
        owner: user_id,
      },
      EXCLUDE_CONTENT_MAPPER
    );

    const result = await initialize(
      region,
      orgId,
      user_id,
      projectId,
      fileName
    );

    return {
      status: HTTP_CODES.OK,
      data: {
        file_id: result.UploadId,
        file_key: result.Key,
      },
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFun,
        "Error while initializing upload",
        token_payload,
        error
      )
    );

    throw new S3Error();
  }
};

const getPreSignedUrls = async (req: Request) => {
  const srcFun = "getPreSignedUrls";
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const { file_key, file_id, parts } = req.body;
  const { token_payload } = req.body;
  const { user_id = "", region = "" } = token_payload;

  try {
    // Find the project based on both orgId and projectId, region, owner
    await getProjectUtil(
      projectId,
      {
        _id: projectId,
        org_id: orgId,
        region: region,
        owner: user_id,
      },
      EXCLUDE_CONTENT_MAPPER
    );

    const result = await preSignedUrls(file_key, file_id, parts);

    return {
      status: HTTP_CODES.OK,
      data: { parts: result },
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFun,
        "Error while getting presined URLs",
        token_payload,
        error
      )
    );

    throw new S3Error();
  }
};

const finalizeUpload = async (req: Request) => {
  const srcFun = "finalizeUpload";
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const { file_key, file_id, parts } = req.body;
  const { token_payload } = req.body;
  const { user_id = "", region = "" } = token_payload;

  try {
    // Find the project based on both orgId and projectId, region, owner
    await getProjectUtil(
      projectId,
      {
        _id: projectId,
        org_id: orgId,
        region: region,
        owner: user_id,
      },
      EXCLUDE_CONTENT_MAPPER
    );

    await finalize(file_key, file_id, parts);

    return {
      status: HTTP_CODES.OK,
      data: {
        message: HTTP_TEXTS.UPLOAD_SUCCESS,
      },
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFun,
        "Error while finalizing upload",
        token_payload,
        error
      )
    );

    throw new S3Error();
  }
};

export const uploadsService = {
  initializeUpload,
  getPreSignedUrls,
  finalizeUpload,
};
