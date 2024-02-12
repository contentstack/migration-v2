import { Request } from "express";
import ProjectModel from "../models/project";
import { BadRequestError, NotFoundError } from "../utils/custom-errors.utils";
import { EXCLUDE_CONTENT_MAPPER, HTTP_TEXTS, HTTP_CODES } from "../constants";
import { MigrationQueryType } from "../models/types";
import { isValidObjectId } from "../utils";
import { initialize, preSignedUrls, finalize } from "../utils/s3-uploads.utils";

const _getProject = async (projectId: string, query: MigrationQueryType) => {
  if (!isValidObjectId(projectId))
    throw new BadRequestError(HTTP_TEXTS.INVALID_ID.replace("$", "project"));

  const project = await ProjectModel.findOne(query).select(
    EXCLUDE_CONTENT_MAPPER
  );

  if (!project) throw new NotFoundError(HTTP_TEXTS.NO_PROJECT);

  return project;
};

const initializeUpload = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const FileName = req.body.file_name;
  const { user_id = "", region = "" } = req.body.token_payload;

  // Find the project based on both orgId and projectId, region, owner
  await _getProject(projectId, {
    _id: projectId,
    org_id: orgId,
    region: region,
    owner: user_id,
  });

  const result = await initialize(region, orgId, user_id, projectId, FileName);

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
  await _getProject(projectId, {
    _id: projectId,
    org_id: orgId,
    region: region,
    owner: user_id,
  });

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
  await _getProject(projectId, {
    _id: projectId,
    org_id: orgId,
    region: region,
    owner: user_id,
  });

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
