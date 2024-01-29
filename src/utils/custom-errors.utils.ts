import { constants } from "../constants";

export class AppError extends Error {
  srcFunc: string;
  constructor(
    public statusCode: number,
    message: string,
    srcFunc: string = ""
  ) {
    super(message);
    this.srcFunc = srcFunc;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = "Not Found", srcFunc: string = "") {
    super(constants.HTTP_CODES.NOT_FOUND, message, srcFunc);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = "Bad Request", srcFunc: string = "") {
    super(constants.HTTP_CODES.BAD_REQUEST, message, srcFunc);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = "DB error", srcFunc: string = "") {
    super(constants.HTTP_CODES.SERVER_ERROR, message, srcFunc);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = "User validation error", srcFunc: string = "") {
    super(constants.HTTP_CODES.UNPROCESSABLE_CONTENT, message, srcFunc);
  }
}

export class InternalServerError extends AppError {
  constructor(
    message: string = constants.HTTP_TEXTS.INTERNAL_ERROR,
    srcFunc: string = ""
  ) {
    super(constants.HTTP_CODES.SERVER_ERROR, message, srcFunc);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = constants.HTTP_TEXTS.UNAUTHORIZED) {
    super(constants.HTTP_CODES.UNAUTHORIZED, message, "Auth utils");
  }
}

// Add more custom error classes as needed
