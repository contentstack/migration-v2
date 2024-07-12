import { Request, Response } from "express";
import { orgService } from "../services/org.service.js";

/**
 * Get all stacks
 * @param req - Express request object
 * @param res - Express response object
 */
const getAllStacks = async (req: Request, res: Response) => {
  const resp = await orgService.getAllStacks(req);
  res.status(resp?.status).json(resp?.data);
};

/**
 * Create a new stack
 * @param req - Express request object
 * @param res - Express response object
 */
const createStack = async (req: Request, res: Response) => {
  const resp = await orgService.createStack(req);
  res.status(resp.status).json(resp.data);
};

/**
 * Get all locales
 * @param req - Express request object
 * @param res - Express response object
 */
const getLocales = async (req: Request, res: Response) => {
  const resp = await orgService.getLocales(req);
  res.status(resp.status).json(resp.data);
};

/**
 * Get stack status
 * @param req - Express request object
 * @param res - Express response object
 */
const getStackStatus = async (req: Request, res: Response) => {
  const resp = await orgService.getStackStatus(req);
  res.status(resp.status).json(resp.data);
};

export const orgController = {
  getAllStacks,
  createStack,
  getLocales,
  getStackStatus,
};
