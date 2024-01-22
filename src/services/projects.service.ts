import { Request } from "express";
import ProjectModel from "../models/project";
import logger from "../utils/logger";
import { NotFoundError } from "../utils/custom-errors.utils";

const getAllProjects = async (req: Request) => {
  const orgId = req?.params?.orgId;
  //Add logic to get All Projects from DB
  return [orgId];
};
const getProject = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;

  // Find the project based on both orgId and projectId
  const project = await ProjectModel.findOne({ org_id: orgId, _id: projectId });

  if (!project) throw new NotFoundError("Project not found!");

  return {
    name: project?.name,
    description: project?.description,
    id: project?.id,
    status: project?.status,
    created_at: project?.createdAt,
    modified_at: project?.updatedAt,
  };
};
const createProject = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const { name, description } = req.body;
  logger.info(orgId);
  // const decodedToken = (req as any).decodedToken;
  // const { user_id = "1", region = "NA" } = decodedToken;
  const projectData = {
    region: "US",
    org_id: orgId,
    owner: "2",
    created_by: "2",
    name,
    description,
  };
  //Add logic to create Project from DB
  const project = await ProjectModel.create(projectData);

  //Add some logic to throw error
  return {
    status: "success",
    message: "Project created successfully",
    project: {
      name: project.name,
      id: project.id,
      status: project.status,
      created_at: project.createdAt,
      modified_at: project.updatedAt,
      // Add other properties as needed
    },
  };
};

const updateProject = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const updateData = req?.body;

  // Find the project based on both orgId and projectId
  const project = await ProjectModel.findOne({ org_id: orgId, _id: projectId });

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
      created_at: updatedProject.createdAt,
      modified_at: updatedProject.updatedAt,
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
