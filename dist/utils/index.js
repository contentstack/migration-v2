"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMongooseID = exports.isValidObjectId = exports.getLogMessage = exports.safePromise = exports.isEmpty = exports.throwError = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const throwError = (message, statusCode) => {
    throw Object.assign(new Error(message), { statusCode });
};
exports.throwError = throwError;
const isEmpty = (val) => val === undefined ||
    val === null ||
    (typeof val === "object" && !Object.keys(val).length) ||
    (typeof val === "string" && !val.trim().length);
exports.isEmpty = isEmpty;
const safePromise = (promise) => promise.then((res) => [null, res]).catch((err) => [err]);
exports.safePromise = safePromise;
//Generic method to get log message object
const getLogMessage = (methodName, message, user = {}, error) => {
    return {
        methodName,
        message,
        ...(user && { user }),
        ...(error && { error }),
    };
};
exports.getLogMessage = getLogMessage;
const isValidObjectId = (id) => mongoose_1.default.isValidObjectId(id);
exports.isValidObjectId = isValidObjectId;
const getMongooseID = () => new mongoose_1.default.Types.ObjectId();
exports.getMongooseID = getMongooseID;
