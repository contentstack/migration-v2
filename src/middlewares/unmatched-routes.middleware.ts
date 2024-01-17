import { Request, Response } from "express";
import { constants } from "../constants";

export const unmatchedRoutesMiddleware = (req: Request, res: Response) => {
  const status = constants.HTTP_CODES.NOT_FOUND;
  res.status(status).json({
    error: { code: status, message: constants.HTTP_TEXTS.ROUTE_ERROR },
  });
};
