import { Request, Response } from "express";
import { AppError } from "../utils/custom-errors.utils";

export const errorMiddleware = (err: Error, req: Request, res: Response) => {
  if (err instanceof AppError) {
    res
      .status(err.statusCode)
      .json({ error: { code: err.statusCode, message: err.message } });
  } else {
    console.error(err.stack);
    res
      .status(500)
      .json({ error: { code: 500, message: "Internal Server Error" } });
  }
};
