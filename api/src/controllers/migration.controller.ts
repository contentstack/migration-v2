import { Request, Response } from "express";
import { migrationService } from "../services/migration.service.js";

/**
 * Creates a test stack.
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
const createTestStack = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.createTestStack(req);
  res.status(200).json(resp);
};

/**
 * Deletes a test stack.
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
const deleteTestStack = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.deleteTestStack(req);
  res.status(200).json(resp);
};

export const migrationController = {
  createTestStack,
  deleteTestStack,
};
