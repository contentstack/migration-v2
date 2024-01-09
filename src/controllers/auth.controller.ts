import { NextFunction, Request, Response } from "express";
import { userService } from "../services/auth.service";
const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resp = await userService.login(req);
    res.status(resp?.status).json(resp?.data);
  } catch (error) {
    console.error(error);
    next(error);
  }
};
const getUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = await userService.getUserProfile(req);
    res.status(200).json(user);
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const authController = {
  login,
  getUserProfile,
};
