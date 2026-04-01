"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractEntries = exports.extractLocale = exports.extractContentTypes = void 0;
const contentTypes_1 = __importDefault(require("./libs/contentTypes"));
exports.extractContentTypes = contentTypes_1.default;
//import contentTypeMaker from './libs/contentTypeMapper';
const extractLocale_1 = __importDefault(require("./libs/extractLocale"));
exports.extractLocale = extractLocale_1.default;
const extractEntries_1 = __importDefault(require('./libs/extractEntries'));
exports.extractEntries = extractEntries_1.default;
