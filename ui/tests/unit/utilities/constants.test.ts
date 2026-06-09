import { describe, it, expect } from 'vitest';
import {
  assetsRelativeUrl,
  TOKEN_KEY,
  API_VERSION,
  AUTH_ROUTES,
  LOGIN_SUCCESSFUL_MESSAGE,
  TFA_MESSAGE,
  TFA_VIA_SMS_MESSAGE,
  API_METHOD,
  REGIONS,
  CS_URL,
  HEADERS,
  CS_ENTRIES,
  PROJECT_STATUS,
  NEW_PROJECT_STATUS,
  CONTENT_MAPPING_STATUS,
  STATUS_ICON_Mapping,
  VALIDATION_DOCUMENTATION_URL,
  auditLogsConstants,
  HTTP_CODES,
  EXECUTION_LOGS_UI_TEXT,
  EXECUTION_LOGS_ERROR_TEXT
} from '../../../src/utilities/constants';

describe('utilities/constants', () => {
  it('should export assetsRelativeUrl', () => {
    expect(assetsRelativeUrl).toBe('v3/assets');
  });

  it('should export TOKEN_KEY', () => {
    expect(TOKEN_KEY).toBe('access_token');
  });

  it('should export API_VERSION from env or default', () => {
    expect(API_VERSION).toBeDefined();
  });

  it('should export AUTH_ROUTES based on API_VERSION', () => {
    expect(AUTH_ROUTES).toBe(`${API_VERSION}/auth`);
  });

  it('should export login messages', () => {
    expect(LOGIN_SUCCESSFUL_MESSAGE).toBe('Login Successful.');
    expect(TFA_MESSAGE).toBe('Please login using the Two-Factor verification Token');
    expect(TFA_VIA_SMS_MESSAGE).toBe('Two-Factor Authentication Token sent via SMS.');
  });

  it('should export API_METHOD with all HTTP methods', () => {
    expect(API_METHOD).toEqual({
      GET: 'GET',
      POST: 'POST',
      PATCH: 'PATCH',
      PUT: 'PUT',
      DELETE: 'DELETE'
    });
  });

  it('should export all REGIONS', () => {
    expect(REGIONS).toHaveProperty('NA');
    expect(REGIONS).toHaveProperty('EU');
    expect(REGIONS).toHaveProperty('AZURE_NA');
    expect(REGIONS).toHaveProperty('AZURE_EU');
    expect(REGIONS).toHaveProperty('GCP_NA');
    expect(REGIONS).toHaveProperty('GCP_EU');
    expect(REGIONS).toHaveProperty('AU');
  });

  it('should export CS_URL with URLs for all regions', () => {
    expect(CS_URL.NA).toContain('app.contentstack.com');
    expect(CS_URL.EU).toContain('eu-app.contentstack.com');
    expect(CS_URL.AU).toContain('au-app.contentstack.com');
    expect(Object.keys(CS_URL)).toHaveLength(7);
  });

  it('should export HEADERS with Content-Type', () => {
    expect(HEADERS['Content-Type']).toBe('application/json');
    expect(HEADERS).toHaveProperty('Authorization');
  });

  it('should export CS_ENTRIES with all content type keys', () => {
    expect(CS_ENTRIES.HOME_PAGE).toBe('homepage');
    expect(CS_ENTRIES.LOGIN).toBe('login');
    expect(CS_ENTRIES.PROJECTS).toBe('projects');
    expect(CS_ENTRIES.LEGACY_CMS).toBe('legacy_cms');
    expect(CS_ENTRIES.DESTINATION_STACK).toBe('destination_stack');
    expect(CS_ENTRIES.CONTENT_MAPPING).toBe('content_mapping');
    expect(CS_ENTRIES.TEST_MIGRATION).toBe('test_migration');
    expect(CS_ENTRIES.MIGRATION_EXECUTION).toBe('migration_execution');
    expect(CS_ENTRIES.SETTING).toBe('settings');
    expect(CS_ENTRIES.ERROR_HANDLER).toBe('error_handler');
    expect(CS_ENTRIES.NOT_FOUND_ERROR).toEqual({ type: 'error_handler', url: '404' });
    expect(CS_ENTRIES.INTERNAL_SERVER_ERROR).toEqual({ type: 'error_handler', url: '500' });
    expect(CS_ENTRIES.ADD_STACK).toBe('add_stack');
    expect(CS_ENTRIES.UNMAPPED_LOCALE_KEY).toBe('undefined');
  });

  it('should export PROJECT_STATUS with all statuses', () => {
    expect(PROJECT_STATUS['0']).toBe('Draft');
    expect(PROJECT_STATUS['5']).toBe('Migration successful');
    expect(PROJECT_STATUS['6']).toBe('Migration terminated');
  });

  it('should export NEW_PROJECT_STATUS with all statuses', () => {
    expect(NEW_PROJECT_STATUS['0']).toBe('Draft');
    expect(NEW_PROJECT_STATUS['5']).toBe('Completed');
    expect(NEW_PROJECT_STATUS['6']).toBe('Failed');
  });

  it('should export CONTENT_MAPPING_STATUS', () => {
    expect(CONTENT_MAPPING_STATUS['1']).toBe('Mapped');
    expect(CONTENT_MAPPING_STATUS['2']).toBe('Updated');
    expect(CONTENT_MAPPING_STATUS['3']).toBe('Failed');
    expect(CONTENT_MAPPING_STATUS['4']).toBe('All');
  });

  it('should export STATUS_ICON_Mapping', () => {
    expect(STATUS_ICON_Mapping['1']).toBe('CheckedCircle');
    expect(STATUS_ICON_Mapping['2']).toBe('SuccessInverted');
    expect(STATUS_ICON_Mapping['3']).toBe('ErrorInverted');
    expect(Object.keys(STATUS_ICON_Mapping).sort()).toEqual(['1', '2', '3']);
  });

  it('should export VALIDATION_DOCUMENTATION_URL', () => {
    expect(VALIDATION_DOCUMENTATION_URL.sitecore).toContain('sitecore.pdf');
    expect(VALIDATION_DOCUMENTATION_URL.contentful).toContain('contentful.pdf');
    expect(VALIDATION_DOCUMENTATION_URL.wordpress).toBe('');
    expect(VALIDATION_DOCUMENTATION_URL.drupal).toContain('Drupal.pdf');
    expect(VALIDATION_DOCUMENTATION_URL.aem).toContain('AEM');
  });

  it('should export auditLogsConstants', () => {
    expect(auditLogsConstants.noLogs).toBe('No logs');
    expect(auditLogsConstants.noResult).toBe('No matching result found');
    expect(auditLogsConstants.placeholders.selectStack).toBe('Select Stack');
    expect(auditLogsConstants.filterModal.apply).toBe('Apply');
  });

  it('should export HTTP_CODES', () => {
    expect(HTTP_CODES.OK).toBe(200);
    expect(HTTP_CODES.UNAUTHORIZED).toBe(401);
    expect(HTTP_CODES.FORBIDDEN).toBe(403);
    expect(HTTP_CODES.NOT_FOUND).toBe(404);
    expect(HTTP_CODES.SERVER_ERROR).toBe(500);
    expect(HTTP_CODES.UNPROCESSABLE_CONTENT).toBe(422);
  });

  it('should export EXECUTION_LOGS_UI_TEXT', () => {
    expect(EXECUTION_LOGS_UI_TEXT.SEARCH_PLACEHOLDER).toBe('Search Execution Logs');
    expect(EXECUTION_LOGS_UI_TEXT.EMPTY_STATE_HEADING.NO_LOGS).toBe('No logs');
    expect(EXECUTION_LOGS_UI_TEXT.VIEW_LOG.VIEW_TEXT).toBe('View Log');
  });

  it('should export EXECUTION_LOGS_ERROR_TEXT', () => {
    expect(EXECUTION_LOGS_ERROR_TEXT.ERROR).toBe('Error in Getting Migration Logs');
  });
});
