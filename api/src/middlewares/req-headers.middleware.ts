import { Request, Response, NextFunction } from "express";

/**
 * Middleware to set the request headers.
 * 
 * @param req The request object.
 * @param res The response object.
 * @param next The next function.
 */
export const requestHeadersMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, Content-Type, Accept, app_token"
  );
  if (req.method === "OPTIONS") {
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    return res.status(200).json({});
  }
  next();
};
