// middleware/authentication.middleware.ts
import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { ValidationError } from "../utils/custom-errors.utils";

export const validationMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) throw new ValidationError(errors.array()[0].msg);

  return next();
};
