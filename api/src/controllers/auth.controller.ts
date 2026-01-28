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
 * Generates the OAuth token and saves it to the database.
 * @param req - The request object. Sends the code and region.
 * @param res - The response object. Sends the message "Token received successfully."
 */
const saveOAuthToken = async (req: Request, res: Response) => {
  await authService.saveOAuthToken(req);
  res.status(HTTP_CODES.OK).json({ message: "Token received successfully." });
};


/**
 * Handles the request for getting the app configuration.
 *
 * @param req - The request object.
 * @param res - The response object.
 */
export const getAppConfigHandler = async (req: Request, res: Response): Promise<void> => {
  try {
    const appConfig = await authService.getAppData();
    res.status(200).json(appConfig);

  } catch (error: any) {
    console.error('Error in getAppConfig controller:', error);

    if (error?.message?.includes('app.json file not found')) {
      res.status(404).json({
        error: 'SSO configuration not found',
        message: 'app.json file does not exist'
      });
      return;
    }

    if (error?.message?.includes('Invalid JSON format')) {
      res.status(400).json({
        error: 'Invalid SSO configuration',
        message: 'app.json contains invalid JSON'
      });
      return;
    }

    res.status(500).json({
      error: 'Server error',
      message: 'Unable to read SSO configuration'
    });
  }
};

/**
 * Handles the request for checking the SSO authentication status.
 *
 * @param req - The request object.
 * @param res - The response object.
 */
export const getSSOAuthStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { userId } = req.params;

    if (!userId) {
      res.status(400).json({
        error: 'Missing user ID',
        message: 'User ID parameter is required',
      });
      return;
    }

    const authStatus = await authService.checkSSOAuthStatus(userId);

    res.status(200).json(authStatus);

  } catch (error: any) {
    console.error('Error in getSSOAuthStatus controller:', error);

    res.status(500).json({
      error: 'Server error',
      message: 'Unable to check SSO authentication status',
    });
  }
};


/**
 * Handles the request for logging out a user.
 * @param req - The request object.
 * @param res - The response object.
 */
const logout = async (req: Request, res: Response) => {
  const resp = await authService.logout(req);
  res.status(resp?.status).json(resp?.data);
};

export const authController = {
  login,
  RequestSms,
  saveOAuthToken,
  getAppConfigHandler,
  getSSOAuthStatus,
  logout
};
