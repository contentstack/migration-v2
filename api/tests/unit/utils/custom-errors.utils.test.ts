import { describe, it, expect } from 'vitest';
import {
  AppError,
  NotFoundError,
  BadRequestError,
  DatabaseError,
  ValidationError,
  InternalServerError,
  UnauthorizedError,
  S3Error,
  ExceptionFunction,
} from '../../../src/utils/custom-errors.utils.js';

describe('Custom Error Classes', () => {
  describe('AppError', () => {
    it('should create an error with statusCode and message', () => {
      const error = new AppError(418, 'I am a teapot');
      expect(error.statusCode).toBe(418);
      expect(error.message).toBe('I am a teapot');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('NotFoundError', () => {
    it('should default to 404 and "Not Found"', () => {
      const error = new NotFoundError();
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Not Found');
      expect(error).toBeInstanceOf(AppError);
    });

    it('should accept a custom message', () => {
      const error = new NotFoundError('Resource missing');
      expect(error.statusCode).toBe(404);
      expect(error.message).toBe('Resource missing');
    });
  });

  describe('BadRequestError', () => {
    it('should default to 400 and "Bad Request"', () => {
      const error = new BadRequestError();
      expect(error.statusCode).toBe(400);
      expect(error.message).toBe('Bad Request');
      expect(error).toBeInstanceOf(AppError);
    });

    it('should accept a custom message', () => {
      const error = new BadRequestError('Invalid input');
      expect(error.message).toBe('Invalid input');
    });
  });

  describe('DatabaseError', () => {
    it('should default to 500 and "DB error"', () => {
      const error = new DatabaseError();
      expect(error.statusCode).toBe(500);
      expect(error.message).toBe('DB error');
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('ValidationError', () => {
    it('should default to 422 and "User validation error"', () => {
      const error = new ValidationError();
      expect(error.statusCode).toBe(422);
      expect(error.message).toBe('User validation error');
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('InternalServerError', () => {
    it('should default to 500 with internal error message', () => {
      const error = new InternalServerError();
      expect(error.statusCode).toBe(500);
      expect(error.message).toBeTruthy();
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('UnauthorizedError', () => {
    it('should default to 401', () => {
      const error = new UnauthorizedError();
      expect(error.statusCode).toBe(401);
      expect(error).toBeInstanceOf(AppError);
    });

    it('should accept a custom message', () => {
      const error = new UnauthorizedError('Token expired');
      expect(error.message).toBe('Token expired');
    });
  });

  describe('S3Error', () => {
    it('should default to 500', () => {
      const error = new S3Error();
      expect(error.statusCode).toBe(500);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('ExceptionFunction', () => {
    it('should accept custom message and status', () => {
      const error = new ExceptionFunction('Custom error', 503);
      expect(error.statusCode).toBe(503);
      expect(error.message).toBe('Custom error');
      expect(error).toBeInstanceOf(AppError);
    });
  });
});
