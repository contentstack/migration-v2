import { Request, Response } from "express";
import { authService } from "../services/auth.service.js";
import { HTTP_CODES } from "../constants/index.js";
import {
  buildOAuthErrorPage,
  buildOAuthSuccessPage,
} from "../utils/oauth-callback-html.utils.js";

/** Public URL of the Migration Tool UI (Vite default :3000). Override with MIGRATION_UI_ORIGIN in env. */
const migrationUiOrigin = (): string => {
  const raw = process.env.MIGRATION_UI_ORIGIN?.trim();
  if (raw) return raw.replace(/\/$/, "");
  return "http://localhost:3000";
};

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


/**
 * Generates the OAuth token and saves it to the database.
 * @param req - The request object. Sends the code and region.
 * @param res - Renders an HTML success page (browser OAuth redirect) or HTML error page on failure.
 */
const saveOAuthToken = async (req: Request, res: Response) => {
  const dashboardUrl = `${migrationUiOrigin()}/projects`;

  try {
    await authService.saveOAuthToken(req);

    const html = buildOAuthSuccessPage({ dashboardUrl });
    res.status(HTTP_CODES.OK).type("html").send(html);
  } catch (error: any) {
    const statusCode =
      typeof error?.statusCode === "number" ? error.statusCode : HTTP_CODES.SERVER_ERROR;
    const message =
      error?.message || "Failed to process OAuth callback.";
    const html = buildOAuthErrorPage(message, dashboardUrl);
    res.status(statusCode).type("html").send(html);
  }
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

    const sanitized = {
      isDefault: appConfig?.isDefault,
      authUrl: appConfig?.authUrl,
      region: appConfig?.region,
      user: appConfig?.user,
      organization: appConfig?.organization,
      app: appConfig?.app,
      timestamp: appConfig?.timestamp,
    };

    res.status(200).json(sanitized);

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
    const { userId } = req?.params;

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
