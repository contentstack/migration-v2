import { Request } from "express";
import { EXCLUDE_CONTENT_MAPPER, HTTP_TEXTS, HTTP_CODES } from "../constants";
import { initialize, preSignedUrls, finalize } from "../utils/s3-uploads.utils";
import getProjectUtil from "../utils/get-project.utils";

const initializeUpload = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const fileName = req.body.file_name;
  const { user_id = "", region = "" } = req.body.token_payload;

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

  const result = await initialize(region, orgId, user_id, projectId, fileName);

  return {
    status: HTTP_CODES.OK,
    data: {
      file_id: result.UploadId,
      file_key: result.Key,
    },
  };
};

const getPreSignedUrls = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const { file_key, file_id, parts } = req.body;
  const { user_id = "", region = "" } = req.body.token_payload;

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
};

const finalizeUpload = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const { file_key, file_id, parts } = req.body;
  const { user_id = "", region = "" } = req.body.token_payload;

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
};

export const uploadsService = {
  initializeUpload,
  getPreSignedUrls,
  finalizeUpload,
};
