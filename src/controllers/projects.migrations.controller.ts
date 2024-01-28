import { Request, Response } from "express";
import { migrationService } from "../services/projects.migrations.service";

const getMigration = async (req: Request, res: Response) => {
  const resp = await migrationService.getMigration(req);
  res.status(resp.status).json(resp.data);
};
const createMigration = async (req: Request, res: Response) => {
  const resp = await migrationService.createMigration(req);
  res.status(resp.status).json(resp.data);
};

const updateMigration = async (req: Request, res: Response) => {
  const resp = await migrationService.updateMigration(req);
  res.status(resp.status).json(resp.data);
};

const deleteMigration = async (req: Request, res: Response) => {
  const resp = await migrationService.deleteMigration(req);
  res.status(resp.status).json(resp.data);
};

export const migrationController = {
  getMigration,
  createMigration,
  updateMigration,
  deleteMigration,
};
