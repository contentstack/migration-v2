// middleware/authentication.middleware.ts
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const authenticateUser = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Simulate authentication logic (e.g., check for a token)
  const token = req.headers.authorization?.split(" ")[1];
  const secretKey =
    process.env.NODE_ENV === "dev" ?
      process.env.SECRET_KEY_DEV!
      : process.env.SECRET_KEY_PROD!;
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
