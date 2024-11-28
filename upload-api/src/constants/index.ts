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
  VALIDATION_SUCCESSFULL: ' File validated successfully.',
  ZIP_FILE_SAVE: 'Issue While Saving Zip File.',
  XML_FILE_SAVE: 'Issue While Saving XML File.',
  MAPPER_SAVED: 'Mapping process completed successfull.'
};

export const HTTP_RESPONSE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
  Connection: 'close'
};

export const MIGRATION_DATA_CONFIG = {
  DATA :"cmsMigrationData",

  BACKUP_DATA: "migration-data",
  BACKUP_LOG_DIR: "logs",
  BACKUP_FOLDER_NAME: "import",
  BACKUP_FILE_NAME: "success.log",

  LOCALE_DIR_NAME : "locale",
  LOCALE_FILE_NAME : "locales.json",
  LOCALE_MASTER_LOCALE : "master-locale.json",
  LOCALE_CF_LANGUAGE : "language.json",

  WEBHOOKS_DIR_NAME : "webhooks",
  WEBHOOKS_FILE_NAME : "webhooks.json",

  ENVIRONMENTS_DIR_NAME : "environments",
  ENVIRONMENTS_FILE_NAME : "environments.json",

  CONTENT_TYPES_DIR_NAME : "content_types",
  CONTENT_TYPES_FILE_NAME : "contenttype.json",
  CONTENT_TYPES_MASTER_FILE : "contenttypes.json",
  CONTENT_TYPES_SCHEMA_FILE : "schema.json",

  REFERENCES_DIR_NAME : "reference",
  REFERENCES_FILE_NAME : "reference.json",

  RTE_REFERENCES_DIR_NAME : "rteReference",
  RTE_REFERENCES_FILE_NAME : "rteReference.json",

  ASSETS_DIR_NAME : "assets",
  ASSETS_FILE_NAME : "assets.json",
  ASSETS_SCHEMA_FILE : "index.json",
  ASSETS_FAILED_FILE : "cs_failed.json",
  ASSETS_METADATA_FILE :"metadata.json",

  ENTRIES_DIR_NAME : "entries",
  ENTRIES_MASTER_FILE : "index.json",

  GLOBAL_FIELDS_DIR_NAME : "global_fields",
  GLOBAL_FIELDS_FILE_NAME : "globalfields.json",

  EXPORT_INFO_FILE: "export-info.json"
}
