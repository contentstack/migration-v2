import { Request } from "express";

const service = () => {
  const getAllProjects = async (req: Request) => {
    const orgId = req?.params?.orgId;
    //Add logic to get All Projects from DB
    return [];
  };
  const getProject = async (req: Request) => {
    const orgId = req?.params?.orgId;
    const id = req?.params?.id;
    //Add logic to get Project from DB
    return { orgId, id };
  };
  const createProject = async (req: Request) => {
    const orgId = req?.params?.orgId;
    //Add logic to create Project from DB
    return { orgId };
  };

  const deleteProject = async (req: Request) => {
    const orgId = req?.params?.orgId;
    const id = req?.params?.id;
    //Add logic to delete Project from DB
    return {};
  };
  const updateProject = async (req: Request) => {
    const orgId = req?.params?.orgId;
    const id = req?.params?.id;
    //Add logic to update Project from DB
    return { orgId };
  };
  return {
    getAllProjects,
    getProject,
    createProject,
    deleteProject,
    updateProject,
  };
};

export const projectService = service();
