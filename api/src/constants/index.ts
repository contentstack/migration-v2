export const CS_REGIONS = ["NA", "EU", "AZURE_NA", "AZURE_EU", "GCP_NA"];
export const CMS = {
  CONTENTFUL: "contentful",
  SITECORE_V8: "sitecore v8",
  SITECORE_V9: "sitecore v9",
  SITECORE_V10: "sitecore v10",
  WORDPRESS: "wordpress",
  AEM: "aem",
}
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
  STACK_UPDATED: "Project's migration stack details updated successfully",
  CONTENT_MAPPER_UPDATED: "Project's migration content mapping updated successfully",
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
  CANNOT_PROCEED_CONTENT_MAPPING:
    "You cannot proceed if the project is not in draft or if any Legacy CMS or Destination Stack or Content Mapping details are missing.",
  CANNOT_PROCEED_TEST_MIGRATION:
    "You cannot proceed if the project is not in draft or if any Legacy CMS or Destination Stack or Content Mapping or Test Migration details are missing.",
  CANNOT_PROCEED_MIGRATION:
    "You cannot proceed if the project is not in draft or if any Legacy CMS or Destination Stack or Content Mapping or Test Migration details are missing or Migration is not completed.",
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
    "Project Reverted Successfully",
  LOGS_NOT_FOUND:
    "Sorry, no logs found for requested stack migration.",
  MIGRATION_EXECUTION_KEY_UPDATED:
    "Project's migration execution key updated successfully"
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
export const STEPPER_STEPS: any = {
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

export const CONTENT_TYPE_STATUS = {
  1: 1, //auto-mapping
  2: 2, //verified
  3: 3, //mapping failed
  4: 4, //auto-dump
};
// Cs Locale : Destination Local
export const LOCALE_MAPPER: any = {
  //not more than one locale mapping in master locale
  masterLocale: {
    'en-us': 'en'
  },
  'fr': 'fr-fr'
}
export const CHUNK_SIZE = 1048576;

export const MIGRATION_DATA_CONFIG = {
  DATA: "./cmsMigrationData",

  BACKUP_DATA: "migration-data",
  BACKUP_LOG_DIR: "logs",
  BACKUP_FOLDER_NAME: "import",
  BACKUP_FILE_NAME: "success.log",

  LOCALE_DIR_NAME: "locales",
  LOCALE_FILE_NAME: "locales.json",
  LOCALE_MASTER_LOCALE: "master-locale.json",
  LOCALE_CF_LANGUAGE: "language.json",

  WEBHOOKS_DIR_NAME: "webhooks",
  WEBHOOKS_FILE_NAME: "webhooks.json",

  ENVIRONMENTS_DIR_NAME: "environments",
  ENVIRONMENTS_FILE_NAME: "environments.json",

  CONTENT_TYPES_DIR_NAME: "content_types",
  CONTENT_TYPES_FILE_NAME: "contenttype.json",
  CONTENT_TYPES_MASTER_FILE: "contenttypes.json",
  CONTENT_TYPES_SCHEMA_FILE: "schema.json",

  REFERENCES_DIR_NAME: "reference",
  REFERENCES_FILE_NAME: "reference.json",

  RTE_REFERENCES_DIR_NAME: "rteReference",
  RTE_REFERENCES_FILE_NAME: "rteReference.json",

  ASSETS_DIR_NAME: "assets",
  ASSETS_FILE_NAME: "assets.json",
  // ASSETS_SCHEMA_FILE : "index.json",
  ASSETS_SCHEMA_FILE: "index.json",
  ASSETS_FAILED_FILE: "cs_failed.json",
  ASSETS_METADATA_FILE: "metadata.json",

  ENTRIES_DIR_NAME: "entries",
  ENTRIES_MASTER_FILE: "index.json",

  GLOBAL_FIELDS_DIR_NAME: "global_fields",
  GLOBAL_FIELDS_FILE_NAME: "globalfields.json",

  EXPORT_INFO_FILE: "export-info.json"
}