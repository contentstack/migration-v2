import { Request } from "express";

const getAllProjects = async (req: Request) => {
  const orgId = req?.params?.orgId;
  //Add logic to get All Projects from DB
  return [orgId];
};
const getProject = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;

  //Add logic to get Project from DB
  return { orgId, projectId };
};
const createProject = async (req: Request) => {
  const orgId = req?.params?.orgId;

  //Add logic to create Project from DB
  return { orgId };
};

const updateProject = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;

  //Add logic to update Project from DB
  return { orgId, projectId };
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
