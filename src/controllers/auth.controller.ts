import { Request, Response } from "express";
import { userService } from "../services/auth.service";

const login = async (req: Request, res: Response) => {
  const resp = await userService.login(req);
  res.status(resp?.status).json(resp?.data);
};

const RequestSms = async (req: Request, res: Response) => {
  const resp = await userService.requestSms(req);
  res.status(resp.status).json(resp.data);
};

const getUserProfile = async (req: Request, res: Response) => {
  const user = await userService.getUserProfile(req);
  res.status(200).json(user);
};

export const authController = {
  login,
  RequestSms,
  getUserProfile,
};
