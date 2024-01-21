import { Request, Response } from "express";
import { userService } from "../services/user.service";
import { constants } from "../constants";

const getUserProfile = async (req: Request, res: Response) => {
  const user = await userService.getUserProfile(req);
  res.status(constants.HTTP_CODES.OK).json(user);
};

export const userController = {
  getUserProfile,
};
