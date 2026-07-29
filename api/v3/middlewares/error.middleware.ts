import { Request, Response, NextFunction } from "express";

import { HTTP_CODES, HTTP_TEXTS } from "../constants/http.js";

/**
 * v3 error handler — standalone. Normalizes thrown/rejected errors into a JSON
 * envelope. Mount last on the v3 router.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const v3ErrorMiddleware = (
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // multer's file-size limit surfaces as a MulterError before the controller.
  if (err?.code === "LIMIT_FILE_SIZE") {
    return res.status(HTTP_CODES.PAYLOAD_TOO_LARGE).json({
      error: {
        code: HTTP_CODES.PAYLOAD_TOO_LARGE,
        message: "File exceeds the 100 MB limit.",
      },
    });
  }

  const status = err?.status ?? HTTP_CODES.SERVER_ERROR;
  res.status(status).json({
    error: {
      code: status,
      message: err?.message ?? HTTP_TEXTS.INTERNAL_ERROR,
    },
  });
};
