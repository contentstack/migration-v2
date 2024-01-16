import { Request, Response } from "express";
import { migrationService } from "../services/projects.migrations.service";

const getMigration = async (req: Request, res: Response): Promise<void> => {
  try {
    const resp = await migrationService.getMigration(req);
    res.status(200).json(resp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
const createMigration = async (req: Request, res: Response): Promise<void> => {
  try {
    const resp = await migrationService.createMigration(req);
    res.status(201).json(resp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const updateMigration = async (req: Request, res: Response): Promise<void> => {
  try {
    const resp = await migrationService.updateMigration(req);
    res.status(200).json(resp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

const deleteMigration = async (req: Request, res: Response): Promise<void> => {
  try {
    const resp = await migrationService.deleteMigration(req);
    res.status(200).json(resp);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const migrationController = {
  getMigration,
  createMigration,
  updateMigration,
  deleteMigration,
};
