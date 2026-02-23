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
const path_1 = __importDefault(require("path"));
const fs_readdir_recursive_1 = __importDefault(require("fs-readdir-recursive"));
const component_identifier_1 = require("../../helper/component.identifier");
const helper_1 = require("../../helper");
const constant_1 = require("../../constant");
const validator = (dirPath) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    const templatesDir = path_1.default.resolve(dirPath);
    const templateFiles = (0, fs_readdir_recursive_1.default)(templatesDir);
    const damPath = (_a = path_1.default === null || path_1.default === void 0 ? void 0 : path_1.default.resolve) === null || _a === void 0 ? void 0 : _a.call(path_1.default, (_b = path_1.default === null || path_1.default === void 0 ? void 0 : path_1.default.join) === null || _b === void 0 ? void 0 : _b.call(path_1.default, templatesDir, constant_1.CONSTANTS.AEM_DAM_DIR));
    const results = yield Promise.all(templateFiles.map((fileName) => __awaiter(void 0, void 0, void 0, function* () {
        var _a;
        const filePath = path_1.default.join(templatesDir, fileName);
        if (filePath.startsWith(damPath)) {
            return null; // Skip this file
        }
        console.log("🚀 ~ validator ~ filePath:", filePath);
        const templateData = yield (0, helper_1.readFiles)(filePath);
        const isFragment = (_a = (0, component_identifier_1.isExperienceFragment)(templateData)) === null || _a === void 0 ? void 0 : _a.isXF;
        const hasTemplateType = Boolean(templateData === null || templateData === void 0 ? void 0 : templateData['templateType']);
        const hasTemplateName = Boolean(templateData === null || templateData === void 0 ? void 0 : templateData['templateName']);
        const hasItems = Boolean(templateData === null || templateData === void 0 ? void 0 : templateData[':items']);
        return (hasTemplateType || hasTemplateName || isFragment) && hasItems;
    })));
    return results;
});
exports.default = validator;
