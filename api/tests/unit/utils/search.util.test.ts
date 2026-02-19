import { describe, it, expect } from 'vitest';
import { matchesSearchText } from '../../../src/utils/search.util.js';

describe('search.util', () => {
  describe('matchesSearchText', () => {
    const mockLog: any = {
      level: 'error',
      message: 'Something failed in migration',
      methodName: 'startTestMigration',
      timestamp: '2025-01-15T10:30:00.000Z',
    };

    it('should return true when searchText is empty', () => {
      expect(matchesSearchText(mockLog, '')).toBe(true);
    });

    it('should return true when searchText is "null"', () => {
      expect(matchesSearchText(mockLog, 'null')).toBe(true);
    });

    it('should match on level field', () => {
      expect(matchesSearchText(mockLog, 'error')).toBe(true);
    });

    it('should match on message field', () => {
      expect(matchesSearchText(mockLog, 'migration')).toBe(true);
    });

    it('should match on methodName field', () => {
      expect(matchesSearchText(mockLog, 'startTest')).toBe(true);
    });

    it('should match on timestamp field', () => {
      expect(matchesSearchText(mockLog, '2025-01')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(matchesSearchText(mockLog, 'ERROR')).toBe(true);
      expect(matchesSearchText(mockLog, 'Migration')).toBe(true);
    });

    it('should return false when no fields match', () => {
      expect(matchesSearchText(mockLog, 'nonexistent')).toBe(false);
    });

    it('should handle log with missing fields gracefully', () => {
      const partialLog: any = { level: 'info' };
      expect(matchesSearchText(partialLog, 'info')).toBe(true);
      expect(matchesSearchText(partialLog, 'missing')).toBe(false);
    });
  });
});
