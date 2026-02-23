"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const cheerio = __importStar(require("cheerio"));
const parseUtil_1 = require("../utils/parseUtil");
const schemaMapper_1 = require("./schemaMapper");
const helper_1 = __importDefault(require("../utils/helper"));
const index_json_1 = __importDefault(require("../config/index.json"));
const extractTaxonomy_1 = __importDefault(require("./extractTaxonomy"));
const { contentTypes: contentTypesConfig } = index_json_1.default.modules;
const contentTypeFolderPath = path_1.default.resolve(index_json_1.default.data, contentTypesConfig.dirName);
function findSimilarBlocks(data, targetId) {
    for (const group of data) {
        const found = group === null || group === void 0 ? void 0 : group.find((obj) => (obj === null || obj === void 0 ? void 0 : obj.clientId) === targetId);
        if (found) {
            // Return all blocks in the group including the current one
            return group !== null && group !== void 0 ? group : [];
        }
    }
    return []; // Return empty array if not found in any group
}
// Compare inner block structures recursively
function haveSameNamesIgnoreOrder(arr1, arr2) {
    const names1 = arr1 === null || arr1 === void 0 ? void 0 : arr1.map((o) => o === null || o === void 0 ? void 0 : o.name).sort();
    const names2 = arr2 === null || arr2 === void 0 ? void 0 : arr2.map((o) => o === null || o === void 0 ? void 0 : o.name).sort();
    return (JSON === null || JSON === void 0 ? void 0 : JSON.stringify(names1)) === (JSON === null || JSON === void 0 ? void 0 : JSON.stringify(names2));
}
// Utility to compare structure of two objects (including nested arrays/innerBlocks)
function isSameStructure(obj1, obj2) {
    var _a, _b;
    // If types differ, structure differs
    if (typeof obj1 !== typeof obj2)
        return false;
    if (Array.isArray(obj1) && Array.isArray(obj2)) {
        if ((obj1 === null || obj1 === void 0 ? void 0 : obj1.length) === 0 && (obj2 === null || obj2 === void 0 ? void 0 : obj2.length) === 0)
            return true;
        if ((obj1 === null || obj1 === void 0 ? void 0 : obj1.length) === 0 || (obj2 === null || obj2 === void 0 ? void 0 : obj2.length) === 0)
            return false;
        // Compare each element structure-wise
        return obj1 === null || obj1 === void 0 ? void 0 : obj1.every((item, i) => {
            const compareWith = (obj2 === null || obj2 === void 0 ? void 0 : obj2[i]) || (obj2 === null || obj2 === void 0 ? void 0 : obj2[0]);
            return isSameStructure(item, compareWith);
        });
    }
    if (typeof obj1 === "object" && obj1 !== null && obj2 !== null) {
        const keys1 = Object === null || Object === void 0 ? void 0 : Object.keys(obj1);
        const keys2 = Object === null || Object === void 0 ? void 0 : Object.keys(obj2);
        // Check if both objects have same keys
        if ((keys1 === null || keys1 === void 0 ? void 0 : keys1.length) !== (keys2 === null || keys2 === void 0 ? void 0 : keys2.length) || !(keys1 === null || keys1 === void 0 ? void 0 : keys1.every((k) => keys2 === null || keys2 === void 0 ? void 0 : keys2.includes(k)))) {
            return false;
        }
        // Special handling for Gutenberg-like blocks
        if ((obj1 === null || obj1 === void 0 ? void 0 : obj1.name) && (obj2 === null || obj2 === void 0 ? void 0 : obj2.name) && (obj1 === null || obj1 === void 0 ? void 0 : obj1.name) !== (obj2 === null || obj2 === void 0 ? void 0 : obj2.name)) {
            return false;
        }
        if ((Array === null || Array === void 0 ? void 0 : Array.isArray(obj1 === null || obj1 === void 0 ? void 0 : obj1.innerBlocks)) || Array.isArray(obj2 === null || obj2 === void 0 ? void 0 : obj2.innerBlocks)) {
            if (!Array.isArray(obj1 === null || obj1 === void 0 ? void 0 : obj1.innerBlocks) || !Array.isArray(obj2 === null || obj2 === void 0 ? void 0 : obj2.innerBlocks)) {
                return false; // one has innerBlocks, other doesn’t
            }
            if (((_a = obj1 === null || obj1 === void 0 ? void 0 : obj1.innerBlocks) === null || _a === void 0 ? void 0 : _a.length) !== ((_b = obj2 === null || obj2 === void 0 ? void 0 : obj2.innerBlocks) === null || _b === void 0 ? void 0 : _b.length)) {
                return false;
            }
            if (!haveSameNamesIgnoreOrder(obj1 === null || obj1 === void 0 ? void 0 : obj1.innerBlocks, obj2 === null || obj2 === void 0 ? void 0 : obj2.innerBlocks)) {
                return false;
            }
        }
    }
    return true;
}
// Compare all objects in blocksJson
function findSameStructureBlocks(blocksJson) {
    const similarPairs = [];
    for (let i = 0; i < (blocksJson === null || blocksJson === void 0 ? void 0 : blocksJson.length); i++) {
        for (let j = i + 1; j < (blocksJson === null || blocksJson === void 0 ? void 0 : blocksJson.length); j++) {
            if (isSameStructure(blocksJson === null || blocksJson === void 0 ? void 0 : blocksJson[i], blocksJson === null || blocksJson === void 0 ? void 0 : blocksJson[j])) {
                similarPairs.push([blocksJson === null || blocksJson === void 0 ? void 0 : blocksJson[i], blocksJson === null || blocksJson === void 0 ? void 0 : blocksJson[j]]); // store indices or objects
            }
        }
    }
    return similarPairs;
}
/**
 * Get all child fields for a modular block child from CT
 * Child fields are those whose contentstackFieldUid starts with the parent's contentstackFieldUid
 */
function getChildFieldsFromCT(modularBlockChild, CT) {
    const parentUid = modularBlockChild.contentstackFieldUid;
    if (!parentUid)
        return [];
    return CT.filter(field => {
        // Skip the modular block child itself
        if (field === modularBlockChild)
            return false;
        // Check if this field belongs to the modular block child
        return field.contentstackFieldUid &&
            field.contentstackFieldUid.startsWith(parentUid + '.');
    });
}
/**
 * Create a signature for Fieldschema based only on contentstackFieldType
 * This ignores field names and only compares the structure/types
 */
function createFieldschemaSignature(fields) {
    // Sort fields by contentstackFieldUid for consistent comparison
    const sortedFields = [...fields].sort((a, b) => (a.contentstackFieldUid || '').localeCompare(b.contentstackFieldUid || ''));
    // Create signature based only on contentstackFieldType (ignore names)
    const signature = sortedFields.map(field => {
        var _a;
        return ({
            contentstackFieldType: field.contentstackFieldType,
            // Include advanced properties that affect structure
            multiple: ((_a = field.advanced) === null || _a === void 0 ? void 0 : _a.multiple) || false
        });
    });
    return JSON.stringify(signature);
}
/**
 * Check if a modular block child with the same Fieldschema already exists in CT
 * Compares only by contentstackFieldType, not by name
 */
function findDuplicateModularBlockChild(newFieldschema, CT) {
    // Normalize Fieldschema to array
    const fieldsArray = Array.isArray(newFieldschema) ? newFieldschema : [newFieldschema];
    // Filter out null/undefined fields
    const validFields = fieldsArray.filter(f => f && f.contentstackFieldType !== "null");
    if (validFields.length === 0)
        return null;
    // Create signature for the new Fieldschema
    const newSignature = createFieldschemaSignature(validFields);
    // Find all existing modular block children in CT
    const existingModularBlocks = CT.filter(field => field.contentstackFieldType === 'modular_blocks_child');
    // Check each existing modular block child
    for (const existingBlock of existingModularBlocks) {
        const existingChildFields = getChildFieldsFromCT(existingBlock, CT);
        // Only compare if they have the same number of child fields
        if (existingChildFields.length !== validFields.length)
            continue;
        // Create signature for existing Fieldschema
        const existingSignature = createFieldschemaSignature(existingChildFields);
        // Compare signatures (only contentstackFieldType, ignoring names)
        if (existingSignature === newSignature) {
            return existingBlock;
        }
    }
    return null;
}
function getLastUid(uid) {
    var _a, _b, _c, _d;
    return (_b = (_a = uid === null || uid === void 0 ? void 0 : uid.split) === null || _a === void 0 ? void 0 : _a.call(uid, '.')) === null || _b === void 0 ? void 0 : _b[((_d = (_c = uid === null || uid === void 0 ? void 0 : uid.split) === null || _c === void 0 ? void 0 : _c.call(uid, '.')) === null || _d === void 0 ? void 0 : _d.length) - 1];
}
const extractItems = (item, config, type, affix, categories, terms) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10;
    const localPath = config.localPath;
    const xmlData = yield fs_1.default.promises.readFile(localPath, "utf8");
    const $ = cheerio.load(xmlData, { xmlMode: true });
    const items = $('item');
    const authorsData = $('wp\\author');
    const CT = [];
    let isCategories = false;
    let isTermReffered = false;
    const isAllContentEmpty = item.every((data) => { var _a; return !(data === null || data === void 0 ? void 0 : data['content:encoded']) || ((_a = data === null || data === void 0 ? void 0 : data['content:encoded']) === null || _a === void 0 ? void 0 : _a.trim()) === ''; });
    if (!isAllContentEmpty) {
        CT === null || CT === void 0 ? void 0 : CT.push({
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
        }, {
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
        }, {
            "isDeleted": false,
            "uid": "modular_blocks",
            "otherCmsField": "Modular Blocks",
            "backupFieldUid": "modular_blocks",
            "otherCmsType": "text",
            "contentstackField": "Modular Blocks",
            "contentstackFieldUid": "modular_blocks",
            "contentstackFieldType": "modular_blocks",
            "backupFieldType": "modular_blocks",
        });
    }
    // Create the content type directory if it doesn't exist
    (0, mkdirp_1.default)(contentTypeFolderPath);
    //const category = await extractTaxonomy(categories, 'categories');
    const categoryArray = { uid: 'category',
        otherCmsField: 'category',
        otherCmsType: 'category',
        contentstackField: 'category',
        contentstackFieldUid: 'taxonomies',
        contentstackFieldType: 'taxonomy',
        backupFieldType: 'taxonomy',
        backupFieldUid: 'taxonomies',
        advanced: {
            taxonomies: []
        },
    };
    for (const data of item) {
        const processedSimilarBlocks = new Set();
        const targetItem = (_a = items === null || items === void 0 ? void 0 : items.filter((i, el) => {
            var _a, _b;
            return ((_b = (_a = $(el)) === null || _a === void 0 ? void 0 : _a.find("title")) === null || _b === void 0 ? void 0 : _b.text()) === (data === null || data === void 0 ? void 0 : data.title);
        })) === null || _a === void 0 ? void 0 : _a.first();
        if (data === null || data === void 0 ? void 0 : data.category) {
            const categoryData = (Array === null || Array === void 0 ? void 0 : Array.isArray(data === null || data === void 0 ? void 0 : data.category)) ? data === null || data === void 0 ? void 0 : data.category : [data === null || data === void 0 ? void 0 : data.category];
            const domain = categoryData === null || categoryData === void 0 ? void 0 : categoryData.some((item) => { var _a; return ((_a = item === null || item === void 0 ? void 0 : item.attributes) === null || _a === void 0 ? void 0 : _a.domain) === 'category'; });
            const termsDomain = categoryData === null || categoryData === void 0 ? void 0 : categoryData.find((item) => { var _a; return ((_a = item === null || item === void 0 ? void 0 : item.attributes) === null || _a === void 0 ? void 0 : _a.domain) !== 'category'; });
            isTermReffered = terms === null || terms === void 0 ? void 0 : terms.some((item) => { var _a; return (item === null || item === void 0 ? void 0 : item['wp:term_taxonomy']) === ((_a = termsDomain === null || termsDomain === void 0 ? void 0 : termsDomain.attributes) === null || _a === void 0 ? void 0 : _a.domain); });
            if (domain) {
                isCategories = true;
            }
            const category = yield (0, extractTaxonomy_1.default)(data === null || data === void 0 ? void 0 : data.category, categories, 'categories');
            if (!(categoryArray === null || categoryArray === void 0 ? void 0 : categoryArray.advanced)) {
                categoryArray.advanced = { taxonomies: [] };
            }
            categoryArray.advanced.taxonomies = Array === null || Array === void 0 ? void 0 : Array.from(new Map([
                ...(((_b = categoryArray === null || categoryArray === void 0 ? void 0 : categoryArray.advanced) === null || _b === void 0 ? void 0 : _b.taxonomies) || []),
                ...(category || [])
            ].map(item => [item.taxonomy_uid, item])).values());
        }
        //const taxonomy = await extractTerms(data?.category, terms, categories,'taxonomy');
        const contentEncoded = ((_c = targetItem === null || targetItem === void 0 ? void 0 : targetItem.find("content\\:encoded")) === null || _c === void 0 ? void 0 : _c.text()) || '';
        const blocksJson = yield (0, parseUtil_1.setupWordPressBlocks)(contentEncoded);
        //await helper?.writeFileAsync(`${data?.title || 'undefined'}.json`, JSON.stringify({blocks : blocksJson, count :blocksJson?.length}, null, 4), 4);
        // Example usage
        const result = findSameStructureBlocks(blocksJson);
        // fs?.writeFileSync('result.json', JSON?.stringify(result, null, 4));
        // Track processed similar blocks to avoid duplicates
        for (const field of blocksJson) {
            const fieldUid = (0, schemaMapper_1.getFieldUid)(`${field === null || field === void 0 ? void 0 : field.name}_${field === null || field === void 0 ? void 0 : field.clientId}` || '', affix || '');
            const contentstackFieldName = (0, schemaMapper_1.getFieldName)((_f = (_e = (_d = field === null || field === void 0 ? void 0 : field.attributes) === null || _d === void 0 ? void 0 : _d.metadata) === null || _e === void 0 ? void 0 : _e.name) !== null && _f !== void 0 ? _f : ((field === null || field === void 0 ? void 0 : field.name) === 'core/missing' ? 'body' : field === null || field === void 0 ? void 0 : field.name));
            const similarBlocks = findSimilarBlocks(result, field === null || field === void 0 ? void 0 : field.clientId);
            // Collect all unique block names from the similar blocks
            const allBlockNames = similarBlocks
                .map(block => { var _a, _b; return ((_b = (_a = block === null || block === void 0 ? void 0 : block.attributes) === null || _a === void 0 ? void 0 : _a.metadata) === null || _b === void 0 ? void 0 : _b.name) || (block === null || block === void 0 ? void 0 : block.name); })
                .filter((name, index, array) => name && (array === null || array === void 0 ? void 0 : array.indexOf(name)) === index) // Remove duplicates
                .sort(); // Sort for consistency
            const filterOutBlock = allBlockNames === null || allBlockNames === void 0 ? void 0 : allBlockNames.filter((item) => { var _a, _b, _c; return item !== ((_c = (_b = (_a = field === null || field === void 0 ? void 0 : field.attributes) === null || _a === void 0 ? void 0 : _a.metadata) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : ((field === null || field === void 0 ? void 0 : field.name) === 'core/missing' ? 'body' : field === null || field === void 0 ? void 0 : field.name)); });
            const fieldDisplayName = (0, schemaMapper_1.getFieldName)((_j = (_h = (_g = field === null || field === void 0 ? void 0 : field.attributes) === null || _g === void 0 ? void 0 : _g.metadata) === null || _h === void 0 ? void 0 : _h.name) !== null && _j !== void 0 ? _j : ((field === null || field === void 0 ? void 0 : field.name) === 'core/missing' ? 'body' : field === null || field === void 0 ? void 0 : field.name));
            const firstFilterBlock = (filterOutBlock === null || filterOutBlock === void 0 ? void 0 : filterOutBlock[0]) ? `Modular Blocks > ${filterOutBlock === null || filterOutBlock === void 0 ? void 0 : filterOutBlock[0]}` : null;
            const generatedFieldName = `Modular Blocks > ${fieldDisplayName}`;
            const existingBlock = CT === null || CT === void 0 ? void 0 : CT.find((item) => {
                if (!item)
                    return false;
                const isModularChild = (item === null || item === void 0 ? void 0 : item.contentstackFieldType) === 'modular_blocks_child';
                const matchesField = ((item === null || item === void 0 ? void 0 : item.contentstackField) === firstFilterBlock ||
                    (item === null || item === void 0 ? void 0 : item.contentstackField) === generatedFieldName);
                return isModularChild && matchesField;
            });
            // Create grouped contentstack field name
            const groupedContentstackField = `Modular Blocks > ${contentstackFieldName}`;
            // If this block has similar structures
            if ((similarBlocks === null || similarBlocks === void 0 ? void 0 : similarBlocks.length) > 0) {
                // Create a unique key based on the structure/name to track processed groups
                const groupKey = (_m = (_l = (_k = field === null || field === void 0 ? void 0 : field.attributes) === null || _k === void 0 ? void 0 : _k.metadata) === null || _l === void 0 ? void 0 : _l.name) !== null && _m !== void 0 ? _m : ((field === null || field === void 0 ? void 0 : field.name) === 'core/missing' ? 'body' : field === null || field === void 0 ? void 0 : field.name);
                // Skip if we've already processed this group of similar blocks
                if (((_o = processedSimilarBlocks === null || processedSimilarBlocks === void 0 ? void 0 : processedSimilarBlocks.has) === null || _o === void 0 ? void 0 : _o.call(processedSimilarBlocks, groupKey)) || existingBlock) {
                    continue;
                }
                // Create single modular block child for all similar blocks
                if (!existingBlock && !((_p = processedSimilarBlocks === null || processedSimilarBlocks === void 0 ? void 0 : processedSimilarBlocks.has) === null || _p === void 0 ? void 0 : _p.call(processedSimilarBlocks, groupKey))) {
                    // Mark this group as processed
                    (_q = processedSimilarBlocks === null || processedSimilarBlocks === void 0 ? void 0 : processedSimilarBlocks.add) === null || _q === void 0 ? void 0 : _q.call(processedSimilarBlocks, groupKey);
                    // Generate Fieldschema first to check for duplicates
                    const Fieldschema = yield (0, schemaMapper_1.schemaMapper)(((_r = field === null || field === void 0 ? void 0 : field.innerBlocks) === null || _r === void 0 ? void 0 : _r.length) > 0 ? field === null || field === void 0 ? void 0 : field.innerBlocks : field, `modular_blocks.${fieldUid}`, groupedContentstackField, affix || '');
                    const Schema = Array.isArray(Fieldschema) ? Fieldschema : [Fieldschema];
                    // Check if a modular block child with the same Fieldschema already exists
                    const duplicateBlock = findDuplicateModularBlockChild(Schema, CT);
                    if (duplicateBlock) {
                        // Duplicate found - skip adding this modular block child and its Fieldschema
                        console.log(`Skipping duplicate modular block child: "${groupedContentstackField}" (duplicate of "${duplicateBlock.contentstackField}")`);
                        continue;
                    }
                    // No duplicate found - add the modular block child
                    if ((Schema === null || Schema === void 0 ? void 0 : Schema.length) > 0) {
                        (_s = CT === null || CT === void 0 ? void 0 : CT.push) === null || _s === void 0 ? void 0 : _s.call(CT, {
                            "uid": `modular_blocks.${(0, schemaMapper_1.getFieldUid)(`${field === null || field === void 0 ? void 0 : field.name}_${field === null || field === void 0 ? void 0 : field.clientId}`, affix)}`,
                            "backupFieldUid": `modular_blocks.${fieldUid}`,
                            "contentstackFieldUid": `modular_blocks.${fieldUid}`,
                            "otherCmsField": contentstackFieldName,
                            "otherCmsType": 'block',
                            "contentstackField": groupedContentstackField,
                            "contentstackFieldType": 'modular_blocks_child',
                            "backupFieldType": "modular_blocks_child",
                        });
                    }
                    if (Array === null || Array === void 0 ? void 0 : Array.isArray(Schema)) {
                        for (const schemaObj of Schema) {
                            if (!schemaObj || (schemaObj === null || schemaObj === void 0 ? void 0 : schemaObj.contentstackFieldType) === "null")
                                continue;
                            // Check if any similar field already exists
                            const exists = CT === null || CT === void 0 ? void 0 : CT.find((item) => getLastUid(item === null || item === void 0 ? void 0 : item.uid) === getLastUid(schemaObj === null || schemaObj === void 0 ? void 0 : schemaObj.uid) &&
                                (item === null || item === void 0 ? void 0 : item.contentstackFieldType) === (schemaObj === null || schemaObj === void 0 ? void 0 : schemaObj.contentstackFieldType) &&
                                (item === null || item === void 0 ? void 0 : item.contentstackField) === (schemaObj === null || schemaObj === void 0 ? void 0 : schemaObj.contentstackField)
                            //&& item?.contentstackFieldUid === schemaObj?.contentstackFieldUid
                            );
                            if (!exists) {
                                (_t = CT === null || CT === void 0 ? void 0 : CT.push) === null || _t === void 0 ? void 0 : _t.call(CT, schemaObj);
                            }
                        }
                    }
                }
            }
            else {
                // Handle single blocks (no similar structures found)
                const singleBlockName = (0, schemaMapper_1.getFieldName)((_w = (_v = (_u = field === null || field === void 0 ? void 0 : field.attributes) === null || _u === void 0 ? void 0 : _u.metadata) === null || _v === void 0 ? void 0 : _v.name) !== null && _w !== void 0 ? _w : ((field === null || field === void 0 ? void 0 : field.name) === 'core/missing' ? 'body' : field === null || field === void 0 ? void 0 : field.name));
                if (!existingBlock && !((_x = processedSimilarBlocks === null || processedSimilarBlocks === void 0 ? void 0 : processedSimilarBlocks.has) === null || _x === void 0 ? void 0 : _x.call(processedSimilarBlocks, (_0 = (_z = (_y = field === null || field === void 0 ? void 0 : field.attributes) === null || _y === void 0 ? void 0 : _y.metadata) === null || _z === void 0 ? void 0 : _z.name) !== null && _0 !== void 0 ? _0 : (0, schemaMapper_1.getFieldName)((field === null || field === void 0 ? void 0 : field.name) === 'core/missing' ? 'body' : field === null || field === void 0 ? void 0 : field.name)))) {
                    (_1 = processedSimilarBlocks === null || processedSimilarBlocks === void 0 ? void 0 : processedSimilarBlocks.add) === null || _1 === void 0 ? void 0 : _1.call(processedSimilarBlocks, (_4 = (_3 = (_2 = field === null || field === void 0 ? void 0 : field.attributes) === null || _2 === void 0 ? void 0 : _2.metadata) === null || _3 === void 0 ? void 0 : _3.name) !== null && _4 !== void 0 ? _4 : ((field === null || field === void 0 ? void 0 : field.name) === 'core/missing' ? 'body' : field === null || field === void 0 ? void 0 : field.name));
                    // Generate Fieldschema first to check for duplicates
                    const Fieldschema = yield (0, schemaMapper_1.schemaMapper)(((_5 = field === null || field === void 0 ? void 0 : field.innerBlocks) === null || _5 === void 0 ? void 0 : _5.length) > 0 ? field === null || field === void 0 ? void 0 : field.innerBlocks : field, `modular_blocks.${fieldUid}`, groupedContentstackField, affix || '');
                    const Schema = Array.isArray(Fieldschema) ? Fieldschema : [Fieldschema];
                    // Check if a modular block child with the same Fieldschema already exists
                    const duplicateBlock = findDuplicateModularBlockChild(Schema, CT);
                    if (duplicateBlock) {
                        // Duplicate found - skip adding this modular block child and its Fieldschema
                        console.log(`Skipping duplicate modular block child: "Modular Blocks > ${singleBlockName}" (duplicate of "${duplicateBlock.contentstackField}")`);
                        continue;
                    }
                    // No duplicate found - add the modular block child
                    if ((Schema === null || Schema === void 0 ? void 0 : Schema.length) > 0) {
                        (_6 = CT === null || CT === void 0 ? void 0 : CT.push) === null || _6 === void 0 ? void 0 : _6.call(CT, {
                            "uid": `modular_blocks.${(0, schemaMapper_1.getFieldUid)(`${field === null || field === void 0 ? void 0 : field.name}_${field === null || field === void 0 ? void 0 : field.clientId}`, affix)}`,
                            "backupFieldUid": `modular_blocks.${fieldUid}`,
                            "contentstackFieldUid": `modular_blocks.${fieldUid}`,
                            "otherCmsField": contentstackFieldName,
                            "otherCmsType": 'block',
                            "contentstackField": `Modular Blocks > ${singleBlockName}`,
                            "contentstackFieldType": 'modular_blocks_child',
                            "backupFieldType": "modular_blocks_child",
                        });
                    }
                    if (Array === null || Array === void 0 ? void 0 : Array.isArray(Schema)) {
                        for (const schemaObj of Schema) {
                            if (!schemaObj || (schemaObj === null || schemaObj === void 0 ? void 0 : schemaObj.contentstackFieldType) === "null")
                                continue;
                            // Check if any similar field already exists
                            const exists = CT === null || CT === void 0 ? void 0 : CT.find((item) => getLastUid(item === null || item === void 0 ? void 0 : item.uid) === getLastUid(schemaObj === null || schemaObj === void 0 ? void 0 : schemaObj.uid) &&
                                (item === null || item === void 0 ? void 0 : item.contentstackFieldType) === (schemaObj === null || schemaObj === void 0 ? void 0 : schemaObj.contentstackFieldType) &&
                                (item === null || item === void 0 ? void 0 : item.contentstackField) === (schemaObj === null || schemaObj === void 0 ? void 0 : schemaObj.contentstackField)
                            //&& item?.contentstackFieldUid === schemaObj?.contentstackFieldUid
                            );
                            if (!exists) {
                                (_7 = CT === null || CT === void 0 ? void 0 : CT.push) === null || _7 === void 0 ? void 0 : _7.call(CT, schemaObj);
                            }
                        }
                    }
                }
            }
        }
    }
    // Push category only once, outside the loop
    if ((categories === null || categories === void 0 ? void 0 : categories.length) > 0 && isCategories && !isAllContentEmpty) {
        const existingCategory = CT === null || CT === void 0 ? void 0 : CT.find((item) => (item === null || item === void 0 ? void 0 : item.uid) === 'categories' &&
            (item === null || item === void 0 ? void 0 : item.contentstackFieldType) === 'taxonomy');
        if (!existingCategory) {
            (_8 = CT === null || CT === void 0 ? void 0 : CT.push) === null || _8 === void 0 ? void 0 : _8.call(CT, categoryArray);
        }
    }
    if (isTermReffered && !isAllContentEmpty) {
        (_9 = CT === null || CT === void 0 ? void 0 : CT.push) === null || _9 === void 0 ? void 0 : _9.call(CT, {
            "uid": 'terms',
            "contentstackFieldUid": 'terms',
            "contentstackField": 'Terms',
            "contentstackFieldType": 'reference',
            "backupFieldType": 'reference',
            "otherCmsField": 'terms',
            "otherCmsType": 'reference',
            "backupFieldUid": 'terms',
            "refrenceTo": ['terms'],
            "advanced": {
                "mandatory": false
            }
        });
    }
    if (authorsData && !isAllContentEmpty) {
        (_10 = CT === null || CT === void 0 ? void 0 : CT.push) === null || _10 === void 0 ? void 0 : _10.call(CT, {
            "uid": 'author',
            "contentstackFieldUid": 'author',
            "contentstackField": 'Author',
            "contentstackFieldType": 'reference',
            "backupFieldType": 'reference',
            "otherCmsField": 'Author',
            "otherCmsType": 'reference',
            "backupFieldUid": 'author',
            "refrenceTo": ['author'],
            "advanced": {
                "mandatory": false
            }
        });
    }
    const filePath = path_1.default.join(contentTypeFolderPath, `${type === null || type === void 0 ? void 0 : type.toLowerCase()}.json`);
    const contentType = {
        "status": 1,
        "isUpdated": false,
        "updateAt": "",
        "otherCmsTitle": type,
        "otherCmsUid": type,
        "contentstackTitle": type,
        "contentstackUid": type === null || type === void 0 ? void 0 : type.toLowerCase(),
        "type": "content_type",
        "fieldMapping": CT
    };
    try {
        yield helper_1.default.writeFileAsync(filePath, JSON.stringify(contentType, null, 4), 4);
        console.log(`Successfully created unified content type: ${type}.json`);
    }
    catch (error) {
        console.error(`Error writing unified content type file ${filePath}:`, error === null || error === void 0 ? void 0 : error.message);
    }
});
exports.default = extractItems;
