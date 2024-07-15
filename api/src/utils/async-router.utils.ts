import { Request, Response, NextFunction } from "express";

/**
 * Wraps an asynchronous route handler function with error handling middleware.
 *
 * @param fn - The asynchronous route handler function.
 * @returns A middleware function that handles asynchronous errors.
 */
export const asyncRouter =
  (fn: any) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
