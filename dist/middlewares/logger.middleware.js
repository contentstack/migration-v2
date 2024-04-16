"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_winston_1 = __importDefault(require("express-winston"));
const logger_1 = __importDefault(require("../utils/logger"));
//Logger Middleware to log every request
const loggerMiddleware = express_winston_1.default.logger({
    level: "info",
    colorize: true,
    winstonInstance: logger_1.default,
    headerBlacklist: [
        "app_token",
        "access_token",
        "authorization",
        "secret_key",
        "secret",
    ],
    metaField: null,
});
exports.default = loggerMiddleware;
