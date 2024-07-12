// middleware/authentication.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { HTTP_CODES } from "../constants/index.js";

/**
 * Authenticates the user.
 * @param req - Express request object.
 * @param res - Express response object.
 * @param next - Express next function.
 */
export const authenticateUser = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const status = HTTP_CODES.UNAUTHORIZED;
  const token = req.get("app_token");

  if (!token)
    return res
      .status(status)
      .json({ status, message: "Unauthorized - Token missing" });

  jwt.verify(token, config.APP_TOKEN_KEY, (err, payload) => {
    if (err)
      return res
        .status(status)
        .json({ status, message: "Unauthorized - Invalid token" });

    // Attach the payload to the request object for later use
    (req as any).body.token_payload = payload;

    next();
  });
};
