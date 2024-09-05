import { Request, Response } from "express";
import { projectService } from "../services/projects.service.js";

/**
 * Retrieves all projects.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A promise that resolves to void.
 */
const getAllProjects = async (req: Request, res: Response): Promise<void> => {
  const allProjects = await projectService.getAllProjects(req);
  res.status(200).json(allProjects);
};

/**
 * Retrieves a project based on the request.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A Promise that resolves to void.
 */
const getProject = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.getProject(req);
  res.status(200).json(project);
};

/**
 * Creates a new project.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A Promise that resolves to void.
 */
const createProject = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.createProject(req);
  res.status(201).json(project);
};

/**
 * Updates a project.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A Promise that resolves to void.
 */
const updateProject = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.updateProject(req);
  res.status(200).json(project);
};
/**
 * Updates the legacy CMS for a project.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the update is complete.
 */
const updateLegacyCMS = async (req: Request, res: Response) => {
  const resp = await projectService.updateLegacyCMS(req);
  res.status(resp.status).json(resp.data);
};

/**
 * Updates the affix for a project.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the affix is updated.
 */
const updateAffix = async (req: Request, res: Response) => {
  const resp = await projectService.updateAffix(req);
  res.status(resp.status).json(resp.data);
};

/**
 * Handles the affix confirmation request.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A Promise that resolves to the response data.
 */
const affixConfirmation = async (req: Request, res: Response) => {
  const resp = await projectService.affixConfirmation(req);
  res.status(resp.status).json(resp.data);
};

/**
 * Updates the file format for a project.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the file format is updated.
 */
const updateFileFormat = async (req: Request, res: Response) => {
  const resp = await projectService.updateFileFormat(req);
  res.status(resp.status).json(resp.data);
};

/**
 * Handles the file format confirmation request.
 *
 * @param req - The request object.
 * @param res - The response object.
 */
const fileformatConfirmation = async (req: Request, res: Response) => {
  const resp = await projectService.fileformatConfirmation(req);
  res.status(resp.status).json(resp.data);
};

/**
 * Updates the destination stack for a project.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the destination stack is updated.
 */
const updateDestinationStack = async (req: Request, res: Response) => {
  const resp = await projectService.updateDestinationStack(req);
  res.status(resp.status).json(resp.data);
};
/**
 * Updates the current step of a project.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A promise that resolves with the updated project.
 */
const updateCurrentStep = async (req: Request, res: Response) => {
  const project = await projectService.updateCurrentStep(req);
  res.status(200).json(project);
};

/**
 * Deletes a project.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A Promise that resolves to void.
 */
const deleteProject = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.deleteProject(req);
  res.status(200).json(project);
};

/**
 * Reverts a project.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A Promise that resolves to void.
 */
const revertProject = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.revertProject(req);
  res.status(project.status).json(project);
};

/**
 * update stack details a project.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A Promise that resolves to void.
 */
const updateStackDetails = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.updateStackDetails(req);
  res.status(project.status).json(project);
}


export const projectController = {
  getAllProjects,
  getProject,
  createProject,
  updateProject,
  updateLegacyCMS,
  updateAffix,
  affixConfirmation,
  updateFileFormat,
  fileformatConfirmation,
  updateDestinationStack,
  updateCurrentStep,
  deleteProject,
  revertProject,
  updateStackDetails
};
