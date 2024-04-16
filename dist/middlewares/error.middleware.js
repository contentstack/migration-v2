"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = void 0;
const custom_errors_utils_1 = require("../utils/custom-errors.utils");
const logger_1 = __importDefault(require("../utils/logger"));
const errorMiddleware = (err, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
next) => {
    if (err instanceof custom_errors_utils_1.AppError) {
        res
            .status(err.statusCode)
            .json({ error: { code: err.statusCode, message: err.message } });
    }
    else {
        // Log the error
        logger_1.default.error(err.stack);
        res
            .status(500)
            .json({ error: { code: 500, message: "Internal Server Error" } });
    }
};
exports.errorMiddleware = errorMiddleware;
