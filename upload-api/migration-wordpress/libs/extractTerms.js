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
const generate_schema_1 = __importDefault(require("generate-schema"));
const schemaMapper_1 = require("./schemaMapper");
const helper_1 = __importDefault(require("../utils/helper"));
const index_json_1 = __importDefault(require("../config/index.json"));
const path_1 = __importDefault(require("path"));
const { contentTypes: contentTypesConfig } = index_json_1.default.modules;
const contentTypeFolderPath = path_1.default.resolve(index_json_1.default.data, contentTypesConfig.dirName);
const handleAuthorSchema = (author) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const schema = generate_schema_1.default.json("schema", author);
    const properties = (_b = (_a = schema === null || schema === void 0 ? void 0 : schema.items) === null || _a === void 0 ? void 0 : _a.properties) !== null && _b !== void 0 ? _b : schema === null || schema === void 0 ? void 0 : schema.properties;
    const Authorschema = yield (0, schemaMapper_1.handleAttributesSchema)(properties, null, 'Author');
    return Authorschema;
});
const extractTerms = (allTerms, type) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    if ((allTerms === null || allTerms === void 0 ? void 0 : allTerms.length) > 0) {
        const terms = {
            "status": 1,
            "isUpdated": false,
            "updateAt": "",
            "otherCmsTitle": type,
            "otherCmsUid": type,
            "contentstackTitle": type,
            "contentstackUid": type,
            "type": "content_type",
            "fieldMapping": [{
                    "isDeleted": false,
                    "uid": "title",
                    "backupFieldUid": "title",
                    "otherCmsField": "title",
                    "otherCmsType": "text",
                    "contentstackField": "title",
                    "contentstackFieldUid": "title",
                    "contentstackFieldType": "text",
                    "backupFieldType": "text",
                    "advanced": {
                        "mandatory": true
                    }
                },
                {
                    "isDeleted": false,
                    "uid": "url",
                    "otherCmsField": "url",
                    "backupFieldUid": "url",
                    "otherCmsType": "text",
                    "contentstackField": "Url",
                    "contentstackFieldUid": "url",
                    "contentstackFieldType": "url",
                    "backupFieldType": "url",
                    "advanced": {
                        "mandatory": true
                    }
                }]
        };
        if (Array.isArray(allTerms)) {
            const fields = yield handleAuthorSchema(allTerms === null || allTerms === void 0 ? void 0 : allTerms[0]);
            (_a = terms === null || terms === void 0 ? void 0 : terms.fieldMapping) === null || _a === void 0 ? void 0 : _a.push(...fields.map(field => {
                var _a, _b;
                return (Object.assign(Object.assign({}, field), { isDeleted: false, advanced: Object.assign(Object.assign({}, field === null || field === void 0 ? void 0 : field.advanced), { mandatory: (_b = (_a = field === null || field === void 0 ? void 0 : field.advanced) === null || _a === void 0 ? void 0 : _a.mandatory) !== null && _b !== void 0 ? _b : false }) }));
            }));
        }
        else {
            const fields = yield handleAuthorSchema(allTerms);
            (_b = terms === null || terms === void 0 ? void 0 : terms.fieldMapping) === null || _b === void 0 ? void 0 : _b.push(...fields.map(field => {
                var _a, _b;
                return (Object.assign(Object.assign({}, field), { isDeleted: false, advanced: Object.assign(Object.assign({}, field === null || field === void 0 ? void 0 : field.advanced), { mandatory: (_b = (_a = field === null || field === void 0 ? void 0 : field.advanced) === null || _a === void 0 ? void 0 : _a.mandatory) !== null && _b !== void 0 ? _b : false }) }));
            }));
        }
        const filePath = path_1.default.join(contentTypeFolderPath, `${type}.json`);
        yield helper_1.default.writeFileAsync(filePath, terms, 4);
        console.log(`Successfully created content type: ${type}.json`);
    }
    return;
});
exports.default = extractTerms;
