import { Request, Response } from "express";
import { HTTP_CODES, HTTP_TEXTS } from "../constants/index.js";

export const unmatchedRoutesMiddleware = (req: Request, res: Response) => {
  const status = HTTP_CODES.NOT_FOUND;
  res.status(status).json({
    error: { code: status, message: HTTP_TEXTS.ROUTE_ERROR },
  });
};
