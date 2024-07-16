import { Request, Response } from "express";
import { HTTP_CODES, HTTP_TEXTS } from "../constants/index.js";

/**
 * Middleware function to handle unmatched routes.
 * 
 * @param req - The Express request object.
 * @param res - The Express response object.
 */
export const unmatchedRoutesMiddleware = (req: Request, res: Response) => {
  const status = HTTP_CODES.NOT_FOUND;
  res.status(status).json({
    error: { code: status, message: HTTP_TEXTS.ROUTE_ERROR },
  });
};
