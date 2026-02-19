import { describe, it, expect } from 'vitest';
import { HTTP_CODES, HTTP_TEXTS, HTTP_RESPONSE_HEADERS, MIGRATION_DATA_CONFIG, MACOSX_FOLDER } from '../../../src/constants/index';

describe('constants', () => {
  describe('HTTP_CODES', () => {
    it('should have standard HTTP status codes', () => {
      expect(HTTP_CODES.OK).toBe(200);
      expect(HTTP_CODES.BAD_REQUEST).toBe(400);
      expect(HTTP_CODES.UNAUTHORIZED).toBe(401);
      expect(HTTP_CODES.FORBIDDEN).toBe(403);
      expect(HTTP_CODES.NOT_FOUND).toBe(404);
      expect(HTTP_CODES.SERVER_ERROR).toBe(500);
    });

    it('should have additional status codes', () => {
      expect(HTTP_CODES.TOO_MANY_REQS).toBe(429);
      expect(HTTP_CODES.SOMETHING_WRONG).toBe(501);
      expect(HTTP_CODES.MOVED_PERMANENTLY).toBe(301);
      expect(HTTP_CODES.SUPPORT_DOC).toBe(294);
      expect(HTTP_CODES.UNPROCESSABLE_CONTENT).toBe(422);
    });
  });

  describe('HTTP_TEXTS', () => {
    it('should have error message strings', () => {
      expect(HTTP_TEXTS.UNAUTHORIZED).toContain('unauthorized');
      expect(HTTP_TEXTS.INTERNAL_ERROR).toContain('Internal server error');
      expect(HTTP_TEXTS.ROUTE_ERROR).toContain('not available');
      expect(HTTP_TEXTS.SOMETHING_WENT_WRONG).toContain('Something went wrong');
    });

    it('should have validation messages', () => {
      expect(HTTP_TEXTS.VALIDATION_ERROR).toContain('validation failed');
      expect(HTTP_TEXTS.VALIDATION_SUCCESSFULL).toContain('validated successfully');
    });

    it('should have file operation messages', () => {
      expect(HTTP_TEXTS.ZIP_FILE_SAVE).toBeDefined();
      expect(HTTP_TEXTS.XML_FILE_SAVE).toBeDefined();
      expect(HTTP_TEXTS.S3_ERROR).toBeDefined();
    });

    it('should have mapper and locale messages', () => {
      expect(HTTP_TEXTS.MAPPER_SAVED).toContain('completed');
      expect(HTTP_TEXTS.LOCALE_SAVED).toContain('locales');
      expect(HTTP_TEXTS.LOCALE_FAILED).toContain('Unable');
    });
  });

  describe('HTTP_RESPONSE_HEADERS', () => {
    it('should have CORS and content-type headers', () => {
      expect(HTTP_RESPONSE_HEADERS['Access-Control-Allow-Origin']).toBe('*');
      expect(HTTP_RESPONSE_HEADERS['Content-Type']).toBe('application/json');
      expect(HTTP_RESPONSE_HEADERS.Connection).toBe('close');
    });
  });

  describe('MIGRATION_DATA_CONFIG', () => {
    it('should have data folder configurations', () => {
      expect(MIGRATION_DATA_CONFIG.DATA).toBe('cmsMigrationData');
      expect(MIGRATION_DATA_CONFIG.BACKUP_DATA).toBe('migration-data');
    });

    it('should have locale configurations', () => {
      expect(MIGRATION_DATA_CONFIG.LOCALE_DIR_NAME).toBe('locale');
      expect(MIGRATION_DATA_CONFIG.LOCALE_FILE_NAME).toBe('locales.json');
      expect(MIGRATION_DATA_CONFIG.LOCALE_MASTER_LOCALE).toBe('master-locale.json');
    });

    it('should have content type configurations', () => {
      expect(MIGRATION_DATA_CONFIG.CONTENT_TYPES_DIR_NAME).toBe('content_types');
      expect(MIGRATION_DATA_CONFIG.CONTENT_TYPES_FILE_NAME).toBe('contenttype.json');
    });

    it('should have asset configurations', () => {
      expect(MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME).toBe('assets');
      expect(MIGRATION_DATA_CONFIG.ASSETS_FILE_NAME).toBe('assets.json');
    });

    it('should have entries and global field configurations', () => {
      expect(MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME).toBe('entries');
      expect(MIGRATION_DATA_CONFIG.GLOBAL_FIELDS_DIR_NAME).toBe('global_fields');
    });
  });

  describe('MACOSX_FOLDER', () => {
    it('should be __MACOSX', () => {
      expect(MACOSX_FOLDER).toBe('__MACOSX');
    });
  });
});
