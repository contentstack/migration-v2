"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validator = exports.locales = exports.contentTypes = void 0;
const contentType_1 = __importDefault(require("./libs/contentType"));
exports.contentTypes = contentType_1.default;
const locales_1 = __importDefault(require("./libs/locales"));
exports.locales = locales_1.default;
const validate_1 = __importDefault(require("./libs/validate"));
exports.validator = validate_1.default;
