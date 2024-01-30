import { Request } from "express";
import ProjectModel from "../models/project";
import { NotFoundError } from "../utils/custom-errors.utils";
import { constants } from "../constants";

const getAllProjects = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const project = await ProjectModel.find({
    org_id: orgId,
  });
  if (!project) throw new NotFoundError(constants.HTTP_TEXTS.PROJECT_NOT_FOUND);
  return project;
};
const getProject = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const decodedToken = req.body.token_payload;
  const { user_id = "", region = "" } = decodedToken;
  // Find the project based on both orgId and projectId, region, owner
  const project = await ProjectModel.findOne({
    org_id: orgId,
    _id: projectId,
    region,
    owner: user_id,
  });

  if (!project) throw new NotFoundError(constants.HTTP_TEXTS.PROJECT_NOT_FOUND);

  return {
    name: project?.name,
    description: project?.description,
    id: project?.id,
    status: project?.status,
    created_at: project?.created_at,
    modified_at: project?.updated_at,
  };
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

  if (!project) throw new NotFoundError(constants.HTTP_TEXTS.PROJECT_NOT_FOUND);
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
  const project = await ProjectModel.findOne({
    org_id: orgId,
    _id: projectId,
    region,
    owner: user_id,
  });

  if (!project) throw new NotFoundError("Project not found!");

  // Update the project fields
  project.name = updateData.name || project.name;
  project.description = updateData.description || project.description;

  // Save the updated project
  const updatedProject = await project.save();

  return {
    status: "success",
    message: "Project updated successfully",
    project: {
      name: updatedProject.name,
      id: updatedProject.id,
      status: updatedProject.status,
      created_at: updatedProject.created_at,
      modified_at: updatedProject.updated_at,
      // Add other properties as needed
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
  deleteProject,
};
