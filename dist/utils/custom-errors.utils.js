"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExceptionFunction = exports.UnauthorizedError = exports.InternalServerError = exports.ValidationError = exports.DatabaseError = exports.BadRequestError = exports.NotFoundError = exports.AppError = void 0;
const constants_1 = require("../constants");
class AppError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
class NotFoundError extends AppError {
    constructor(message = "Not Found") {
        super(constants_1.HTTP_CODES.NOT_FOUND, message);
    }
}
exports.NotFoundError = NotFoundError;
class BadRequestError extends AppError {
    constructor(message = "Bad Request") {
        super(constants_1.HTTP_CODES.BAD_REQUEST, message);
    }
}
exports.BadRequestError = BadRequestError;
class DatabaseError extends AppError {
    constructor(message = "DB error") {
        super(constants_1.HTTP_CODES.SERVER_ERROR, message);
    }
}
exports.DatabaseError = DatabaseError;
class ValidationError extends AppError {
    constructor(message = "User validation error") {
        super(constants_1.HTTP_CODES.UNPROCESSABLE_CONTENT, message);
    }
}
exports.ValidationError = ValidationError;
class InternalServerError extends AppError {
    constructor(message = constants_1.HTTP_TEXTS.INTERNAL_ERROR) {
        super(constants_1.HTTP_CODES.SERVER_ERROR, message);
    }
}
exports.InternalServerError = InternalServerError;
class UnauthorizedError extends AppError {
    constructor(message = constants_1.HTTP_TEXTS.UNAUTHORIZED) {
        super(constants_1.HTTP_CODES.UNAUTHORIZED, message);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ExceptionFunction extends AppError {
    constructor(message, httpStatus) {
        super(httpStatus, message);
    }
}
exports.ExceptionFunction = ExceptionFunction;
// Add more custom error classes as needed
