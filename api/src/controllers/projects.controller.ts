import { Request, Response } from "express";
import fs from "node:fs";
import { ZipArchive } from "archiver";
import { projectService } from "../services/projects.service.js";
import { HTTP_TEXTS } from "../constants/index.js";

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
 * Exports a project as a zip archive containing the project record and its
 * on-disk database folder (content type mappers, field mappers, etc.).
 *
 * The archive is structured as:
 *   <projectId>/project.json        -> the project record
 *   <projectId>/<iteration>/*.json  -> the mapper stores, mirrored as stored
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A Promise that resolves to void.
 */
const exportProject = async (req: Request, res: Response): Promise<void> => {
  const { project, databasePath } = await projectService.exportProject(req);
  const projectId = project?.id;

  res.setHeader("Content-Type", "application/zip");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${projectId}.zip"`
  );

  const archive = new ZipArchive({ zlib: { level: 9 } });

  // If archiving fails after streaming has begun we can no longer change the
  // status code, so just tear the connection down.
  archive.on("error", (err: Error) => {
    res.destroy(err);
  });

  archive.pipe(res);

  // The project record itself.
  archive.append(JSON.stringify(project, null, 2), {
    name: `${projectId}/project.json`,
  });

  // The mapper stores, mirrored under the same folder. The folder may not
  // exist yet if no mapping has been done — that's fine, we still export the
  // project record on its own.
  if (fs.existsSync(databasePath)) {
    archive.directory(databasePath, projectId);
  }

  await archive.finalize();
};

/**
 * Imports a project from an uploaded zip archive and returns the newly
 * created project.
 *
 * @param req - The request object (expects a multipart `file` field).
 * @param res - The response object.
 * @returns A Promise that resolves to void.
 */
const importProject = async (req: Request, res: Response): Promise<void> => {
  const result = await projectService.importProject(req);
  res.status(201).json(result);
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

const updateSourceConfig = async (req: Request, res: Response) => {
  const resp = await projectService.updateSourceConfig(req);
  res.status(resp?.status).json(resp?.data);
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

const updateMigrationExecution = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.updateMigrationExecution(req);
  res.status(project.status).json(project);
}

const getMigratedStacks = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.getMigratedStacks(req);
  res.status(project.status).json(project);
}

/**
 * Updates audit report selections for a project
 */
const updateAuditSelections = async (req: Request, res: Response): Promise<void> => {
  const project = await projectService.updateAuditSelections(req);
  res.status(200).json({ data: project, message: HTTP_TEXTS.AUDIT_SELECTIONS_UPDATED });
};

export const projectController = {
  getAllProjects,
  getProject,
  exportProject,
  importProject,
  createProject,
  updateProject,
  updateLegacyCMS,
  updateAffix,
  affixConfirmation,
  updateFileFormat,
  updateSourceConfig,
  fileformatConfirmation,
  updateDestinationStack,
  updateCurrentStep,
  deleteProject,
  revertProject,
  updateStackDetails,
  updateMigrationExecution,
  getMigratedStacks,
  updateAuditSelections,
};
