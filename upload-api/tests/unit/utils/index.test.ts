import { describe, it, expect } from 'vitest';
import { getLogMessage, safePromise } from '../../../src/utils/index';

describe('utils/index', () => {
  describe('getLogMessage', () => {
    it('should return a log message object with methodName and message', () => {
      const result = getLogMessage('testMethod', 'test message');
      expect(result.methodName).toBe('testMethod');
      expect(result.message).toBe('test message');
    });

    it('should include user when provided', () => {
      const user = { id: 'user-1', name: 'Test' };
      const result = getLogMessage('testMethod', 'test message', user);
      expect(result.user).toEqual(user);
    });

    it('should include error when provided', () => {
      const error = new Error('test error');
      const result = getLogMessage('testMethod', 'test message', {}, error);
      expect(result.error).toBe(error);
      expect(result.methodName).toBe('testMethod');
    });

    it('should include both user and error when provided', () => {
      const user = { id: 'user-1' };
      const error = new Error('fail');
      const result = getLogMessage('testMethod', 'test message', user, error);
      expect(result.user).toEqual(user);
      expect(result.error).toBe(error);
    });

    it('should include user with default empty object', () => {
      const result = getLogMessage('testMethod', 'msg');
      expect(result).toHaveProperty('methodName', 'testMethod');
      expect(result).toHaveProperty('message', 'msg');
    });

    it('should not include error when not provided', () => {
      const result = getLogMessage('method', 'msg');
      expect(result).not.toHaveProperty('error');
    });
  });

  describe('safePromise', () => {
    it('should return [null, result] on resolved promise', async () => {
      const [err, result] = await safePromise(Promise.resolve('success'));
      expect(err).toBeNull();
      expect(result).toBe('success');
    });

    it('should return [error] on rejected promise', async () => {
      const error = new Error('fail');
      const [err, result] = await safePromise(Promise.reject(error));
      expect(err).toBe(error);
      expect(result).toBeUndefined();
    });

    it('should handle promise resolving with undefined', async () => {
      const [err, result] = await safePromise(Promise.resolve(undefined));
      expect(err).toBeNull();
      expect(result).toBeUndefined();
    });

    it('should handle promise resolving with null', async () => {
      const [err, result] = await safePromise(Promise.resolve(null));
      expect(err).toBeNull();
      expect(result).toBeNull();
    });
  });
});
