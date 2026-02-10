import { Request, Response } from "express";
import { authService } from "../services/auth.service.js";

/**
 * Handles the login request.
 *
 * @param req - The request object.
 * @param res - The response object.
 */
const login = async (req: Request, res: Response) => {
  try {
    const resp = await authService.login(req);
    res.status(resp?.status || 500).json(resp?.data);
  } catch (error: any) {
    const statusCode = error?.statusCode || error?.status || 500;
    res.status(statusCode).json({
      message: error?.message || 'Login failed',
    });
  }
};

/**
 * Handles the request for sending an SMS.
 *
 * @param req - The request object.
 * @param res - The response object.
 */
const RequestSms = async (req: Request, res: Response) => {
  try {
    const resp = await authService.requestSms(req);
    res.status(resp?.status || 500).json(resp?.data);
  } catch (error: any) {
    const statusCode = error?.statusCode || error?.status || 500;
    res.status(statusCode).json({
      message: error?.message || 'SMS request failed',
    });
  }
};

export const authController = {
  login,
  RequestSms,
};
