import { Request, Response } from "express";
import { authService } from "../services/auth.service.js";

/**
 * Handles the login request.
 *
 * @param req - The request object.
 * @param res - The response object.
 */
const login = async (req: Request, res: Response) => {
  const resp = await authService.login(req);
  res.status(resp?.status).json(resp?.data);
};

/**
 * Handles the request for sending an SMS.
 *
 * @param req - The request object.
 * @param res - The response object.
 */
const RequestSms = async (req: Request, res: Response) => {
  const resp = await authService.requestSms(req);
  res.status(resp.status).json(resp.data);
};

export const authController = {
  login,
  RequestSms,
};
