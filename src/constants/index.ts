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
  UNPROCESSABLE_CONTENT: number;
};

export type ValidationErrors = {
  INVALID_EMAIL: string;
  EMAIL_LIMIT: string;
  STRING_REQUIRED: string;
  INVALID_REGION: string;
};

export type ConstantType = {
  CS_REGIONS: Array<string>;
  AXIOS_TIMEOUT: number;
  HTTP_CODES: HttpErrorCodes;
  HTTP_TEXTS: HttpErrorTexts;
  HTTP_RESPONSE_HEADERS: HttpResponseHeaders;
  METHODS_TO_INCLUDE_DATA_IN_AXIOS: Array<string>;
  VALIDATION_ERRORS: ValidationErrors;
};

export type HttpErrorTexts = {
  INTERNAL_ERROR: string;
  SOMETHING_WENT_WRONG: string;
  NO_CS_USER: string;
  SUCCESS_LOGIN: string;
  TOKEN_ERROR: string;
  LOGIN_ERROR: string;
  ROUTE_ERROR: string;
};

export type HttpResponseHeaders = {
  "Access-Control-Allow-Origin": string;
  "Content-Type": string;
  Connection: string;
};

export const constants: ConstantType = {
  CS_REGIONS: ["US", "EU", "AZURE_NA", "AZURE_EU"],
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
    UNPROCESSABLE_CONTENT: 422,
  },
  HTTP_TEXTS: {
    INTERNAL_ERROR: "Internal server error, please try again later.",
    SOMETHING_WENT_WRONG:
      "Something went wrong while processing your request, please try again.",
    NO_CS_USER: "No user found with the credentials",
    SUCCESS_LOGIN: "Login Successful.",
    TOKEN_ERROR: "Error occurred during token generation.",
    LOGIN_ERROR: "Error occurred during login",
    ROUTE_ERROR: "Sorry, the requested resource is not available.",
  },
  HTTP_RESPONSE_HEADERS: {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    Connection: "close",
  },
  METHODS_TO_INCLUDE_DATA_IN_AXIOS: ["PUT", "POST", "DELETE", "PATCH"],
  VALIDATION_ERRORS: {
    INVALID_EMAIL: "Given email ID is invalid.",
    EMAIL_LIMIT: "Email's max limit reached.",
    STRING_REQUIRED: "Provided $ should be a string.",
    INVALID_REGION: "Provided region doesn't exists.",
  },
};
