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
exports.isHtmlString = exports.isUrlPath = exports.uidCorrector = exports.ComponentMerger = exports.DefaultMergeStrategy = exports.SchemaComponentMergeStrategy = exports.extractComponentPath = exports.readFiles = void 0;
exports.createComponentMerger = createComponentMerger;
exports.mergeComponentObjects = mergeComponentObjects;
exports.writeJsonFile = writeJsonFile;
exports.isImageType = isImageType;
exports.findComponentByType = findComponentByType;
exports.countComponentTypes = countComponentTypes;
exports.findFirstComponentByType = findFirstComponentByType;
exports.toHumanTitle = toHumanTitle;
exports.createContentTypeObject = createContentTypeObject;
exports.ensureField = ensureField;
exports.scanAllCarouselItemTypes = scanAllCarouselItemTypes;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const fs_readdir_recursive_1 = __importDefault(require("fs-readdir-recursive"));
const uuid_1 = require("uuid");
/**
 * Reads a file from the given file path and parses its content as JSON.
 *
 * @param {string} filePath - The path to the file to be read.
 * @returns {Promise<any>} - A promise that resolves to the parsed JSON content of the file.
 * @throws {Error} - Throws an error if the file content is empty, undefined, or invalid JSON.
 */
const readFiles = (filePath) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield fs_1.default.promises.access(filePath, fs_1.default.constants.F_OK);
    }
    catch (_a) {
        console.info(`File does not exist: ${filePath}`);
        return null;
    }
    const fileData = yield fs_1.default.promises.readFile(filePath, 'utf8');
    if (!fileData) {
        console.info('File content is empty or undefined');
        return null;
    }
    if (typeof fileData === 'string') {
        return JSON.parse(fileData);
    }
    return fileData;
});
exports.readFiles = readFiles;
/**
 * Extracts the last segment of a component path from a given string.
 *
 * Searches for a substring that matches the pattern `components/...` and returns
 * the last path segment after the final `/`. If no such pattern is found, returns `null`.
 *
 * @param line - The input string to search for a component path.
 * @returns The last segment of the matched component path, or `null` if no match is found.
 */
const extractComponentPath = (line) => {
    const match = line.match(/components(?:\/[\w-]+)+/);
    if (!match)
        return line;
    // Get the last element after the last '/'
    const parts = match[0].split('/');
    return parts[parts.length - 1];
};
exports.extractComponentPath = extractComponentPath;
/*
 * Interface for merge strategy implementations
 * Following Interface Segregation Principle (ISP)
 */
class SchemaComponentMergeStrategy {
    canMerge(key, sourceValue, targetValue) {
        return !!(sourceValue === null || sourceValue === void 0 ? void 0 : sourceValue.convertedSchema) && !!(targetValue === null || targetValue === void 0 ? void 0 : targetValue.convertedSchema);
    }
    merge(key, sourceValue, targetValue) {
        // Keep the most complete schema definition
        if (Object.keys(sourceValue.convertedSchema).length >
            Object.keys(targetValue.convertedSchema).length) {
            return sourceValue;
        }
        return targetValue;
    }
}
exports.SchemaComponentMergeStrategy = SchemaComponentMergeStrategy;
/**
 * Default strategy for merging components
 */
class DefaultMergeStrategy {
    canMerge() {
        return true; // This is the fallback strategy
    }
    merge(sourceValue) {
        return sourceValue; // Default to taking the newer value
    }
}
exports.DefaultMergeStrategy = DefaultMergeStrategy;
/**
 * Component merger following SOLID principles
 * Open/Closed Principle (OCP) - open for extension with new strategies
 * Dependency Inversion Principle (DIP) - depends on abstractions not implementations
 */
class ComponentMerger {
    constructor(strategies) {
        // Default strategies if none provided
        this.strategies = strategies || [
            new SchemaComponentMergeStrategy(),
            new DefaultMergeStrategy()
        ];
    }
    /**
     * Add a new merge strategy
     * OCP - extend functionality without modifying existing code
     */
    addStrategy(strategy) {
        this.strategies.push(strategy);
    }
    /**
     * Find the appropriate strategy for merging
     */
    findStrategy(key, sourceValue, targetValue) {
        return this.strategies.find(strategy => strategy.canMerge(key, sourceValue, targetValue)) || this.strategies[this.strategies.length - 1]; // Default to last strategy
    }
    /**
     * Merge a single key between two objects
     * SRP - focused responsibility
     */
    mergeKey(key, sourceValue, targetObject) {
        if (!targetObject[key]) {
            // Key doesn't exist in target, simply add it
            targetObject[key] = sourceValue;
        }
        else {
            // Find and apply the appropriate merge strategy
            const strategy = this.findStrategy(key, sourceValue, targetObject[key]);
            targetObject[key] = strategy.merge(key, sourceValue, targetObject[key]);
        }
    }
    /**
     * Merge objects together
     * Public API for this class
     */
    merge(objects) {
        if (!objects.length)
            return {};
        const result = {};
        objects.forEach(obj => {
            Object.keys(obj).forEach(key => {
                this.mergeKey(key, obj[key], result);
            });
        });
        return result;
    }
}
exports.ComponentMerger = ComponentMerger;
/**
 * Factory function to create a component merger
 * Makes using the class easier without exposing implementation details
 */
function createComponentMerger(strategies) {
    return new ComponentMerger(strategies);
}
/**
 * Convenience function that wraps the merger for simple use cases
 */
function mergeComponentObjects(objects) {
    const merger = createComponentMerger();
    return merger.merge(objects);
}
/**
 * Writes the given data to a JSON file at the specified path.
 * Ensures the directory exists before writing.
 * @param data - The data to write.
 * @param filePath - The file path to write to.
 */
function writeJsonFile(data_1) {
    return __awaiter(this, arguments, void 0, function* (data, filePath = './contentstackComponents.json') {
        const dir = path_1.default.dirname(filePath);
        try {
            yield fs_1.default.promises.mkdir(dir, { recursive: true });
            yield fs_1.default.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        }
        catch (error) {
            throw new Error(`Failed to write JSON file: ${error}`);
        }
    });
}
/**
 * Checks if the provided path is an image type (jpeg, jpg, png, gif, webp, svg).
 * @param path - The string path to check.
 * @returns True if the path is an image, false otherwise.
 */
function isImageType(path) {
    return /\.(jpeg|jpg|png|gif|webp|svg)$/i.test(path);
}
const uidCorrector = (uid) => {
    // Remove leading colon if present (e.g., ':items' becomes 'items')
    let newUid = uid.replace(/^:/, '');
    // Insert underscore before uppercase letters, then lowercase everything
    newUid = newUid.replace(/([a-z0-9])([A-Z])/g, '$1_$2');
    // Replace spaces, hyphens, and colons with underscores
    newUid = newUid.replace(/[ :-]/g, '_');
    // Remove all '$' characters
    newUid = newUid.replace(/\$/g, '');
    // Remove any character not alphanumeric or underscore
    newUid = newUid.replace(/[^a-zA-Z0-9_]/g, '');
    // Ensure starts with an alphabet, else prefix with 'a'
    if (!/^[a-zA-Z]/.test(newUid)) {
        newUid = 'a' + newUid;
    }
    return newUid.toLowerCase();
};
exports.uidCorrector = uidCorrector;
const isUrlPath = (str) => /^\/[a-zA-Z0-9\-/.]+$/.test(str);
exports.isUrlPath = isUrlPath;
const isHtmlString = (str) => /<[a-z][\s\S]*>/i.test(str);
exports.isHtmlString = isHtmlString;
function findComponentByType(contentstackComponents, type, exclude = ['nt:folder']) {
    return Object.entries(contentstackComponents !== null && contentstackComponents !== void 0 ? contentstackComponents : {}).find(([, csValue]) => {
        const csType = csValue['type'];
        return csType === type && !exclude.includes(csType);
    });
}
function countComponentTypes(component, result = {}) {
    if (!component || typeof component !== "object")
        return result;
    // Check for ':type' at current level
    const t = component[":type"];
    const typeField = typeof t === "string" ? t : t === null || t === void 0 ? void 0 : t.value;
    if (typeField)
        result[typeField] = (result[typeField] || 0) + 1;
    // Recursively check nested properties
    for (const key in component) {
        if (component[key] && typeof component[key] === "object") {
            countComponentTypes(component[key], result);
        }
    }
    return result;
}
function findFirstComponentByType(schema, type) {
    var _a;
    if (!schema || typeof schema !== "object")
        return null;
    // Check at current level
    if (((_a = schema[":type"]) === null || _a === void 0 ? void 0 : _a.value) === type) {
        return schema;
    }
    // Recursively check nested properties
    for (const key in schema) {
        if (schema[key] && typeof schema[key] === "object") {
            const found = findFirstComponentByType(schema[key], type);
            if (found)
                return found;
        }
    }
    return null;
}
/**
 * Converts kebab-case or snake_case to a human-readable title.
 * Example: "page-content-full-width" => "Page content full width"
 */
function toHumanTitle(str) {
    return str
        .replace(/[-_]+/g, ' ') // Replace - and _ with space
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim() // Remove leading/trailing spaces
        .replace(/^./, c => c.toUpperCase()); // Capitalize first letter
}
function createContentTypeObject({ otherCmsTitle, otherCmsUid, fieldMapping, type = "content_type", status = 1, isUpdated = false }) {
    return {
        id: (0, uuid_1.v4)(),
        status,
        otherCmsTitle: toHumanTitle(otherCmsTitle),
        otherCmsUid,
        isUpdated,
        contentstackTitle: toHumanTitle(otherCmsTitle),
        contentstackUid: (0, exports.uidCorrector)(otherCmsUid),
        type,
        fieldMapping,
    };
}
/**
 * Ensures a field with the given UID exists in the schema array.
 * If not present, prepends the provided field config.
 */
function ensureField(mainSchema, fieldConfig, fieldUid) {
    const found = mainSchema === null || mainSchema === void 0 ? void 0 : mainSchema.some((item) => { var _a, _b; return ((_b = (_a = item === null || item === void 0 ? void 0 : item.contentstackFieldUid) === null || _a === void 0 ? void 0 : _a.toLowerCase) === null || _b === void 0 ? void 0 : _b.call(_a)) === fieldUid.toLowerCase(); });
    if (!found) {
        mainSchema.unshift(fieldConfig);
    }
}
/**
 * Helper function that recursively searches for carousel components and extracts item types
 */
function findCarouselsRecursive(obj, itemTypes) {
    if (!obj || typeof obj !== 'object')
        return;
    const typeValue = obj[':type'] || obj['type'];
    const isCarousel = typeof typeValue === 'string' && typeValue.includes('carousel');
    if (isCarousel && obj[':items']) {
        // Get the items object
        const items = obj[':items'];
        if (items && typeof items === 'object') {
            // Iterate through each item in the carousel
            for (const [key, value] of Object.entries(items)) {
                if (value && typeof value === 'object') {
                    const itemType = value[':type'];
                    if (itemType && typeof itemType === 'string') {
                        // Extract component name from path
                        const componentName = itemType.split('/').pop();
                        if (componentName) {
                            itemTypes.add(componentName);
                        }
                    }
                }
            }
        }
    }
    // Recursively search nested objects
    if (Array.isArray(obj)) {
        obj.forEach(item => findCarouselsRecursive(item, itemTypes));
    }
    else {
        Object.values(obj).forEach(value => findCarouselsRecursive(value, itemTypes));
    }
}
/**
 * Scans all JSON files to find all unique component types used in carousel items
 * @param packagePath - Path to the AEM package
 * @returns Set of all component types found in any carousel
 */
function scanAllCarouselItemTypes(packagePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const carouselItemTypes = new Set();
        const filesDir = path_1.default.resolve(packagePath);
        try {
            const allFiles = (0, fs_readdir_recursive_1.default)(filesDir);
            const jsonFiles = allFiles.filter(f => f.endsWith('.json'));
            for (const fileName of jsonFiles) {
                const filePath = path_1.default.join(filesDir, fileName);
                try {
                    const content = yield fs_1.default.promises.readFile(filePath, 'utf-8');
                    const data = JSON.parse(content);
                    // Recursively search for carousel components
                    findCarouselsRecursive(data, carouselItemTypes);
                }
                catch (err) {
                    // Skip invalid JSON files
                    continue;
                }
            }
            return carouselItemTypes;
        }
        catch (err) {
            console.error('❌ Error scanning carousel items:', err);
            return carouselItemTypes;
        }
    });
}
