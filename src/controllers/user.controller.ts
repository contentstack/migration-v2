import { Request, Response } from "express";
import { userService } from "../services/user.service.js";

const getUserProfile = async (req: Request, res: Response) => {
  const resp = await userService.getUserProfile(req);
  res.status(resp?.status).json(resp?.data);
};

export const userController = {
  getUserProfile,
};
