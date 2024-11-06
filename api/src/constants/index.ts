export const CS_REGIONS = ["NA", "EU", "AZURE_NA", "AZURE_EU", "GCP_NA"];
export const CMS = {
  CONTENTFUL:"contentful",
  SITECORE:"sitecore",
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
    "Sorry, no logs found for requested stack migration."
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
  DATA :"./cmsMigrationData",

  BACKUP_DATA: "migration-data",
  BACKUP_LOG_DIR: "logs",
  BACKUP_FOLDER_NAME: "import",
  BACKUP_FILE_NAME: "success.log",

  LOCALE_DIR_NAME : "locales",
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
  // ASSETS_SCHEMA_FILE : "index.json",
  ASSETS_SCHEMA_FILE : "assetsSchema.json",
  ASSETS_FAILED_FILE : "cs_failed.json",
  ASSETS_METADATA_FILE :"metadata.json",

  ENTRIES_DIR_NAME : "entries",
  ENTRIES_MASTER_FILE : "index.json",

  GLOBAL_FIELDS_DIR_NAME : "global_fields",
  GLOBAL_FIELDS_FILE_NAME : "globalfields.json",

  EXPORT_INFO_FILE: "export-info.json"
}


export const LOCALE_LIST : { [key: string]: string } = {
  "af-za": "Afrikaans - South Africa",
  "sq-al": "Albanian - Albania",
  "ar": "Arabic",
  "ar-dz": "Arabic - Algeria",
  "ar-bh": "Arabic - Bahrain",
  "ar-eg": "Arabic - Egypt",
  "ar-iq": "Arabic - Iraq",
  "ar-jo": "Arabic - Jordan",
  "ar-kw": "Arabic - Kuwait",
  "ar-lb": "Arabic - Lebanon",
  "ar-ly": "Arabic - Libya",
  "ar-ma": "Arabic - Morocco",
  "ar-om": "Arabic - Oman",
  "ar-qa": "Arabic - Qatar",
  "ar-sa": "Arabic - Saudi Arabia",
  "ar-sy": "Arabic - Syria",
  "ar-tn": "Arabic - Tunisia",
  "ar-ae": "Arabic - United Arab Emirates",
  "ar-ye": "Arabic - Yemen",
  "hy-am": "Armenian - Armenia",
  "az": "Azeri",
  "cy-az-az": "Azeri (Cyrillic) - Azerbaijan",
  "lt-az-az": "Azeri (Latin) - Azerbaijan",
  "my-mm": "Bahasa - Myanmar",
  "eu-es": "Basque - Basque",
  "be-by": "Belarusian - Belarus",
  "bs": "Bosnian (Latin script)",
  "bg-bg": "Bulgarian - Bulgaria",
  "ca-es": "Catalan - Catalan",
  "zh": "Chinese",
  "zh-au": "Chinese - Australia",
  "zh-ca": "Chinese - Canada",
  "zh-cn": "Chinese - China",
  "zh-fr": "Chinese - France",
  "zh-hk": "Chinese - Hong Kong SAR",
  "zh-it": "Chinese - Italy",
  "zh-mo": "Chinese - Macau SAR",
  "zh-my": "Chinese - Malaysia",
  "zh-mm": "Chinese - Myanmar",
  "zh-sg": "Chinese - Singapore",
  "zh-za": "Chinese - South Africa",
  "zh-tw": "Chinese - Taiwan",
  "zh-chs": "Chinese (Simplified)",
  "zh-cht": "Chinese (Traditional)",
  "zh-us": "Chinese - United States",
  "hr-hr": "Croatian - Croatia",
  "cs": "Czech",
  "cs-cz": "Czech - Czech Republic",
  "da-dk": "Danish - Denmark",
  "div-mv": "Dhivehi - Maldives",
  "nl": "Dutch",
  "nl-be": "Dutch - Belgium",
  "nl-nl": "Dutch - The Netherlands",
  "en": "English",
  "en-au": "English - Australia",
  "en-at": "English - Austria",
  "en-be": "English - Belgium",
  "en-bz": "English - Belize",
  "en-br": "English - Brazil",
  "en-bg": "English - Bulgaria",
  "en-ca": "English - Canada",
  "en-cb": "English - Caribbean",
  "en-cl": "English - Chile",
  "en-cn": "English - China",
  "en-co": "English - Colombia",
  "en-cz": "English - Czech Republic",
  "en-dk": "English - Denmark",
  "en-do": "English - Dominican Republic",
  "en-ee": "English - Estonia",
  "en-fi": "English - Finland",
  "en-fr": "English - France",
  "en-de": "English - Germany",
  "en-gr": "English - Greece",
  "en-hk": "English - Hong Kong",
  "en-hu": "English - Hungary",
  "en-in": "English - India",
  "en-id": "English - Indonesia",
  "en-ie": "English - Ireland",
  "en-it": "English - Italy",
  "en-jm": "English - Jamaica",
  "en-jp": "English - Japan",
  "en-kr": "English - Korea",
  "en-lv": "English - Latvia",
  "en-lt": "English - Lithuania",
  "en-lu": "English - Luxembourg",
  "en-my": "English - Malaysia",
  "en-mx": "English - Mexico",
  "en-nz": "English - New Zealand",
  "en-no": "English - Norway",
  "en-pa": "English - Panama",
  "en-pe": "Engish - Peru",
  "en-ph": "English - Philippines",
  "en-pl": "English - Poland",
  "en-pt": "English - Portugal",
  "en-pr": "English - Puerto Rico",
  "en-ro": "English - Romania",
  "en-ru": "English - Russia",
  "en-sg": "English - Singapore",
  "en-sk": "English - Slovakia",
  "en-si": "English - Slovenia",
  "en-za": "English - South Africa",
  "en-es": "English - Spain",
  "en-se": "English - Sweden",
  "en-ch": "English - Switzerland",
  "en-th": "English - Thailand",
  "en-nl": "English - The Netherlands",
  "en-tt": "English - Trinidad and Tobago",
  "en-tn": "English - Tunisia",
  "en-tr": "English - Turkey",
  "en-gb": "English - United Kingdom",
  "en-us": "English - United States",
  "en-uy": "English - Uruguay",
  "en-ve": "English - Venezuela",
  "en-vn": "English - Vietnam",
  "en-zw": "English - Zimbabwe",
  "et-ee": "Estonian - Estonia",
  "fo-fo": "Faroese - Faroe Islands",
  "fa-ir": "Farsi - Iran",
  "fil-ph": "Filipino - Philippines",
  "fi": "Finnish",
  "fi-fi": "Finnish - Finland",
  "fr": "French",
  "fr-be": "French - Belgium",
  "fr-ca": "French - Canada",
  "fr-fr": "French - France",
  "fr-lu": "French - Luxembourg",
  "fr-mc": "French - Monaco",
  "fr-ch": "French - Switzerland",
  "fr-tn": "French - Tunisia",
  "fr-us": "French - United States",
  "gd": "Gaelic",
  "gl-es": "Galician - Galician",
  "ka-ge": "Georgian - Georgia",
  "de": "German",
  "de-at": "German - Austria",
  "de-de": "German - Germany",
  "de-li": "German - Liechtenstein",
  "de-lu": "German - Luxembourg",
  "de-ch": "German - Switzerland",
  "el-gr": "Greek - Greece",
  "gu-in": "Gujarati - India",
  "he-il": "Hebrew - Israel",
  "hi-in": "Hindi - India",
  "hu-hu": "Hungarian - Hungary",
  "is-is": "Icelandic - Iceland",
  "id-id": "Indonesian - Indonesia",
  "it": "Italian",
  "it-it": "Italian - Italy",
  "it-ch": "Italian - Switzerland",
  "ja": "Japanese",
  "ja-jp": "Japanese - Japan",
  "kn-in": "Kannada - India",
  "kk-kz": "Kazakh - Kazakhstan",
  "km-kh": "Khmer - Cambodia",
  "kok-in": "Konkani - India",
  "ko": "Korean",
  "ko-kr": "Korean - Korea",
  "ky-kz": "Kyrgyz - Kazakhstan",
  "lv-lv": "Latvian - Latvia",
  "lt-lt": "Lithuanian - Lithuania",
  "lb-lu": "Luxembourgish - Luxembourg",
  "mk-mk": "Macedonian (FYROM)",
  "ms": "Malay",
  "ms-bn": "Malay - Brunei",
  "ms-my": "Malay - Malaysia",
  "ms-sg": "Malay - Singapore",
  "mt": "Maltese",
  "mr-in": "Marathi - India",
  "mn-mn": "Mongolian - Mongolia",
  "no": "Norwegian",
  "no-no": "Norwegian - Norway",
  "nb-no": "Norwegian (Bokmal) - Norway",
  "nn-no": "Norwegian (Nynorsk) - Norway",
  "pl-pl": "Polish - Poland",
  "pt": "Portuguese",
  "pt-br": "Portuguese - Brazil",
  "pt-pt": "Portuguese - Portugal",
  "pa-in": "Punjabi - India",
  "ro-ro": "Romanian - Romania",
  "ru": "Russian",
  "ru-ee": "Russian - Estonia",
  "ru-kz": "Russian - Kazakhstan",
  "ru-lv": "Russian - Latvia",
  "ru-lt": "Russian - Lithuania",
  "ru-ru": "Russian - Russia",
  "ru-ua": "Russian-Ukraine",
  "sa-in": "Sanskrit - India",
  "cy-sr-sp": "Serbian (Cyrillic) - Serbia",
  "lt-sr-sp": "Serbian (Latin) - Serbia",
  "sr-me": "Serbian - Montenegro",
  "sk-sk": "Slovak - Slovakia",
  "sl-si": "Slovenian - Slovenia",
  "es": "Spanish",
  "es-ar": "Spanish - Argentina",
  "es-bo": "Spanish - Bolivia",
  "es-cl": "Spanish - Chile",
  "es-co": "Spanish - Colombia",
  "es-cr": "Spanish - Costa Rica",
  "es-do": "Spanish - Dominican Republic",
  "es-ec": "Spanish - Ecuador",
  "es-sv": "Spanish - El Salvador",
  "es-gt": "Spanish - Guatemala",
  "es-hn": "Spanish - Honduras",
  "es-419": "Spanish - Latin America",
  "es-mx": "Spanish - Mexico",
  "es-ni": "Spanish - Nicaragua",
  "es-pa": "Spanish - Panama",
  "es-py": "Spanish - Paraguay",
  "es-pe": "Spanish - Peru",
  "es-pr": "Spanish - Puerto Rico",
  "es-es": "Spanish - Spain",
  "es-us": "Spanish - United States",
  "es-uy": "Spanish - Uruguay",
  "es-ve": "Spanish - Venezuela",
  "sw-ke": "Swahili - Kenya",
  "sv": "Swedish",
  "sv-fi": "Swedish - Finland",
  "sv-se": "Swedish - Sweden",
  "syr-sy": "Syriac - Syria",
  "tl": "Tagalog (Philippines)",
  "ta-in": "Tamil - India",
  "tt-ru": "Tatar - Russia",
  "te-in": "Telugu - India",
  "th-no": "Thai - Norway",
  "th-sw": "Thai - Sweden",
  "th-th": "Thai - Thailand",
  "tr-tr": "Turkish - Turkey",
  "uk-ua": "Ukrainian - Ukraine",
  "ur-pk": "Urdu - Pakistan",
  "uz": "Uzbek",
  "cy-uz-uz": "Uzbek (Cyrillic) - Uzbekistan",
  "lt-uz-uz": "Uzbek (Latin) - Uzbekistan",
  "vi-us": "Vietnamese - United States",
  "vi-vn": "Vietnamese - Vietnam",
  "xh": "Xhosa",
  "zu": "Zulu"
}