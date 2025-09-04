import { Request, Response } from "express";
import { authService } from "../services/auth.service.js";
import { HTTP_CODES } from "../constants/index.js";

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


/**
 * Handles the secure, server-to-server POST request from our Launch proxy.
 * This confirms to the proxy that the token was received.
 */
const saveOAuthToken = async (req: Request, res: Response) => {
  await authService.saveOAuthToken(req);
  res.status(HTTP_CODES.OK).json({ message: "Token received successfully." });
};

export const authController = {
  login,
  RequestSms,
  saveOAuthToken,
};
