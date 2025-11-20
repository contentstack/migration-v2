import { ObjectType } from './constants.interface';
export const BASE_API_URL = process.env.REACT_APP_BASE_API_URL;
export const assetsRelativeUrl = 'v3/assets';
export const WEBSITE_BASE_URL = process.env.REACT_APP_WEBSITE_BASE_URL;
export const TOKEN_KEY = 'access_token';
export const TOKEN = localStorage.getItem(TOKEN_KEY);

export const API_VERSION = process.env.REACT_APP_API_VERSION ?? 'v2';

export const AUTH_ROUTES = `${API_VERSION}/auth`;

export const LOGIN_SUCCESSFUL_MESSAGE = 'Login Successful.';
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

export const UPLOAD_FILE_RELATIVE_URL = process.env.REACT_APP_UPLOAD_SERVER;

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

export const isOfflineCMSDataRequired = process.env.REACT_APP_OFFLINE_CMS
  ? process.env.REACT_APP_OFFLINE_CMS
  : true;

export const CONTENT_MAPPING_STATUS: ObjectType = {
  '1': 'Mapped',
  '2': 'Updated',
  '3': 'Failed',
  '4': 'All'
  // '4': 'Auto-Dump'
};
export const STATUS_ICON_Mapping: { [key: string]: string } = {
  '1': 'CheckedCircle',
  '2': 'SuccessInverted',
  '3': 'ErrorInverted'
  // '4': 'completed'
};

export const VALIDATION_DOCUMENTATION_URL: { [key: string]: string } = {
  sitecore:
    'https://assets.contentstack.io/v3/assets/bltc09cefc19ddf033f/blt287e42b58e38e2b6/67ee3fb57c35f2e42c997000/sitecore.pdf',
  contentful:
    'https://assets.contentstack.io/v3/assets/bltc09cefc19ddf033f/bltb14c2df7c5e202ba/67ee3fcdb509b76f5f308ac4/contentful.pdf',
  wordpress: '',
  drupal: '',
  aem: 'https://assets.contentstack.io/v3/assets/bltc09cefc19ddf033f/blt3df735914488e75d/AEM%20Data%20Requirements.pdf'
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
