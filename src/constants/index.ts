export type HttpErrorCodes = {
  HTTP_OK: number;
  FORBIDDEN: number;
  BAD_REQUEST: number;
  UNAUTHORIZED: number;
  TOO_MANY_REQS: number;
  SOMETHING_WRONG: number;
  MOVED_PERMANENTLY: number;
};
export type ConstantType = {
  HTTP_ERROR_CODES: HttpErrorCodes;
  HTTP_ERROR_TEXTS: HttpErrorTexts;
  HTTP_RESPONSE_HEADERS: HttpResponseHeaders;
  METHODS_TO_INCLUDE_DATA_IN_AXIOS: Array<string>;
};

export type HttpErrorTexts = {
  INTERNAL_ERROR: string;
  SOMETHING_WENT_WRONG: string;
};

export type HttpResponseHeaders = {
  "Access-Control-Allow-Origin": string;
  "Content-Type": string;
  Connection: string;
};

export const constants: ConstantType = {
  HTTP_ERROR_CODES: {
    HTTP_OK: 200,
    FORBIDDEN: 403,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    TOO_MANY_REQS: 429,
    SOMETHING_WRONG: 501,
    MOVED_PERMANENTLY: 301,
  },
  HTTP_ERROR_TEXTS: {
    INTERNAL_ERROR: "Internal server error, please try again later.",
    SOMETHING_WENT_WRONG:
      "Something went wrong while processing your request, please try again.",
  },
  HTTP_RESPONSE_HEADERS: {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    Connection: "close",
  },
  METHODS_TO_INCLUDE_DATA_IN_AXIOS: ["PUT", "POST", "DELETE", "PATCH"],
};
