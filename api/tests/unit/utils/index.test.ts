import { describe, it, expect, vi } from 'vitest';
import { throwError, isEmpty, safePromise, getLogMessage } from '../../../src/utils/index.js';

describe('utils/index', () => {
  describe('throwError', () => {
    it('should throw an error with the given message and statusCode', () => {
      expect(() => throwError('Not found', 404)).toThrow('Not found');
      try {
        throwError('Server error', 500);
      } catch (e: any) {
        expect(e.statusCode).toBe(500);
        expect(e.message).toBe('Server error');
      }
    });
  });

  describe('isEmpty', () => {
    it('should return true for undefined', () => {
      expect(isEmpty(undefined)).toBe(true);
    });

    it('should return true for null', () => {
      expect(isEmpty(null)).toBe(true);
    });

    it('should return true for empty object', () => {
      expect(isEmpty({})).toBe(true);
    });

    it('should return true for empty string', () => {
      expect(isEmpty('')).toBe(true);
    });

    it('should return true for whitespace-only string', () => {
      expect(isEmpty('   ')).toBe(true);
    });

    it('should return false for non-empty string', () => {
      expect(isEmpty('hello')).toBe(false);
    });

    it('should return false for non-empty object', () => {
      expect(isEmpty({ key: 'value' })).toBe(false);
    });

    it('should return false for numbers', () => {
      expect(isEmpty(0)).toBe(false);
      expect(isEmpty(42)).toBe(false);
    });

    it('should return false for boolean', () => {
      expect(isEmpty(false)).toBe(false);
    });

    it('should return true for empty array', () => {
      expect(isEmpty([])).toBe(true);
    });

    it('should return false for symbol', () => {
      expect(isEmpty(Symbol('x'))).toBe(false);
    });
  });

  describe('safePromise', () => {
    it('should resolve to [null, result] on success', async () => {
      const result = await safePromise(Promise.resolve('data'));
      expect(result).toEqual([null, 'data']);
    });

    it('should resolve to [error] on failure', async () => {
      const error = new Error('fail');
      const result = await safePromise(Promise.reject(error));
      expect(result).toEqual([error]);
    });
  });

  describe('getLogMessage', () => {
    it('should return correct log object shape', () => {
      const log = getLogMessage('testMethod', 'test message');
      expect(log).toEqual({
        methodName: 'testMethod',
        message: 'test message',
        user: {},
      });
    });

    it('should include user when provided', () => {
      const user = { id: '123' };
      const log = getLogMessage('testMethod', 'test message', user);
      expect(log.user).toEqual(user);
    });

    it('should include error when provided', () => {
      const error = new Error('test error');
      const log = getLogMessage('testMethod', 'test message', {}, error);
      expect(log.error).toBe(error);
    });

    it('should not include error key when error is not provided', () => {
      const log = getLogMessage('testMethod', 'test message');
      expect(log).not.toHaveProperty('error');
    });

    it('omits user spread when user is null', () => {
      const log = getLogMessage('testMethod', 'test message', null as unknown as Record<string, never>);
      expect(log).not.toHaveProperty('user');
    });

    it('omits error spread when error is falsy', () => {
      const log = getLogMessage('testMethod', 'test message', {}, 0 as unknown as undefined);
      expect(log).not.toHaveProperty('error');
    });
  });
});
