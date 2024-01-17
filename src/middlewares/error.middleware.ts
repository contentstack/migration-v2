import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/custom-errors.utils";
import logger from "../utils/logger";

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  // Log the error
  logger.error(err.stack);

  if (err instanceof AppError) {
    res
      .status(err.statusCode)
      .json({ error: { code: err.statusCode, message: err.message } });
  } else {
    res
      .status(500)
      .json({ error: { code: 500, message: "Internal Server Error" } });
  }
};
