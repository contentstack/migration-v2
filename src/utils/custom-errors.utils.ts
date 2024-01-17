import { constants } from "../constants";

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Not Found") {
    super(constants.HTTP_CODES.NOT_FOUND, message);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad Request") {
    super(constants.HTTP_CODES.BAD_REQUEST, message);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = "DB error") {
    super(constants.HTTP_CODES.SERVER_ERROR, message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "User validation error") {
    super(constants.HTTP_CODES.FORBIDDEN, message);
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = constants.HTTP_TEXTS.INTERNAL_ERROR) {
    super(constants.HTTP_CODES.SERVER_ERROR, message);
  }
}

// Add more custom error classes as needed
