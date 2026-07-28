import { Request, Response, NextFunction } from "express";

/**
 * Wraps an async handler so rejections are forwarded to the Express error
 * handler. v3-local copy (no import from `api/src`).
 */
export const asyncRouter =
  (fn: any) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
