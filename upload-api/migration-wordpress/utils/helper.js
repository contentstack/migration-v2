"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const mkdirp_1 = __importDefault(require("mkdirp"));
const xml2js_1 = __importDefault(require("xml2js"));
const chalk_1 = __importDefault(require("chalk"));
const readXMLFile = function (filePath) {
    var data;
    if (fs_1.default.existsSync(filePath))
        data = fs_1.default.readFileSync(filePath, 'utf-8');
    return data;
};
const parseXmlToJson = (xml) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const parser = new xml2js_1.default.Parser({
            attrkey: 'attributes',
            charkey: 'text',
            explicitArray: false
        });
        return yield parser.parseStringPromise(xml);
    }
    catch (err) {
        console.log(chalk_1.default.red(`Error parsing XML: ${err.message}`));
        return null;
    }
});
const writeFileAsync = function (filePath, data, tabSpaces) {
    return __awaiter(this, void 0, void 0, function* () {
        filePath = path_1.default.resolve(filePath);
        data = typeof data == 'object' ? JSON.stringify(data, null, tabSpaces) : data || '{}';
        yield fs_1.default.promises.writeFile(filePath, data, 'utf-8');
    });
};
const readFile = function (filePath, parse) {
    parse = typeof parse == 'undefined' ? true : parse;
    filePath = path_1.default.resolve(filePath);
    var data;
    if (fs_1.default.existsSync(filePath))
        data = parse ? JSON.parse(fs_1.default.readFileSync(filePath, 'utf-8')) : data;
    return data;
};
const writeFile = function (filePath, data) {
    filePath = path_1.default.resolve(filePath);
    data = typeof data == 'object' ? JSON.stringify(data) : data || '{}';
    fs_1.default.writeFileSync(filePath, data, 'utf-8');
};
const appendFile = function (filePath, data) {
    filePath = path_1.default.resolve(filePath);
    fs_1.default.appendFileSync(filePath, data);
};
const makeDirectory = function () {
    for (var key in arguments) {
        var dirname = path_1.default.resolve(arguments[key]);
        if (!fs_1.default.existsSync(dirname))
            mkdirp_1.default.sync(dirname);
    }
};
const helper = {
    readXMLFile,
    parseXmlToJson,
    writeFileAsync,
    readFile,
    writeFile,
    appendFile,
    makeDirectory
};
exports.default = helper;
