import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

import { v3Config } from "../config/index.js";
import { HTTP_CODES, HTTP_TEXTS } from "../constants/http.js";

/**
 * v3 auth middleware — standalone re-implementation (imports nothing from
 * `api/src`). Validates the shared `app_token` JWT header against the same
 * `APP_TOKEN_KEY` secret v2 uses, and attaches the decoded payload to the
 * request. Behaviorally identical to v2's `authenticateUser`.
 */
export const authenticateV3User = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const status = HTTP_CODES.UNAUTHORIZED;
  const token = req.get("app_token");

  if (!token) {
    return res.status(status).json({ status, message: HTTP_TEXTS.TOKEN_MISSING });
  }

  jwt.verify(token, v3Config.APP_TOKEN_KEY, (err, payload) => {
    if (err) {
      return res
        .status(status)
        .json({ status, message: HTTP_TEXTS.TOKEN_INVALID });
    }

    // Ensure body exists (GET requests) before attaching the payload.
    (req as any).body = (req as any).body || {};
    (req as any).body.token_payload = payload;

    next();
  });
};
