import { Request, Response } from "express";
import { projectService } from "../services/projects.service";

const getAllProjects = async (req: Request, res: Response): Promise<void> => {
  const allProjects = await projectService.getAllProjects(req);
  res.status(200).json(allProjects);
};

const getProject = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.getProject(req);
  res.status(200).json(project);
};
const getProjectAllDetails = async (
  req: Request,
  res: Response
): Promise<void> => {
  const project = await projectService.getProjectAllDetails(req);
  res.status(200).json(project);
};
const createProject = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.createProject(req);
  res.status(201).json(project);
};

const updateProject = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.updateProject(req);
  res.status(200).json(project);
};
const updateLegacyCMS = async (req: Request, res: Response) => {
  const resp = await projectService.updateLegacyCMS(req);
  res.status(resp.status).json(resp.data);
};

const updateAffix = async (req: Request, res: Response) => {
  const resp = await projectService.updateAffix(req);
  res.status(resp.status).json(resp.data);
};

const updateFileFormat = async (req: Request, res: Response) => {
  const resp = await projectService.updateFileFormat(req);
  res.status(resp.status).json(resp.data);
};

const updateDestinationStack = async (req: Request, res: Response) => {
  const resp = await projectService.updateDestinationStack(req);
  res.status(resp.status).json(resp.data);
};
const updateCurrentStep = async (req: Request, res: Response) => {
  const project = await projectService.updateCurrentStep(req);
  res.status(200).json(project);
};

const deleteProject = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.deleteProject(req);
  res.status(200).json(project);
};

export const projectController = {
  getAllProjects,
  getProject,
  getProjectAllDetails,
  createProject,
  updateProject,
  updateLegacyCMS,
  updateAffix,
  updateFileFormat,
  updateDestinationStack,
  updateCurrentStep,
  deleteProject,
};
