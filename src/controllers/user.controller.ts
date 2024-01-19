import { Request, Response } from "express";
import { userService } from "../services/user.service";

const getUserProfile = async (req: Request, res: Response) => {
  const user = await userService.getUserProfile(req);
  res.status(200).json(user);
};

export const userController = {
  getUserProfile,
};
