export const constants = {
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
    UNAUTHORIZED: "You're unauthorized to access this resource.",
    INTERNAL_ERROR: "Internal server error, please try again later.",
    SOMETHING_WENT_WRONG:
      "Something went wrong while processing your request, please try again.",
    NO_CS_USER: "No user found with the credentials",
    SUCCESS_LOGIN: "Login Successful.",
    TOKEN_ERROR: "Error occurred during token generation.",
    LOGIN_ERROR: "Error occurred during login",
    ROUTE_ERROR: "Sorry, the requested resource is not available.",
    PROJECT_NOT_FOUND: "Sorry, the requested project does not exists.",
    NO_PROJECT: "resource not found with the given ID(s).",
    MIGRATION_CREATED: "Project's migration created successfully.",
    MIGRATION_UPDATED: "Project's migration updated successfully.",
    CMS_UPDATED: "Project's migration cms updated successfully",
    FILE_FORMAT_UPDATED: "Project's migration file format updated successfully",
    MIGRATION_DELETED: "Project's migration deleted successfully.",
    INVALID_ID: "Provided $ ID is invalid.",
    MIGRATION_EXISTS: "Project's migration already exists.",
    CONTENT_TYPE_NOT_FOUND: "ContentType does not exist",
    INVALID_CONTENT_TYPE: "Provide valid ContentType data",
    RESET_CONTENT_MAPPING:
      "ContentType has been successfully restored to its initial mapping",
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
    LENGTH_LIMIT: "$'s max limit reached.",
    STRING_REQUIRED: "Provided $ should be a string.",
    INVALID_REGION: "Provided region doesn't exists.",
  },
};
export const PROJECT_POPULATE_FIELDS = "migration.modules.content_mapper";
export const CONTENT_TYPE_POPULATE_FIELDS =
  "otherCmsTitle otherCmsUid isUpdated updateAt contentstackTitle contnetStackUid";
