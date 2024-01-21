import { Request, Response } from "express";
import { authService } from "../services/auth.service";

const login = async (req: Request, res: Response) => {
  const resp = await authService.login(req);
  res.status(resp?.status).json(resp?.data);
};

const RequestSms = async (req: Request, res: Response) => {
  const resp = await authService.requestSms(req);
  res.status(resp.status).json(resp.data);
};

export const authController = {
  login,
  RequestSms,
};
