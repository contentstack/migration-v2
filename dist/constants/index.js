"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXCLUDE_CONTENT_MAPPER = exports.PROJECT_UNSELECTED_FIELDS = exports.CONTENT_TYPE_POPULATE_FIELDS = exports.POPULATE_FIELD_MAPPING = exports.POPULATE_CONTENT_MAPPER = exports.VALIDATION_ERRORS = exports.METHODS_TO_INCLUDE_DATA_IN_AXIOS = exports.HTTP_RESPONSE_HEADERS = exports.HTTP_TEXTS = exports.HTTP_CODES = exports.AXIOS_TIMEOUT = exports.MODULES_ACTIONS = exports.MODULES = exports.CS_REGIONS = void 0;
exports.CS_REGIONS = ["NA", "EU", "AZURE_NA", "AZURE_EU"];
exports.MODULES = [
    "Project",
    "Migration",
    "Content Mapping",
    "Legacy CMS",
    "Destination Stack",
];
exports.MODULES_ACTIONS = ["Create", "Update", "Delete"];
exports.AXIOS_TIMEOUT = 60 * 1000;
exports.HTTP_CODES = {
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
};
exports.HTTP_TEXTS = {
    UNAUTHORIZED: "You're unauthorized to access this resource.",
    INTERNAL_ERROR: "Internal server error, please try again later.",
    SOMETHING_WENT_WRONG: "Something went wrong while processing your request, please try again.",
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
    DESTINATION_STACK_UPDATED: "Project's migration destination stack updated successfully",
    DESTINATION_STACK_NOT_FOUND: "Destination stack does not exist",
    DESTINATION_STACK_ERROR: "Error occurred during verifying destination stack",
    MIGRATION_DELETED: "Project's migration deleted successfully.",
    INVALID_ID: "Provided $ ID is invalid.",
    MIGRATION_EXISTS: "Project's migration already exists.",
    CONTENT_TYPE_NOT_FOUND: "ContentType does not exist",
    INVALID_CONTENT_TYPE: "Provide valid ContentType data",
    RESET_CONTENT_MAPPING: "ContentType has been successfully restored to its initial mapping",
    UPLOAD_SUCCESS: "File uploaded successfully",
};
exports.HTTP_RESPONSE_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    Connection: "close",
};
exports.METHODS_TO_INCLUDE_DATA_IN_AXIOS = [
    "PUT",
    "POST",
    "DELETE",
    "PATCH",
];
exports.VALIDATION_ERRORS = {
    INVALID_EMAIL: "Given email ID is invalid.",
    EMAIL_LIMIT: "Email's max limit reached.",
    LENGTH_LIMIT: "$'s max limit reached.",
    STRING_REQUIRED: "Provided $ should be a string.",
    INVALID_REGION: "Provided region doesn't exists.",
    FIELD_REQUIRED: "Field '$' is required.",
};
exports.POPULATE_CONTENT_MAPPER = "content_mapper";
exports.POPULATE_FIELD_MAPPING = "fieldMapping";
exports.CONTENT_TYPE_POPULATE_FIELDS = "otherCmsTitle otherCmsUid isUpdated updateAt contentstackTitle contentstackUid";
exports.PROJECT_UNSELECTED_FIELDS = "-content_mapper -legacy_cms -destination_stack_id -execution_log";
exports.EXCLUDE_CONTENT_MAPPER = "-content_mapper -execution_log";
