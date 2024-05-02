import { Request, Response } from "express";
import { migrationService } from "../services/migration.service.js";

const createTestStack = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.createTestStack(req);
  res.status(200).json(resp);
};

const deleteTestStack = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.deleteTestStack(req);
  res.status(200).json(resp);
};

export const migrationController = {
  createTestStack,
  deleteTestStack,
};
