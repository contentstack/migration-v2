import { Request, Response, NextFunction } from "express";
import { HTTP_CODES } from "../constants";
import { config } from "../config";

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
