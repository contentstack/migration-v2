export const HTTP_CODES = {
  OK: 200,
  FORBIDDEN: 403,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  TOO_MANY_REQS: 429,
  SOMETHING_WRONG: 501,
  MOVED_PERMANENTLY: 301,
  SUPPORT_DOC: 294,
  SERVER_ERROR: 500,
  UNPROCESSABLE_CONTENT: 422
};

export const HTTP_TEXTS = {
  UNAUTHORIZED: "You're unauthorized to access this resource.",
  S3_ERROR: 'Something went wrong while handing the file',
  INTERNAL_ERROR: 'Internal server error, please try again later.',
  SOMETHING_WENT_WRONG: 'Something went wrong while processing your request, please try again.',
  ROUTE_ERROR: 'Sorry, the requested resource is not available.',
  VALIDATION_ERROR: 'File validation failed.',
  VALIDATION_SUCCESSFULL: ' File validated successfully.'
};

export const HTTP_RESPONSE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
  Connection: 'close'
};
