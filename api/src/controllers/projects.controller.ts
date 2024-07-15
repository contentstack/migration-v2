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
 * Retrieves a project.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A promise that resolves to void.
 */
const getProject = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.getProject(req);
  res.status(200).json(project);
};

/**
 * Creates a project.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A promise that resolves to void.
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
 * @returns A promise that resolves to void.
 */
const updateProject = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.updateProject(req);
  res.status(200).json(project);
};

/**
 * Updates a legacy CMS.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A promise that resolves to void.
 */
const updateLegacyCMS = async (req: Request, res: Response) => {
  const resp = await projectService.updateLegacyCMS(req);
  res.status(resp.status).json(resp.data);
};

/**
 * Updates an affix.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A promise that resolves to void.
 */
const updateAffix = async (req: Request, res: Response) => {
  const resp = await projectService.updateAffix(req);
  res.status(resp.status).json(resp.data);
};

/**
 * Affix confirmation.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A promise that resolves to void.
 */
const affixConfirmation = async (req: Request, res: Response) => {
  const resp = await projectService.affixConfirmation(req);
  res.status(resp.status).json(resp.data);
};

/**
 * Updates a file format.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A promise that resolves to void.
 */
const updateFileFormat = async (req: Request, res: Response) => {
  const resp = await projectService.updateFileFormat(req);
  res.status(resp.status).json(resp.data);
};

/**
 * File format confirmation.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A promise that resolves to void.
 */
const fileformatConfirmation = async (req: Request, res: Response) => {
  const resp = await projectService.fileformatConfirmation(req);
  res.status(resp.status).json(resp.data);
};

/**
 * Updates a destination stack.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A promise that resolves to void.
 */
const updateDestinationStack = async (req: Request, res: Response) => {
  const resp = await projectService.updateDestinationStack(req);
  res.status(resp.status).json(resp.data);
};

/**
 * Updates the current step of a project.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A promise that resolves to void.
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
 * @returns A promise that resolves to void.
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
 * @returns A promise that resolves to void.
 */
const revertProject = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.revertProject(req);
  res.status(project.status).json(project);
};

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
};
