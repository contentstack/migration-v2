import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/utilities/constants', () => ({
  CS_ENTRIES: {
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
    NOT_FOUND_ERROR: { type: 'error_handler', url: '404' },
    INTERNAL_SERVER_ERROR: { type: 'error_handler', url: '500' },
    ERROR_HANDLER: 'error_handler',
    ADD_STACK: 'add_stack',
    UNMAPPED_LOCALE_KEY: 'undefined'
  },
  BASE_API_URL: 'http://localhost:5001/',
  TOKEN_KEY: 'access_token',
  TOKEN: null,
  HEADERS: {}
}));

import { getCMSDataFromFile } from '../../../src/cmsData/cmsSelector';

describe('cmsData/cmsSelector', () => {
  describe('getCMSDataFromFile', () => {
    it('should return homepage data for HOME_PAGE content type', async () => {
      const result = await getCMSDataFromFile('homepage');
      expect(result).toBeDefined();
    });

    it('should return login data for LOGIN content type', async () => {
      const result = await getCMSDataFromFile('login');
      expect(result).toBeDefined();
    });

    it('should return region login data for REGIONS content type', async () => {
      const result = await getCMSDataFromFile('region_login');
      expect(result).toBeDefined();
    });

    it('should return main header data for MAIN_HEADER content type', async () => {
      const result = await getCMSDataFromFile('main_header');
      expect(result).toBeDefined();
    });

    it('should return projects data for PROJECTS content type', async () => {
      const result = await getCMSDataFromFile('projects');
      expect(result).toBeDefined();
    });

    it('should return legacy CMS data for LEGACY_CMS content type', async () => {
      const result = await getCMSDataFromFile('legacy_cms');
      expect(result).toBeDefined();
    });

    it('should return destination stack data for DESTINATION_STACK content type', async () => {
      const result = await getCMSDataFromFile('destination_stack');
      expect(result).toBeDefined();
    });

    it('should return add stack data for ADD_STACK content type', async () => {
      const result = await getCMSDataFromFile('add_stack');
      expect(result).toBeDefined();
    });

    it('should return migration steps data for MIGRATION_FLOW content type', async () => {
      const result = await getCMSDataFromFile('migration_steps');
      expect(result).toBeDefined();
    });

    it('should return content mapping data for CONTENT_MAPPING content type', async () => {
      const result = await getCMSDataFromFile('content_mapping');
      expect(result).toBeDefined();
    });

    it('should return test migration data for TEST_MIGRATION content type', async () => {
      const result = await getCMSDataFromFile('test_migration');
      expect(result).toBeDefined();
    });

    it('should return migration execution data for MIGRATION_EXECUTION content type', async () => {
      const result = await getCMSDataFromFile('migration_execution');
      expect(result).toBeDefined();
    });

    it('should return settings data for SETTING content type', async () => {
      const result = await getCMSDataFromFile('settings');
      expect(result).toBeDefined();
    });

    it('should return 500 error data for ERROR_HANDLER with 500 url', async () => {
      const result = await getCMSDataFromFile('error_handler', '500');
      expect(result).toBeDefined();
    });

    it('should return 404 error data for ERROR_HANDLER with 404 url', async () => {
      const result = await getCMSDataFromFile('error_handler', '404');
      expect(result).toBeDefined();
    });

    it('should return undefined for unknown content type', async () => {
      const result = await getCMSDataFromFile('unknown_type');
      expect(result).toBeUndefined();
    });
  });
});
