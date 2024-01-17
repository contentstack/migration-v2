import { Request, Response } from "express";
import { migrationService } from "../services/projects.migrations.service";

const getMigration = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.getMigration(req);
  res.status(200).json(resp);
};
const createMigration = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.createMigration(req);
  res.status(201).json(resp);
};

const updateMigration = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.updateMigration(req);
  res.status(200).json(resp);
};

const deleteMigration = async (req: Request, res: Response): Promise<void> => {
  const resp = await migrationService.deleteMigration(req);
  res.status(200).json(resp);
};

export const migrationController = {
  getMigration,
  createMigration,
  updateMigration,
  deleteMigration,
};
