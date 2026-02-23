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
/**
 * Internal module Dependencies .
 */
const index_json_1 = __importDefault(require("../config/index.json"));
const extractItems_1 = __importDefault(require("./extractItems"));
const extractAuthor_1 = __importDefault(require("./extractAuthor"));
const extractTerms_1 = __importDefault(require("./extractTerms"));
const { contentTypes: contentTypesConfig } = index_json_1.default.modules;
const contentTypeFolderPath = path_1.default.resolve(index_json_1.default.data, contentTypesConfig.dirName);
function startingDir() {
    if (!fs_1.default.existsSync(contentTypeFolderPath)) {
        fs_1.default.mkdirSync(contentTypeFolderPath, { recursive: true });
        //helper.writeFile(path.join(contentTypeFolderPath, contentTypesConfig.schemaFile)," ");
    }
}
function readJsonFilesFromFolder(folderPath) {
    var _a;
    const result = [];
    const files = fs_1.default === null || fs_1.default === void 0 ? void 0 : fs_1.default.readdirSync(folderPath);
    for (const file of files) {
        if (file === null || file === void 0 ? void 0 : file.endsWith(".json")) {
            const filePath = path_1.default === null || path_1.default === void 0 ? void 0 : path_1.default.join(folderPath, file);
            // Read and parse JSON
            const content = fs_1.default === null || fs_1.default === void 0 ? void 0 : fs_1.default.readFileSync(filePath, "utf-8");
            try {
                const parsed = JSON === null || JSON === void 0 ? void 0 : JSON.parse(content);
                (_a = result === null || result === void 0 ? void 0 : result.push) === null || _a === void 0 ? void 0 : _a.call(result, parsed);
            }
            catch (err) {
                console.error(`❌ Failed to parse ${file}:`, err);
            }
        }
    }
    return result;
}
function extractContentTypes(affix, filePath, DataConfig) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        try {
            startingDir();
            const alldata = yield fs_1.default.promises.readFile(filePath, "utf8");
            const alldataParsed = JSON === null || JSON === void 0 ? void 0 : JSON.parse(alldata);
            const items = (_b = (_a = alldataParsed === null || alldataParsed === void 0 ? void 0 : alldataParsed.rss) === null || _a === void 0 ? void 0 : _a.channel) === null || _b === void 0 ? void 0 : _b["item"];
            const authorData = (_d = (_c = alldataParsed === null || alldataParsed === void 0 ? void 0 : alldataParsed.rss) === null || _c === void 0 ? void 0 : _c.channel) === null || _d === void 0 ? void 0 : _d["wp:author"];
            yield (0, extractAuthor_1.default)(authorData, 'author');
            const categoriesData = (_f = (_e = alldataParsed === null || alldataParsed === void 0 ? void 0 : alldataParsed.rss) === null || _e === void 0 ? void 0 : _e.channel) === null || _f === void 0 ? void 0 : _f["wp:category"];
            const termsData = (_h = (_g = alldataParsed === null || alldataParsed === void 0 ? void 0 : alldataParsed.rss) === null || _g === void 0 ? void 0 : _g.channel) === null || _h === void 0 ? void 0 : _h["wp:term"];
            yield (0, extractTerms_1.default)(termsData, 'terms');
            //await extractCategories(categoriesData, 'category');
            //await extractTaxonomy(categoriesData, 'categories');
            const itemsArray = (Array === null || Array === void 0 ? void 0 : Array.isArray(items)) ? items : (items ? [items] : []);
            const groupedByType = itemsArray === null || itemsArray === void 0 ? void 0 : itemsArray.reduce((acc, item) => {
                var _a;
                const postType = item === null || item === void 0 ? void 0 : item["wp:post_type"];
                // Skip if it's an attachment
                if ((_a = ["attachment", 'wp_global_styles', 'wp_navigation']) === null || _a === void 0 ? void 0 : _a.includes(postType)) {
                    return acc;
                }
                const type = postType || "unknown";
                if (!acc[type])
                    acc[type] = [];
                acc[type].push(item);
                return acc;
            }, {});
            // Now process each type dynamically
            for (const [type, items] of Object.entries(groupedByType)) {
                if ((Array === null || Array === void 0 ? void 0 : Array.isArray(items)) && (items === null || items === void 0 ? void 0 : items.length) > 0) {
                    yield (0, extractItems_1.default)(items, DataConfig, type, affix, categoriesData, termsData);
                }
                else {
                    console.log(`No ${type} found to extract`);
                }
            }
            return readJsonFilesFromFolder(contentTypeFolderPath);
        }
        catch (error) {
            console.error('Error while creating content_types/schema.json:', error === null || error === void 0 ? void 0 : error.message);
        }
    });
}
exports.default = extractContentTypes;
