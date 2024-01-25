import { Request, Response } from "express";
import { orgService } from "../services/org.service";

const getAllStacks = async (req: Request, res: Response) => {
  const resp = await orgService.getAllStacks(req);
  res.status(resp?.status).json(resp?.data);
};

const createStack = async (req: Request, res: Response) => {
  const resp = await orgService.getAllStacks(req);
  res.status(resp.status).json(resp.data);
};

const getLocales = async (req: Request, res: Response) => {
  const resp = await orgService.getAllStacks(req);
  res.status(resp.status).json(resp.data);
};

export const orgController = {
  getAllStacks,
  createStack,
  getLocales,
};
