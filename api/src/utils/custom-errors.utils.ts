import { HTTP_CODES, HTTP_TEXTS } from "../constants/index.js";

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Not Found") {
    super(HTTP_CODES.NOT_FOUND, message);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad Request") {
    super(HTTP_CODES.BAD_REQUEST, message);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = "DB error") {
    super(HTTP_CODES.SERVER_ERROR, message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "User validation error") {
    super(HTTP_CODES.UNPROCESSABLE_CONTENT, message);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = HTTP_TEXTS.INTERNAL_ERROR) {
    super(HTTP_CODES.SERVER_ERROR, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = HTTP_TEXTS.UNAUTHORIZED) {
    super(HTTP_CODES.UNAUTHORIZED, message);
  }
}

export class S3Error extends AppError {
  constructor(message: string = HTTP_TEXTS.S3_ERROR) {
    super(HTTP_CODES.SERVER_ERROR, message);
  }
}

export class ExceptionFunction extends AppError {
  constructor(message: string, httpStatus: number) {
    super(httpStatus, message);
  }
}

// Add more custom error classes as needed
