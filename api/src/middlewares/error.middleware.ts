import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/custom-errors.utils.js";
import logger from "../utils/logger.js";

/**
 * Middleware function to handle errors in the application.
 * @param err - The error object.
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param next - The next middleware function.
 */
export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  if (err instanceof AppError) {
    res
      .status(err.statusCode)
      .json({ error: { code: err.statusCode, message: err.message } });
  } else {
    // Log the error
    logger.error(err.stack);
    res
      .status(500)
      .json({ error: { code: 500, message: "Internal Server Error" } });
  }
};
