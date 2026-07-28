/**
 * v3 HTTP status codes — standalone (not imported from `api/src`).
 */
export const HTTP_CODES = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  PAYLOAD_TOO_LARGE: 413,
  UNPROCESSABLE_CONTENT: 422,
  SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
} as const;

export const HTTP_TEXTS = {
  ROUTE_ERROR: "Sorry, the requested resource is not available.",
  INTERNAL_ERROR: "Internal server error, please try again later.",
  TOKEN_MISSING: "Unauthorized - Token missing",
  TOKEN_INVALID: "Unauthorized - Invalid token",
} as const;
