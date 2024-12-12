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

export const userController = {
  getUserProfile,
};
