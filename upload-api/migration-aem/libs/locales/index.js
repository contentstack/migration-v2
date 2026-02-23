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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const fs_readdir_recursive_1 = __importDefault(require("fs-readdir-recursive"));
const helper_1 = require("../../helper");
const constant_1 = require("../../constant");
const processLocales = (dirPath) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    var _d, _e;
    const localesDir = path_1.default.resolve(dirPath);
    const localeFiles = (0, fs_readdir_recursive_1.default)(localesDir);
    const damPath = (_d = path_1.default === null || path_1.default === void 0 ? void 0 : path_1.default.resolve) === null || _d === void 0 ? void 0 : _d.call(path_1.default, (_e = path_1.default === null || path_1.default === void 0 ? void 0 : path_1.default.join) === null || _e === void 0 ? void 0 : _e.call(path_1.default, localesDir, constant_1.CONSTANTS.AEM_DAM_DIR));
    const allLocales = [];
    try {
        for (var _f = true, localeFiles_1 = __asyncValues(localeFiles), localeFiles_1_1; localeFiles_1_1 = yield localeFiles_1.next(), _a = localeFiles_1_1.done, !_a; _f = true) {
            _c = localeFiles_1_1.value;
            _f = false;
            const fileName = _c;
            const filePath = path_1.default.join(localesDir, fileName);
            if (filePath.startsWith(damPath)) {
                continue;
            }
            const localeData = yield (0, helper_1.readFiles)(filePath);
            if (localeData === null || localeData === void 0 ? void 0 : localeData.language) {
                allLocales.push(localeData === null || localeData === void 0 ? void 0 : localeData.language);
            }
            else if (localeData === null || localeData === void 0 ? void 0 : localeData[":path"]) {
                const segments = localeData[":path"].split("/");
                const locale = segments[segments.length - 1];
                allLocales.push(locale);
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_f && !_a && (_b = localeFiles_1.return)) yield _b.call(localeFiles_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return Array.from(new Set(allLocales));
});
const locales = () => {
    return {
        processAndSave: (dirPath) => __awaiter(void 0, void 0, void 0, function* () {
            return yield processLocales(dirPath);
        })
    };
};
exports.default = locales;
