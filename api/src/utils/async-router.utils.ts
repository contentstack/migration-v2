import { Request, Response, NextFunction } from "express";

/**
 * Wraps an async function to handle errors and pass them to the Express error handler.
 * @param fn - The async function to be wrapped.
 * @returns A middleware function that handles async errors.
 */
export const asyncRouter =
  (fn: any) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
