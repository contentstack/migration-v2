import { Request, Response } from "express";
import { userService } from "../services/user.service";
import { HTTP_CODES } from "../constants";

const getUserProfile = async (req: Request, res: Response) => {
  const user = await userService.getUserProfile(req);
  res.status(HTTP_CODES.OK).json(user);
};

export const userController = {
  getUserProfile,
};
