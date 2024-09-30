import { Request, Response } from "express";
import { migrationService } from "../services/migration.service.js";

/**
 * Creates a test stack.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A promise that resolves to void.
 */
const createTestStack = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.createTestStack(req);
  res.status(200).json(resp);
};

/**
 * Deletes the test stack.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A Promise that resolves when the stack is deleted.
 */
const fieldMapping = async (req: Request, res: Response): Promise<void> => {
  const resp = migrationService.fieldMapping(req);
  res.status(200).json(resp);
};

const deleteTestStack = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.deleteTestStack(req);
  res.status(200).json(resp);
};

export const migrationController = {
  createTestStack,
  deleteTestStack,
  fieldMapping,
};
