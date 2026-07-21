import { ObjectType } from './constants.interface';
export const BASE_API_URL = import.meta.env.VITE_BASE_API_URL;
export const assetsRelativeUrl = 'v3/assets';
export const WEBSITE_BASE_URL = import.meta.env.VITE_WEBSITE_BASE_URL;
export const TOKEN_KEY = 'access_token';
export const TOKEN = localStorage.getItem(TOKEN_KEY);

export const API_VERSION = import.meta.env.VITE_API_VERSION ?? 'v2';

export const AUTH_ROUTES = `${API_VERSION}/auth`;

export const LOGIN_SUCCESSFUL_MESSAGE = 'Login Successful.';
/** postMessage `data.source` when regional re-login completes in a popup (must match listener in LoadUploadFile). */
export const REGION_LOGIN_POPUP_POSTMESSAGE_SOURCE = 'cs-migration-region-login';
export const TFA_MESSAGE = 'Please login using the Two-Factor verification Token';
export const TFA_VIA_SMS_MESSAGE = 'Two-Factor Authentication Token sent via SMS.';

export const API_METHOD = {
  GET: 'GET',
  POST: 'POST',
  PATCH: 'PATCH',
  PUT: 'PUT',
  DELETE: 'DELETE'
};

export const REGIONS = {
  NA: 'NA',
  AZURE_NA: 'AZURE_NA',
  EU: 'EU',
  AZURE_EU: 'AZURE_EU',
  GCP_NA: 'GCP_NA',
  GCP_EU: 'GCP_EU',
  AU: 'AU'
};

export const CS_URL: ObjectType = {
  NA: 'https://app.contentstack.com/#!',
  EU: 'https://eu-app.contentstack.com/#!',
  AZURE_NA: 'https://azure-na-app.contentstack.com/#!',
  AZURE_EU: 'https://azure-eu-app.contentstack.com/#!',
  GCP_NA: 'https://gcp-na-app.contentstack.com/#!',
  GCP_EU: 'https://gcp-eu-app.contentstack.com/#!',
  AU: 'https://au-app.contentstack.com/#!'
};

export const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `${TOKEN}`
};

export const CS_ENTRIES = {
  HEADER: 'header',
  MAIN_HEADER: 'main_header',
  HOME_PAGE: 'homepage',
  REGIONS: 'region_login',
  LOGIN: 'login',
  PROJECTS: 'projects',
  MIGRATION_FLOW: 'migration_steps',
  LEGACY_CMS: 'legacy_cms',
  DESTINATION_STACK: 'destination_stack',
  CONTENT_MAPPING: 'content_mapping',
  TEST_MIGRATION: 'test_migration',
  MIGRATION_EXECUTION: 'migration_execution',
  SETTING: 'settings',
  NOT_FOUND_ERROR: {
    type: 'error_handler',
    url: '404'
  },
  INTERNAL_SERVER_ERROR: {
    type: 'error_handler',
    url: '500'
  },
  ERROR_HANDLER: 'error_handler',
  ADD_STACK: 'add_stack',
  UNMAPPED_LOCALE_KEY: 'undefined'
};

export const UPLOAD_FILE_RELATIVE_URL = import.meta.env.VITE_UPLOAD_SERVER;

export const UPLOAD_FILE_URL = `${UPLOAD_FILE_RELATIVE_URL}upload`;

export const PROJECT_STATUS: ObjectType = {
  '0': 'Draft',
  '1': 'Ready to test',
  '2': 'Testing in progress',
  '3': 'Ready for migration',
  '4': 'Migration in progress',
  '5': 'Migration successful',
  '6': 'Migration terminated'
};

export const NEW_PROJECT_STATUS: ObjectType = {
  '0': 'Draft',
  '1': 'In progress',
  '2': 'In progress',
  '3': 'In progress',
  '4': 'In progress',
  '5': 'Completed',
  '6': 'Failed'
};

export const isOfflineCMSDataRequired = import.meta.env.VITE_OFFLINE_CMS
  ? import.meta.env.VITE_OFFLINE_CMS
  : true;

export const CONTENT_MAPPING_STATUS: ObjectType = {
  '1': 'Mapped',
  '2': 'Updated',
  '3': 'Failed',
  '4': 'All',
};
export const STATUS_ICON_Mapping: { [key: string]: string } = {
  '1': 'CheckedCircle',
  '2': 'SuccessInverted',
  '3': 'ErrorInverted',
};

export const VALIDATION_DOCUMENTATION_URL: { [key: string]: string } = {
  sitecore: 'https://assets.contentstack.io/v3/assets/blt2dcc0c8ab6561828/blt6e43a345b3534a56/6a2fd47d19783a6acde0c5a3/Sitecore_Data_Requirements_Documentation.pdf',
  contentful: 'https://assets.contentstack.io/v3/assets/blt2dcc0c8ab6561828/blt761d4a5006b06da4/6a2fd47e8597ceecdc382158/Contentful_Data_Requirements_Documentation.pdf',
  wordpress: 'https://assets.contentstack.io/v3/assets/blt2dcc0c8ab6561828/blt60f1fa9c83fef6dc/6a2fd67cdb6e4a59628c8b1c/Wordpress_Data_Requirements_Documentation.pdf',
  drupal: 'https://assets.contentstack.io/v3/assets/blt2dcc0c8ab6561828/blt78752669cf639062/6a2fd6741c149abcb8a462b4/Drupal_Data_Requirements_Documentation.pdf',
  aem: 'https://assets.contentstack.io/v3/assets/blte253f53eb72b3dfe/blt4bb5754f90c64170/6a54c7b2b3e39982cfe675fa/AEM_Data_Requirements_Documentation.pdf'
};


export const auditLogsConstants = {
  executeTestMigration: 'Try executing the migration',
  selectModuleMessage: 'Select a module to see the logs',
  queryChangeMessage: 'Try changing the search query to find what you are looking for.',
  noResult: 'No matching result found',
  noLogs: 'No logs',
  filterIcon: {
    filterOn: 'filterWithAppliedIcon Icon--v2 Icon--medium',
    filterOff: 'filterWithAppliedIcon Icon--v2 Icon--medium Icon--disabled'
  },

  placeholders: {
    selectStack: 'Select Stack',
    selectModule: 'Select Module',
    searchLogs: 'Search Audit Logs',
  },

  emptyStateIcon: {
    noLogs: 'NoDataEmptyState',
    noMatch: 'NoSearchResult'
  },
  filterModal: {
    noFilterAvailable: 'No Filters Available',
    clearAll: 'Clear All',
    apply: 'Apply',
    displayType: 'Display Type',
    selectFieldType: 'Select Field Data Type',
    entries: 'Entries',
  }
};

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

export const EXECUTION_LOGS_UI_TEXT = {
  SEARCH_PLACEHOLDER: 'Search Execution Logs',
  SELECT_PLACEHOLDER: 'Select a stack',
  EMPTY_STATE_DESCRIPTION: {
    NO_RESULT: 'Try changing the search query to find what you are looking for.',
    NO_LOGS: 'Try executing the migration'
  },
  EMPTY_STATE_HEADING: {
    NO_LOGS: 'No logs',
    NO_MATCH: 'No matching result found'
  },
  EMPTY_STATE_ICON: {
    NO_LOGS: 'NoDataEmptyState',
    NO_MATCH: 'NoSearchResult'
  },
  FILTER_ICON: {
    FILTER_ON: 'filterWithAppliedIcon Icon--v2 Icon--medium',
    FILTER_OFF: 'defaultFilterIcon Icon--v2 Icon--medium'
  },
  VIEW_LOG: {
    VIEW_ICON: 'Eye',
    VIEW_TEXT: 'View Log'
  }
}

export const EXECUTION_LOGS_ERROR_TEXT = {
  ERROR: 'Error in Getting Migration Logs'
}

// Content Mapper (Map Content Fields step) empty-state text.
// Delta migration (iteration > 1): an empty list means there are no NEW content types — valid,
// the user can continue. Iteration 1: an empty list means content-mapper generation failed.
export const CONTENT_MAPPER_EMPTY_STATE = {
  NO_NEW_CONTENT_TYPES_HEADING: 'No new content types',
  NO_NEW_CONTENT_TYPES_DESCRIPTION:
    'There are no new content types in this file. You can still continue.',
  NO_CONTENT_TYPES_HEADING: 'No Content Types available',
  NO_CONTENT_TYPES_DESCRIPTION:
    'An error occurred while generating the content mapper. Please go to the Legacy CMS step and validate the file again.'
}

// Entry Mapper (Map Entry step) empty-state text.
export const ENTRY_MAPPER_EMPTY_STATE = {
  NO_ENTRIES_HEADING: 'No entries available for mapping',
  NO_ENTRIES_DESCRIPTION:
    'There are no entries available to map for the already-migrated content types. You can still continue.'
}

// Shared "search returned nothing" empty state for the mapper tables — mirrors the
// ExecutionLogs NO_MATCH state so a zero-result search reads consistently across the app.
export const MAPPER_SEARCH_EMPTY_STATE = {
  NO_MATCH_HEADING: 'No matching result found',
  NO_MATCH_DESCRIPTION: 'Try changing the search query to find what you are looking for.',
  NO_MATCH_ICON: 'NoSearchResult'
}

// Asset Mapper (Map Entry step → Assets tab) empty-state text.
export const ASSET_MAPPER_EMPTY_STATE = {
  NO_ASSETS_HEADING: 'No assets available for mapping',
  NO_ASSETS_DESCRIPTION:
    'There are no assets available to map for the already-migrated content. You can still continue.'
}
