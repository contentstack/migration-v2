import { HTTP_CODES, HTTP_TEXTS } from "../constants/index.js";

  /**
   * Represents an application error.
   * Extends the base AppError class.
   */
  export class AppError extends Error {
    constructor(public statusCode: number, message: string) {
      super(message);
      Object.setPrototypeOf(this, AppError.prototype);
    }
  }

  /**
   * Represents a custom error for a resource not found.
   * Extends the base AppError class.
   */
  export class NotFoundError extends AppError {
    constructor(message: string = "Not Found") {
      super(HTTP_CODES.NOT_FOUND, message);
    }
  }

  /**
   * Represents a custom error for a bad request.
   * Extends the base AppError class.
   */
  export class BadRequestError extends AppError {
    constructor(message: string = "Bad Request") {
      super(HTTP_CODES.BAD_REQUEST, message);
    }
  }

  /**
   * Represents a custom error for a database error.
   * Extends the base AppError class.
   */
  export class DatabaseError extends AppError {
    constructor(message: string = "DB error") {
      super(HTTP_CODES.SERVER_ERROR, message);
    }
  }

  /**
   * Represents a custom error for a validation error.
   * Extends the base AppError class.
   */
  export class ValidationError extends AppError {
    constructor(message: string = "User validation error") {
      super(HTTP_CODES.UNPROCESSABLE_CONTENT, message);
    }
  }

  /**
   * Represents a custom error for an internal server error.
   * Extends the base AppError class
   */
  export class InternalServerError extends AppError {
    constructor(message: string = HTTP_TEXTS.INTERNAL_ERROR) {
      super(HTTP_CODES.SERVER_ERROR, message);
    }
  }

  /**
   * Represents a custom error for an unauthorized request.
   * Extends the base AppError class
   */
  export class UnauthorizedError extends AppError {
    constructor(message: string = HTTP_TEXTS.UNAUTHORIZED) {
      super(HTTP_CODES.UNAUTHORIZED, message);
    }
  }

  /**
   * Represents a custom error for an S3 error.
   * Extends the base AppError class
   */
  export class S3Error extends AppError {
    constructor(message: string = HTTP_TEXTS.S3_ERROR) {
      super(HTTP_CODES.SERVER_ERROR, message);
    }
  }

  /**
   * Represents a custom error for a function exception.
   * Extends the base AppError class
   */
  export class ExceptionFunction extends AppError {
    constructor(message: string, httpStatus: number) {
      super(httpStatus, message);
    }
  }

  // Add more custom error classes as needed
