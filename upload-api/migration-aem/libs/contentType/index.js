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
const index_1 = require("../../constant/index");
const contentTypeMapper_1 = __importDefault(require("./contentTypeMapper"));
const createContentTypes_1 = __importDefault(require("./createContentTypes"));
const components_1 = require("./components");
const index_2 = require("../../helper/index");
// Update the function signature to accept either format
function processComponents(components) {
    // If components is an array, map through it
    if (Array.isArray(components)) {
        return components.map(component => {
            return component;
        });
    }
    const result = {};
    for (const key in components) {
        const component = components[key];
        const mappingRules = [
            () => components_1.BreadcrumbComponent.isBreadcrumb(component) && components_1.BreadcrumbComponent.mapBreadcrumbToContentstack(component, key),
            () => components_1.TitleComponent.isTitle(component) && components_1.TitleComponent.mapTitleToContentstack(component, key),
            () => components_1.TextBannerComponent.isTextBanner(component) && components_1.TextBannerComponent.mapTextBannerToContentstack(component, key),
            () => components_1.TextComponent.isText(component) && components_1.TextComponent.mapTextToContentstack(component),
            () => components_1.NavigationComponent.isNavigation(component) && components_1.NavigationComponent.mapNavigationTOContentstack(component, key),
            () => components_1.NavigationComponent.isLanguageNavigation(component) && components_1.NavigationComponent.mapNavigationTOContentstack(component, key),
            () => components_1.SeparatorComponent.isSeparator(component) && components_1.SeparatorComponent.mapSeparatorToContentstack(component, key),
            () => components_1.SearchComponent.isSearch(component) && components_1.SearchComponent.mapSearchToContentstack(component, key),
            () => components_1.NtFolderComponent.isNtFolder(component) && components_1.NtFolderComponent.mapNtFolderToContentstack(component, key),
            () => components_1.TeaserComponent.isTeaser(component) && components_1.TeaserComponent.mapTeaserToContentstack(component, key),
            () => components_1.SpacerComponent.isSpacer(component) && components_1.SpacerComponent.mapSpacerToContentstack(component, key),
            () => components_1.CustomEmbedComponent.isCustomEmbed(component) && components_1.CustomEmbedComponent.mapCustomEmbedToContentstack(component, key),
            () => components_1.ProductListingComponent.isProductListing(component) && components_1.ProductListingComponent.mapProductListingToContentstack(component, key),
            () => components_1.ButtonComponent.isButton(component) && components_1.ButtonComponent.mapButtonToContentstack(component, key),
            () => components_1.ImageComponent.isImage(component) && components_1.ImageComponent.mapImageToContentstack(component, key),
            () => components_1.CarouselComponent.isCarousel(component) && components_1.CarouselComponent.mapCarouselToContentstack(component, key),
        ];
        result[key] = mappingRules.map(fn => fn()).find(Boolean);
    }
    return result;
}
const mergeChildComponent = (contentstackComponents) => {
    var _a, _b, _c;
    for (const [key, value] of Object.entries(contentstackComponents)) {
        for (const child of Object.values(contentstackComponents)) {
            const childWithType = child;
            const valueWithType = value;
            if (typeof (childWithType === null || childWithType === void 0 ? void 0 : childWithType.type) === "string" &&
                typeof (valueWithType === null || valueWithType === void 0 ? void 0 : valueWithType.type) === "string") {
                const childKey = (_a = childWithType === null || childWithType === void 0 ? void 0 : childWithType.type) === null || _a === void 0 ? void 0 : _a.split("/").pop();
                if ((childWithType === null || childWithType === void 0 ? void 0 : childWithType.type) === `${valueWithType === null || valueWithType === void 0 ? void 0 : valueWithType.type}/${childKey}`) {
                    if (valueWithType === null || valueWithType === void 0 ? void 0 : valueWithType.schema) {
                        (_c = (_b = contentstackComponents === null || contentstackComponents === void 0 ? void 0 : contentstackComponents[key]) === null || _b === void 0 ? void 0 : _b.schema) === null || _c === void 0 ? void 0 : _c.push(child);
                    }
                }
            }
        }
    }
    return contentstackComponents;
};
/**
 * Pre-process components to build schema cache for carousel items
 * This ensures all standalone components are mapped before carousels
 */
function preBuildComponentSchemas(mergedComponents) {
    return __awaiter(this, void 0, void 0, function* () {
        let schemasBuilt = 0;
        for (const [key, component] of Object.entries(mergedComponents)) {
            // Process standalone components and store their schemas
            if (components_1.TeaserComponent.isTeaser(component)) {
                const schema = components_1.TeaserComponent.mapTeaserToContentstack(component, key);
                if (schema) {
                    components_1.CarouselComponent.storeComponentSchema('teaser', schema);
                    schemasBuilt++;
                }
            }
            else if (components_1.ImageComponent.isImage(component)) {
                const schema = components_1.ImageComponent.mapImageToContentstack(component, key);
                if (schema) {
                    components_1.CarouselComponent.storeComponentSchema('image', schema);
                    schemasBuilt++;
                }
            }
            else if (components_1.ButtonComponent.isButton(component)) {
                const schema = components_1.ButtonComponent.mapButtonToContentstack(component, key);
                if (schema) {
                    components_1.CarouselComponent.storeComponentSchema('button', schema);
                    schemasBuilt++;
                }
            }
            else if (components_1.TextBannerComponent.isTextBanner(component)) {
                const schema = components_1.TextBannerComponent.mapTextBannerToContentstack(component, key);
                if (schema) {
                    components_1.CarouselComponent.storeComponentSchema('textbanner', schema);
                    schemasBuilt++;
                }
            }
            else if (components_1.TextComponent.isText(component)) {
                const schema = components_1.TextComponent.mapTextToContentstack(component);
                if (schema) {
                    components_1.CarouselComponent.storeComponentSchema('text', schema);
                    schemasBuilt++;
                }
            }
            else if (components_1.TitleComponent.isTitle(component)) {
                const schema = components_1.TitleComponent.mapTitleToContentstack(component, key);
                if (schema) {
                    components_1.CarouselComponent.storeComponentSchema('title', schema);
                    schemasBuilt++;
                }
            }
            else if (components_1.SearchComponent.isSearch(component)) {
                const schema = components_1.SearchComponent.mapSearchToContentstack(component, key);
                if (schema) {
                    components_1.CarouselComponent.storeComponentSchema('search', schema);
                    schemasBuilt++;
                }
            }
            else if (components_1.SpacerComponent.isSpacer(component)) {
                const schema = components_1.SpacerComponent.mapSpacerToContentstack(component, key);
                if (schema) {
                    components_1.CarouselComponent.storeComponentSchema('spacer', schema);
                    schemasBuilt++;
                }
            }
            else if (components_1.SeparatorComponent.isSeparator(component)) {
                const schema = components_1.SeparatorComponent.mapSeparatorToContentstack(component, key);
                if (schema) {
                    components_1.CarouselComponent.storeComponentSchema('separator', schema);
                    schemasBuilt++;
                }
            }
        }
    });
}
const convertContentType = (dirPath) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    var _d, _e, _f;
    const templatesDir = path_1.default.resolve(dirPath);
    yield components_1.CarouselComponent.initializeCarouselItemTypes(templatesDir);
    const templateFiles = (0, fs_readdir_recursive_1.default)(templatesDir);
    const damPath = (_d = path_1.default === null || path_1.default === void 0 ? void 0 : path_1.default.resolve) === null || _d === void 0 ? void 0 : _d.call(path_1.default, (_e = path_1.default === null || path_1.default === void 0 ? void 0 : path_1.default.join) === null || _e === void 0 ? void 0 : _e.call(path_1.default, templatesDir, index_1.CONSTANTS.AEM_DAM_DIR));
    const allComponentData = [];
    try {
        for (var _g = true, templateFiles_1 = __asyncValues(templateFiles), templateFiles_1_1; templateFiles_1_1 = yield templateFiles_1.next(), _a = templateFiles_1_1.done, !_a; _g = true) {
            _c = templateFiles_1_1.value;
            _g = false;
            const fileName = _c;
            const filePath = path_1.default.join(templatesDir, fileName);
            if ((_f = filePath === null || filePath === void 0 ? void 0 : filePath.startsWith) === null || _f === void 0 ? void 0 : _f.call(filePath, damPath)) {
                continue;
            }
            const templateData = yield (0, index_2.readFiles)(filePath);
            const tracker = yield (0, contentTypeMapper_1.default)({ templateData, affix: "cms" });
            const trackerData = tracker.getAllComponents();
            allComponentData.push(trackerData);
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_g && !_a && (_b = templateFiles_1.return)) yield _b.call(templateFiles_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    const mergedComponents = (0, index_2.mergeComponentObjects)(allComponentData);
    yield preBuildComponentSchemas(mergedComponents);
    const contentstackComponents = processComponents(mergedComponents);
    const mergeChildData = mergeChildComponent(contentstackComponents);
    yield (0, index_2.writeJsonFile)(mergeChildData, index_1.CONSTANTS.TMP_FILE);
});
const arrangeContentModels = (templatesDir, groupBy) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_2, _b, _c;
    var _d, _e, _f;
    const arrangedCt = {};
    const templateFiles = (0, fs_readdir_recursive_1.default)(templatesDir);
    const damPath = (_d = path_1.default === null || path_1.default === void 0 ? void 0 : path_1.default.resolve) === null || _d === void 0 ? void 0 : _d.call(path_1.default, (_e = path_1.default === null || path_1.default === void 0 ? void 0 : path_1.default.join) === null || _e === void 0 ? void 0 : _e.call(path_1.default, templatesDir, index_1.CONSTANTS.AEM_DAM_DIR));
    try {
        for (var _g = true, templateFiles_2 = __asyncValues(templateFiles), templateFiles_2_1; templateFiles_2_1 = yield templateFiles_2.next(), _a = templateFiles_2_1.done, !_a; _g = true) {
            _c = templateFiles_2_1.value;
            _g = false;
            const fileName = _c;
            const filePath = path_1.default.join(templatesDir, fileName);
            if ((_f = filePath === null || filePath === void 0 ? void 0 : filePath.startsWith) === null || _f === void 0 ? void 0 : _f.call(filePath, damPath)) {
                continue;
            }
            const templateData = yield (0, index_2.readFiles)(filePath);
            for (const key of groupBy) {
                const groupValue = templateData === null || templateData === void 0 ? void 0 : templateData[key];
                if (groupValue) {
                    if (!arrangedCt[groupValue]) {
                        arrangedCt[groupValue] = [];
                    }
                    arrangedCt[groupValue].push(templateData);
                    break; // Only group by the first matching key
                }
            }
        }
    }
    catch (e_2_1) { e_2 = { error: e_2_1 }; }
    finally {
        try {
            if (!_g && !_a && (_b = templateFiles_2.return)) yield _b.call(templateFiles_2);
        }
        finally { if (e_2) throw e_2.error; }
    }
    return arrangedCt;
});
const createContentType = (dirPath) => __awaiter(void 0, void 0, void 0, function* () {
    const templatesDir = path_1.default.resolve(dirPath);
    const grouped = yield arrangeContentModels(templatesDir, index_1.CONSTANTS.arrangeCTGroup);
    const componentPath = path_1.default.resolve(index_1.CONSTANTS === null || index_1.CONSTANTS === void 0 ? void 0 : index_1.CONSTANTS.TMP_FILE);
    const contentstackComponents = yield (0, index_2.readFiles)(componentPath);
    return yield (0, createContentTypes_1.default)({ templateData: grouped, contentstackComponents, affix: "cms" });
});
const contentTypes = () => {
    return {
        convertAndCreate: (dirPath) => __awaiter(void 0, void 0, void 0, function* () {
            yield convertContentType(dirPath);
            return yield createContentType(dirPath);
        })
    };
};
exports.default = contentTypes;
