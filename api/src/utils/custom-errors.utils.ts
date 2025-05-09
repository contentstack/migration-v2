import { HTTP_CODES, HTTP_TEXTS } from "../constants/index.js";

export class AppError extends Error {
  /**
   * Custom Error class for handling application errors.
   */
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
  /**
   * Creates a new instance of NotFoundError.
   * @param message - The error message. Defaults to "Not Found".
   */
  constructor(message: string = "Not Found") {
    super(HTTP_CODES.NOT_FOUND, message);
  }
}

/**
 * Represents a custom error for a bad request.
 * Extends the base AppError class.
 */
export class BadRequestError extends AppError {
  /**
   * Creates a new instance of the BadRequestError class.
   * @param message The error message.
   */
  constructor(message: string = "Bad Request") {
    super(HTTP_CODES.BAD_REQUEST, message);
  }
}

/**
 * Represents a custom error related to database operations.
 * Extends the base AppError class.
 */
export class DatabaseError extends AppError {
  /**
   * Creates a new instance of the DatabaseError class.
   * @param message The error message.
   */
  constructor(message: string = "DB error") {
    super(HTTP_CODES.SERVER_ERROR, message);
  }
}

/**
 * Represents a validation error that occurs during user validation.
 * Extends the base AppError class.
 */
export class ValidationError extends AppError {
  /**
   * Creates a new instance of the ValidationError class.
   * @param message The error message associated with the validation error. Defaults to "User validation error".
   */
  constructor(message: string = "User validation error") {
    super(HTTP_CODES.UNPROCESSABLE_CONTENT, message);
  }
}

/**
 * Represents an Internal Server Error.
 * This error is thrown when there is an internal server error in the application.
 */
export class InternalServerError extends AppError {
  /**
   * Creates a new instance of the InternalServerError class.
   * @param message The error message.
   */
  constructor(message: string = HTTP_TEXTS.INTERNAL_ERROR) {
    super(HTTP_CODES.SERVER_ERROR, message);
  }
}

/**
 * Represents an error that occurs when a user is unauthorized to access a resource.
 * Extends the base AppError class.
 */
export class UnauthorizedError extends AppError {
  /**
   * Creates a new instance of the UnauthorizedError class.
   * @param message The error message. Defaults to the "Unauthorized" HTTP text.
   */
  constructor(message: string = HTTP_TEXTS.UNAUTHORIZED) {
    super(HTTP_CODES.UNAUTHORIZED, message);
  }
}

/**
 * Represents an error related to S3 operations.
 * Extends the base AppError class.
 */
export class S3Error extends AppError {
  /**
   * Creates a new instance of the S3Error class.
   * @param message The error message. Defaults to HTTP_TEXTS.S3_ERROR.
   */
  constructor(message: string = HTTP_TEXTS.S3_ERROR) {
    super(HTTP_CODES.SERVER_ERROR, message);
  }
}

/**
 * Represents an ExceptionFunction class that extends the AppError class.
 * This class is used to create custom exceptions with a specific HTTP status code.
 */
export class ExceptionFunction extends AppError {
  /**
   * Creates a new instance of the ExceptionFunction class.
   * @param message - The error message.
   * @param httpStatus - The HTTP status code associated with the exception.
   */
  constructor(message: string, httpStatus: number) {
    super(httpStatus, message);
  }
}

// Add more custom error classes as needed
