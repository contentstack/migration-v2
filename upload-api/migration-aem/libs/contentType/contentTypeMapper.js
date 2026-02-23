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
const componentHandler_1 = __importDefault(require("../../componentMaker/componentHandler"));
const componentTracker_1 = __importDefault(require("../../componentMaker/componentTracker"));
const helper_1 = require("../../helper");
const contentTypeProcessor = (_a) => __awaiter(void 0, [_a], void 0, function* ({ itemSchema, affix, tracker }) {
    var _b, e_1, _c, _d;
    var _e, _f;
    const fieldTypes = itemSchema === null || itemSchema === void 0 ? void 0 : itemSchema[':itemsOrder'];
    try {
        for (var _g = true, _h = __asyncValues(fieldTypes !== null && fieldTypes !== void 0 ? fieldTypes : []), _j; _j = yield _h.next(), _b = _j.done, !_b; _g = true) {
            _d = _j.value;
            _g = false;
            const field = _d;
            const item = (_e = itemSchema === null || itemSchema === void 0 ? void 0 : itemSchema[":items"]) === null || _e === void 0 ? void 0 : _e[field];
            const type = (_f = (0, helper_1.extractComponentPath)(item === null || item === void 0 ? void 0 : item[":type"])) !== null && _f !== void 0 ? _f : null;
            yield contentTypeProcessor({ itemSchema: item, affix, tracker });
            type && tracker.pushComponent({ component: type, props: item !== null && item !== void 0 ? item : {} });
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_g && !_b && (_c = _h.return)) yield _c.call(_h);
        }
        finally { if (e_1) throw e_1.error; }
    }
});
const contentTypeMappers = (_a) => __awaiter(void 0, [_a], void 0, function* ({ templateData, affix }) {
    var _b, _c;
    const tracker = new componentTracker_1.default([
        new componentHandler_1.default(),
    ]);
    // The ':itemsOrder' key is from AEM template structure and not a secret
    for (const key of (_b = templateData === null || templateData === void 0 ? void 0 : templateData[':itemsOrder']) !== null && _b !== void 0 ? _b : []) {
        // The ':items' key is from AEM template structure and not a secret
        const item = (_c = templateData === null || templateData === void 0 ? void 0 : templateData[":items"]) === null || _c === void 0 ? void 0 : _c[key];
        yield contentTypeProcessor({ itemSchema: item, affix, tracker });
    }
    return tracker;
});
exports.default = contentTypeMappers;
