import { Request, Response } from "express";
import { migrationService } from "../services/migration.service.js"

/**
 * Creates a test stack.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A promise that resolves to void.
 */
const createTestStack = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.createTestStack(req);
  res.status(resp?.status).json(resp);
};
const getAuditData = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.getAuditData(req);
  res.status(resp?.status).json(resp);
};

const exportSourceStack = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.exportSourceStack(req);
  res.status(resp?.status).json(resp);
};

const validateSourceExport = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.validateSourceExport(req);
  res.status(resp?.status).json(resp);
};

const runSourceAudit = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.runSourceAudit(req);
  res.status(resp?.status).json(resp);
};

const getSourceAuditSummary = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.getSourceAuditSummary(req);
  res.status(resp?.status).json(resp);
};
/**
 * Start Test Migartion.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A Promise that resolves when the stack is deleted.
 */
const startTestMigration = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.startTestMigration(req);
  res.status(resp?.status ?? 200).json(resp);
};


/*
 * Start Final Migartion.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A Promise that resolves when the stack is deleted.
 */
const startMigration = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.startMigration(req);
  res.status(resp?.status ?? 200).json(resp);
};

/**
 * Deletes the test stack.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A Promise that resolves when the stack is deleted.
 */
const deleteTestStack = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.deleteTestStack(req);
  res.status(200).json(resp);
};

const getLogs = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.getLogs(req);
  res.status(200).json(resp);
};

const saveLocales = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.createSourceLocales(req)
  res.status(200).json(resp);
}

const saveMappedLocales = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.updateLocaleMapper(req);
  res.status(200).json(resp);
}

const restartMigration = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.restartMigration(req);
  res.status(resp?.status).json(resp);
}

export const migrationController = {
  createTestStack,
  exportSourceStack,
  validateSourceExport,
  runSourceAudit,
  getSourceAuditSummary,
  deleteTestStack,
  startTestMigration,
  startMigration,
  getLogs,
  saveLocales,
  saveMappedLocales,
  getAuditData,
  restartMigration
};
