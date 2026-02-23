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
const extractLocale = (filePath) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    try {
        const rawData = fs_1.default.readFileSync(filePath, 'utf8');
        const jsonData = JSON.parse(rawData);
        const uniqueLanguages = new Set();
        // Extract global language (if exists)
        if ((_b = (_a = jsonData.rss) === null || _a === void 0 ? void 0 : _a.channel) === null || _b === void 0 ? void 0 : _b.language) {
            uniqueLanguages.add(jsonData.rss.channel.language);
        }
        // Extract entry-level languages (if available)
        const items = ((_d = (_c = jsonData === null || jsonData === void 0 ? void 0 : jsonData.rss) === null || _c === void 0 ? void 0 : _c.channel) === null || _d === void 0 ? void 0 : _d.item) || [];
        const itemArray = Array.isArray(items) ? items : [items];
        itemArray.forEach((item) => {
            if (item['wp:postmeta']) {
                const postMeta = Array.isArray(item['wp:postmeta']) ? item['wp:postmeta']
                    : [item['wp:postmeta']];
                postMeta.forEach((meta) => {
                    var _a;
                    if (((_a = meta['wp:meta_key']) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === 'language' && meta['wp:meta_value']) {
                        uniqueLanguages.add(meta['wp:meta_value']);
                    }
                });
            }
        });
        return [...uniqueLanguages];
    }
    catch (err) {
        throw new Error(`Error reading JSON file: ${err.message}`);
    }
});
exports.default = extractLocale;
