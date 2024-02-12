import { Request } from "express";
import ProjectModel from "../models/project";
import { BadRequestError, NotFoundError } from "../utils/custom-errors.utils";
import {
  EXCLUDE_CONTENT_MAPPER,
  PROJECT_UNSELECTED_FIELDS,
  HTTP_TEXTS,
  HTTP_CODES,
} from "../constants";
import { config } from "../config";
import { safePromise } from "../utils";
import getAuthtoken from "../utils/auth.utils";
import https from "../utils/https.utils";
import getProjectUtil from "../utils/get-project.utils";

const getAllProjects = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const decodedToken = req.body.token_payload;
  const { user_id = "", region = "" } = decodedToken;

  const project = await ProjectModel.find({
    org_id: orgId,
    region,
    owner: user_id,
  }).select(PROJECT_UNSELECTED_FIELDS);

  if (!project) throw new NotFoundError(HTTP_TEXTS.PROJECT_NOT_FOUND);

  return project;
};

const getProject = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const decodedToken = req.body.token_payload;
  const { user_id = "", region = "" } = decodedToken;
  // Find the project based on both orgId and projectId, region, owner
  const project = await getProjectUtil(
    projectId,
    {
      _id: projectId,
      org_id: orgId,
      region: region,
      owner: user_id,
    },
    EXCLUDE_CONTENT_MAPPER
  );

  return project;
};

const createProject = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const { name, description } = req.body;
  const decodedToken = req.body.token_payload;
  const { user_id = "", region = "" } = decodedToken;
  const projectData = {
    region,
    org_id: orgId,
    owner: user_id,
    created_by: user_id,
    name,
    description,
  };
  //Add logic to create Project from DB
  const project = await ProjectModel.create(projectData);

  if (!project) throw new NotFoundError(HTTP_TEXTS.PROJECT_NOT_FOUND);
  return {
    status: "success",
    message: "Project created successfully",
    project: {
      name: project.name,
      id: project.id,
      status: project.status,
      created_at: project.created_at,
      modified_at: project.updated_at,
      // Add other properties as needed
    },
  };
};

const updateProject = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const updateData = req?.body;
  const decodedToken = req.body.token_payload;
  const { user_id = "", region = "" } = decodedToken;

  // Find the project based on both orgId and projectId
  const project = await getProjectUtil(
    projectId,
    {
      _id: projectId,
      org_id: orgId,
      region: region,
      owner: user_id,
    },
    EXCLUDE_CONTENT_MAPPER
  );

  // Update the project fields
  project.name = updateData?.name || project.name;
  project.description = updateData?.description || project.description;
  project.updated_by = user_id;

  // Save the updated project
  const updatedProject = await project.save();

  return {
    status: "success",
    message: "Project updated successfully",
    project: {
      name: updatedProject?.name,
      description: updatedProject?.description,
      id: updatedProject?.id,
      status: updatedProject?.status,
      created_at: updatedProject?.created_at,
      modified_at: updatedProject?.updated_at,
      // Add other properties as needed
    },
  };
};

const updateLegacyCMS = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const { token_payload, legacy_cms } = req.body;

  const project = await getProjectUtil(
    projectId,
    {
      _id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    EXCLUDE_CONTENT_MAPPER
  );

  project.legacy_cms.cms = legacy_cms;

  await project.save();

  return {
    status: HTTP_CODES.OK,
    data: {
      message: HTTP_TEXTS.CMS_UPDATED,
    },
  };
};

const updateFileFormat = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const { token_payload, file_format } = req.body;

  const project = await getProjectUtil(
    projectId,
    {
      _id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    EXCLUDE_CONTENT_MAPPER
  );

  project.legacy_cms.file_format = file_format;

  await project.save();

  return {
    status: HTTP_CODES.OK,
    data: {
      message: HTTP_TEXTS.FILE_FORMAT_UPDATED,
    },
  };
};

const updateDestinationStack = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const { token_payload, stack_api_key } = req.body;

  const project = await getProjectUtil(
    projectId,
    {
      _id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    EXCLUDE_CONTENT_MAPPER
  );

  const authtoken = await getAuthtoken(
    token_payload?.region,
    token_payload?.user_id
  );

  const [err, res] = await safePromise(
    https({
      method: "GET",
      url: `${config.CS_API[
        token_payload?.region as keyof typeof config.CS_API
      ]!}/stacks`,
      headers: {
        organization_uid: orgId,
        authtoken,
      },
    })
  );

  if (err)
    return {
      data: {
        message: HTTP_TEXTS.DESTINATION_STACK_ERROR,
      },
      status: err.response.status,
    };

  if (!res.data.stacks.find((stack: any) => stack.api_key === stack_api_key))
    throw new BadRequestError(HTTP_TEXTS.DESTINATION_STACK_NOT_FOUND);

  project.destination_stack_id = stack_api_key;
  // project.migration.modules.destination_cms.org_id = orgId;

  await project.save();

  return {
    status: HTTP_CODES.OK,
    data: {
      message: HTTP_TEXTS.DESTINATION_STACK_UPDATED,
    },
  };
};

const deleteProject = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;

  //Add logic to delete Project from DB
  return { orgId, projectId };
};

export const projectService = {
  getAllProjects,
  getProject,
  createProject,
  updateProject,
  updateLegacyCMS,
  updateFileFormat,
  updateDestinationStack,
  deleteProject,
};
