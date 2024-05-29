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
  AZURE_EU: 'AZURE_EU'
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
  ADD_STACK: 'add_stack'
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

export const isOfflineCMSDataRequired = process.env.REACT_APP_OFFLINE_CMS
  ? process.env.REACT_APP_OFFLINE_CMS
  : true;
