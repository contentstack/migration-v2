export type HttpErrorCodes = {
  OK: number;
  FORBIDDEN: number;
  BAD_REQUEST: number;
  NOT_FOUND: number;
  UNAUTHORIZED: number;
  TOO_MANY_REQS: number;
  SOMETHING_WRONG: number;
  MOVED_PERMANENTLY: number;
  SUPPORT_DOC: number;
  SERVER_ERROR: number;
};
export type ConstantType = {
  AXIOS_TIMEOUT: number;
  HTTP_CODES: HttpErrorCodes;
  HTTP_TEXTS: HttpErrorTexts;
  HTTP_RESPONSE_HEADERS: HttpResponseHeaders;
  METHODS_TO_INCLUDE_DATA_IN_AXIOS: Array<string>;
};

export type HttpErrorTexts = {
  INTERNAL_ERROR: string;
  SOMETHING_WENT_WRONG: string;
  NO_CS_USER: string;
  SUCCESS_LOGIN: string;
  TOKEN_ERROR: string;
  LOGIN_ERROR: string;
};

export type HttpResponseHeaders = {
  "Access-Control-Allow-Origin": string;
  "Content-Type": string;
  Connection: string;
};

export const constants: ConstantType = {
  AXIOS_TIMEOUT: 60 * 1000,
  HTTP_CODES: {
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
  },
  HTTP_TEXTS: {
    INTERNAL_ERROR: "Internal server error, please try again later.",
    SOMETHING_WENT_WRONG:
      "Something went wrong while processing your request, please try again.",
    NO_CS_USER: "No user found with the credentials",
    SUCCESS_LOGIN: "Login Successful.",
    TOKEN_ERROR: "Error occurred during token generation.",
    LOGIN_ERROR: "Error occurred during login",
  },
  HTTP_RESPONSE_HEADERS: {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    Connection: "close",
  },
  METHODS_TO_INCLUDE_DATA_IN_AXIOS: ["PUT", "POST", "DELETE", "PATCH"],
};
