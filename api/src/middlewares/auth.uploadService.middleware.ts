import { Request, Response, NextFunction } from "express";
import { HTTP_CODES } from "../constants/index.js";
import { config } from "../config/index.js";

/**
 * Middleware function to authenticate the upload service.
 * Checks if the provided secret key matches the configured file upload key.
 * If the key is valid, the request is allowed to proceed to the next middleware or route handler.
 * If the key is invalid, an unauthorized response is sent.
 *
 * @param req - The Express Request object.
 * @param res - The Express Response object.
 * @param next - The Express NextFunction to pass control to the next middleware or route handler.
 */
export const authenticateUploadService = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const status = HTTP_CODES.UNAUTHORIZED;
  const secret_key = req.get("secret_key");

  if (secret_key !== config.FILE_UPLOAD_KEY)
    return res
      .status(status)
      .json({ status, message: "Unauthorized - Please provide a valid key" });

  next();
};
