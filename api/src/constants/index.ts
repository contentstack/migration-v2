export const CS_REGIONS = ["NA", "EU", "AZURE_NA", "AZURE_EU"];
export const MODULES = [
  "Project",
  "Migration",
  "Content Mapping",
  "Legacy CMS",
  "Destination Stack",
];
export const MODULES_ACTIONS = ["Create", "Update", "Delete"];
export const AXIOS_TIMEOUT = 60 * 1000;
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
  UNPROCESSABLE_CONTENT: 422,
};
export const HTTP_TEXTS = {
  UNAUTHORIZED: "You're unauthorized to access this resource.",
  S3_ERROR: "Something went wrong while handing the file",
  INTERNAL_ERROR: "Internal server error, please try again later.",
  SOMETHING_WENT_WRONG:
    "Something went wrong while processing your request, please try again.",
  CS_ERROR: "Contentstack API error",
  NO_CS_USER: "No user found with the credentials",
  SUCCESS_LOGIN: "Login Successful.",
  TOKEN_ERROR: "Error occurred during token generation.",
  LOGIN_ERROR: "Error occurred during login",
  ROUTE_ERROR: "Sorry, the requested resource is not available.",
  PROJECT_NOT_FOUND: "Sorry, the requested project does not exists.",
  PROJECT_CREATION_FAILED: "Error occurred while creating project.",
  NO_PROJECT: "resource not found with the given ID(s).",
  AFFIX_UPDATED: "Project's Affix updated successfully",
  AFFIX_CONFIRMATION_UPDATED:
    "Project's Affix confirmation updated successfully",
  FILEFORMAT_CONFIRMATION_UPDATED:
    "Project's Fileformat confirmation updated successfully",
  CMS_UPDATED: "Project's migration cms updated successfully",
  FILE_FORMAT_UPDATED: "Project's migration file format updated successfully",
  DESTINATION_STACK_UPDATED:
    "Project's migration destination stack updated successfully",
  DESTINATION_STACK_NOT_FOUND: "Destination stack does not exist",
  DESTINATION_STACK_ERROR: "Error occurred during verifying destination stack",
  INVALID_ID: "Provided $ ID is invalid.",
  CONTENT_TYPE_NOT_FOUND: "ContentType does not exist",
  CONTENT_TYPE_MISSING: "ContentType is missing in request.",
  INVALID_CONTENT_TYPE: "Provide valid ContentType data",
  RESET_CONTENT_MAPPING:
    "ContentType has been successfully restored to its initial mapping",
  UPLOAD_SUCCESS: "File uploaded successfully",
  CANNOT_UPDATE_LEGACY_CMS:
    "Updating the legacy CMS is not possible as the migration process is either in progress or has already been successfully completed.",
  CANNOT_UPDATE_FILE_FORMAT:
    "Updating the file format is not possible as the migration process is either in progress or has already been successfully completed.",
  CANNOT_UPDATE_DESTINATION_STACK:
    "Updating the destination stack is restricted. Please verify the status and review preceding actions.",
  CANNOT_PROCEED_LEGACY_CMS:
    "You cannot proceed if the project is not in draft or if any Legacy CMS details are missing.",
  CANNOT_PROCEED_DESTINATION_STACK:
    "You cannot proceed if the project is not in draft or if any Legacy CMS or Destination Stack details are missing.",
  CANNOT_UPDATE_CONTENT_MAPPING:
    "Updating the content mapping is restricted. Please verify the status and review preceding actions.",
  CANNOT_RESET_CONTENT_MAPPING:
    "Reseting the content mapping is restricted. Please verify the status and review preceding actions.",
  CONTENTMAPPER_NOT_FOUND:
    "Sorry, the requested content mapper id does not exists.",
  ADMIN_LOGIN_ERROR:
    "Sorry, You Don't have admin access in any of the Organisation",
  PROJECT_DELETE:
     "Project Deleted Successfully",
  PROJECT_REVERT:
     "Project Reverted Successfully"
};

export const HTTP_RESPONSE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "application/json",
  Connection: "close",
};
export const METHODS_TO_INCLUDE_DATA_IN_AXIOS = [
  "PUT",
  "POST",
  "DELETE",
  "PATCH",
];
export const VALIDATION_ERRORS = {
  INVALID_EMAIL: "Given email ID is invalid.",
  EMAIL_LIMIT: "Email's max limit reached.",
  LENGTH_LIMIT: "$'s max limit reached.",
  STRING_REQUIRED: "Provided $ should be a string.",
  BOOLEAN_REQUIRED: "Provided $ should be a boolean.",
  INVALID_REGION: "Provided region doesn't exists.",
  FIELD_REQUIRED: "Field '$' is required.",
  INVALID_AFFIX: "Invalid affix format",
};
export const POPULATE_CONTENT_MAPPER = "content_mapper";
export const POPULATE_FIELD_MAPPING = "fieldMapping";
export const CONTENT_TYPE_POPULATE_FIELDS =
  "otherCmsTitle otherCmsUid isUpdated updateAt contentstackTitle contentstackUid";
export const PROJECT_UNSELECTED_FIELDS =
  "-content_mapper -legacy_cms -destination_stack_id -execution_log";
export const EXCLUDE_CONTENT_MAPPER = "-content_mapper -execution_log";
export const AFFIX_REGEX = /^[a-zA-Z][a-zA-Z0-9]{1,4}$/;
export const PROJECT_STATUS = {
  DRAFT: "Draft",
  READY: "Ready",
  INPROGRESS: "InProgress",
  FAILED: "Failed",
  SUCCESS: "Success",
};
export const STEPPER_STEPS = {
  LEGACY_CMS: 1,
  DESTINATION_STACK: 2,
  CONTENT_MAPPING: 3,
  TESTING: 4,
  MIGRATION: 5,
};
export const PREDEFINED_STATUS = [
  "Draft",
  "Ready",
  "InProgress",
  "Failed",
  "Success",
];
export const PREDEFINED_STEPS = [1, 2, 3, 4, 5];

export const NEW_PROJECT_STATUS = {
  0: 0, //DRAFT
  1: 1, //READY_TO_TEST
  2: 2, //TESTING_IN_PROGRESS
  3: 3, //READY_FOR_MIGRATION
  4: 4, //MIGRATION_IN_PROGRESS
  5: 5, //MIGRATION_SUCCESSFUL
  6: 6, //MIGRATION_TERMINATED
};
