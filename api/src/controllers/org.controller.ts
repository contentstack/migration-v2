import { Request, Response } from "express";
import { orgService } from "../services/org.service.js";

/**
 * Retrieves all stacks.
 * 
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the operation is complete.
 */
const getAllStacks = async (req: Request, res: Response) => {
  const resp = await orgService.getAllStacks(req);
  res.status(resp?.status).json(resp?.data);
};

/**
 * Creates a stack.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the stack is created.
 */
const createStack = async (req: Request, res: Response) => {
  const resp = await orgService.createStack(req);
  res.status(resp.status).json(resp.data);
};

/**
 * Retrieves the locales for an organization.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the locales are retrieved.
 */
const getLocales = async (req: Request, res: Response) => {
  const resp = await orgService.getLocales(req);
  res.status(resp.status).json(resp.data);
};

/**
 * Retrieves the stack status.
 *
 * @param req - The request object.
 * @param res - The response object.
 * @returns A Promise that resolves to the stack status response.
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
