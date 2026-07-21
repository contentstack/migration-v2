import { Request, Response } from "express";
import { userService } from "../services/user.service.js";

/**
 * Retrieves the user profile.
 *
 * @param {Request} req - The request object.
 * @param {Response} res - The response object.
 * @returns {Promise<void>} - A promise that resolves when the user profile is retrieved.
 */
const getUserProfile = async (req: Request, res: Response) => {
  const resp = await userService.getUserProfile(req);
  res.status(resp?.status).json(resp?.data);
};

/** Returns the persisted regional source-login session, if any. */
const getSourceSession = async (req: Request, res: Response) => {
  const resp = await userService.getSourceSession(req);
  res.status(resp?.status).json(resp?.data);
};

/** Persists the regional source-login session on the current user's record. */
const setSourceSession = async (req: Request, res: Response) => {
  const resp = await userService.setSourceSession(req);
  res.status(resp?.status).json(resp?.data);
};

/** Clears the persisted regional source-login session for the current user. */
const clearSourceSession = async (req: Request, res: Response) => {
  const resp = await userService.clearSourceSession(req);
  res.status(resp?.status).json(resp?.data);
};

export const userController = {
  getUserProfile,
  getSourceSession,
  setSourceSession,
  clearSourceSession,
};
