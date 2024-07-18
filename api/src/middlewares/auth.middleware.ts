// middleware/authentication.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { HTTP_CODES } from "../constants/index.js";

/**
 * Middleware function to authenticate the user.
 *
 * @param req - The Express request object.
 * @param res - The Express response object.
 * @param next - The next middleware function.
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

  /* this middleware function verifies the provided JWT token, 
      handles any errors that may occur during verification, 
      attaches the decoded token payload to the request object, 
      and then passes control to the next middleware or request handler. 
    */
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
