// middleware/authentication.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export const authenticateUser = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // authentication logic (check for a valid token)
  const token = req.headers.authorization?.split(" ")[1];
  const secretKey = config.SECRET_KEY;
  if (token) {
    jwt.verify(token, secretKey, (err, decoded) => {
      if (err) {
        return res
          .status(401)
          .json({ message: "Unauthorized - Invalid token" });
      }

      // Attach the decoded token to the request object for later use
      (req as any).decodedToken = decoded;

      next();
    });
  } else {
    return res.status(401).json({ message: "Unauthorized - Token missing" });
  }
};
