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
exports.getFieldUid = exports.getFieldName = void 0;
exports.schemaMapper = schemaMapper;
exports.handleAttributesSchema = handleAttributesSchema;
const index_1 = __importDefault(require("../utils/index"));
const generate_schema_1 = __importDefault(require("generate-schema"));
const getFieldName = (key) => {
    var _a;
    if (key === null || key === void 0 ? void 0 : key.includes('/')) {
        return (_a = key === null || key === void 0 ? void 0 : key.split('/')) === null || _a === void 0 ? void 0 : _a[1];
    }
    else if (key === null || key === void 0 ? void 0 : key.includes('wp:')) {
        const parts = key.split('_'); // e.g. ['wp', 'post', 'title']
        //let displayName : string = '';
        const displayName = parts
            .filter(item => !item.includes('wp:'))
            .join(' ');
        return displayName;
    }
    return key;
};
exports.getFieldName = getFieldName;
const getFieldUid = (key, affix) => {
    if (!key)
        return key;
    let uid = key.includes("/") ?
        key.split("/")[1]
        : key.startsWith("wp:") ?
            key.replace("wp:", "")
            : key;
    uid = uid === null || uid === void 0 ? void 0 : uid.toLowerCase().replace(/-/g, "_");
    const isPresent = index_1.default === null || index_1.default === void 0 ? void 0 : index_1.default.includes(uid);
    return isPresent ? `${affix}_${uid}` : uid;
};
exports.getFieldUid = getFieldUid;
function processInnerBlocks(key_1) {
    return __awaiter(this, arguments, void 0, function* (key, parentUid = null, parentFieldName = null, affix = null) {
        if (!(key === null || key === void 0 ? void 0 : key.innerBlocks) || !Array.isArray(key.innerBlocks) || key.innerBlocks.length === 0) {
            return [];
        }
        // Process inner blocks here - placeholder for actual implementation
        const results = [];
        for (const block of key.innerBlocks) {
            const processed = yield schemaMapper(block, parentUid, parentFieldName, affix || ' ');
            const flattenedProcessed = Array.isArray(processed) ? processed : [processed];
            flattenedProcessed.forEach((item) => {
                var _a;
                if (item) { // Only process non-null/undefined items
                    const existingBlock = results === null || results === void 0 ? void 0 : results.find((result) => {
                        var _a, _b;
                        return (result === null || result === void 0 ? void 0 : result.otherCmsField) === (item === null || item === void 0 ? void 0 : item.otherCmsField) &&
                            (result === null || result === void 0 ? void 0 : result.contentstackFieldType) === (item === null || item === void 0 ? void 0 : item.contentstackFieldType) &&
                            (result === null || result === void 0 ? void 0 : result.contentstackField) === (item === null || item === void 0 ? void 0 : item.contentstackField) &&
                            parentUid && ((_a = result === null || result === void 0 ? void 0 : result.contentstackFieldUid) === null || _a === void 0 ? void 0 : _a.includes(parentUid)) &&
                            ((_b = item === null || item === void 0 ? void 0 : item.contentstackFieldUid) === null || _b === void 0 ? void 0 : _b.includes(parentUid));
                    });
                    if (existingBlock && existingBlock !== 'undefined') {
                        existingBlock.advanced = Object.assign(Object.assign({}, existingBlock === null || existingBlock === void 0 ? void 0 : existingBlock.advanced), { multiple: true });
                    }
                    else {
                        (_a = results === null || results === void 0 ? void 0 : results.push) === null || _a === void 0 ? void 0 : _a.call(results, item);
                    }
                }
            });
        }
        return results;
    });
}
function handleAttributesSchema(schema_1) {
    return __awaiter(this, arguments, void 0, function* (schema, parentUid = null, parentName, affix = null) {
        var _a;
        const attributeSchema = [];
        for (const [field, config] of Object.entries(schema)) {
            const excludeKeys = ['id'];
            const type = config === null || config === void 0 ? void 0 : config.type;
            const fieldUid = parentUid ? `${parentUid}.${getFieldUid(field, affix || '')}` : getFieldUid(field, affix || '');
            const fieldName = parentUid ? `${parentName} > ${getFieldName(field)}` : getFieldName(field);
            if (type && !(excludeKeys === null || excludeKeys === void 0 ? void 0 : excludeKeys.includes(getFieldName(field)))) {
                switch (type) {
                    case 'string':
                        (_a = attributeSchema === null || attributeSchema === void 0 ? void 0 : attributeSchema.push) === null || _a === void 0 ? void 0 : _a.call(attributeSchema, {
                            uid: fieldUid,
                            otherCmsField: getFieldName(field),
                            otherCmsType: getFieldName(field),
                            contentstackField: fieldName,
                            contentstackFieldUid: fieldUid,
                            contentstackFieldType: 'single_line_text',
                            backupFieldType: 'single_line_text',
                            backupFieldUid: fieldUid,
                            advanced: {}
                        });
                        break;
                    case 'boolean':
                        attributeSchema.push({
                            uid: fieldUid,
                            otherCmsField: getFieldName(field),
                            otherCmsType: getFieldName(field),
                            contentstackField: fieldName,
                            contentstackFieldUid: fieldUid,
                            contentstackFieldType: 'boolean',
                            backupFieldType: 'boolean',
                            backupFieldUid: fieldUid,
                            advanced: {}
                        });
                        break;
                    case 'number':
                        attributeSchema.push({
                            uid: fieldUid,
                            otherCmsField: getFieldName(field),
                            otherCmsType: getFieldName(field),
                            contentstackField: fieldName,
                            contentstackFieldUid: fieldUid,
                            contentstackFieldType: 'number',
                            backupFieldType: 'number',
                            backupFieldUid: fieldUid,
                            advanced: {}
                        });
                        break;
                    default:
                        attributeSchema.push({
                            uid: fieldUid,
                            otherCmsField: getFieldName(field),
                            otherCmsType: getFieldName(field),
                            contentstackField: fieldName,
                            contentstackFieldUid: fieldUid,
                            contentstackFieldType: 'single_line_text',
                            backupFieldType: 'single_line_text',
                            backupFieldUid: fieldUid,
                            advanced: {}
                        });
                        break;
                }
            }
        }
        return attributeSchema;
    });
}
function processAttributes(key_1) {
    return __awaiter(this, arguments, void 0, function* (key, parentUid = null, parentName, affix = null) {
        const schema = generate_schema_1.default.json("schema", key === null || key === void 0 ? void 0 : key.attributes);
        const attributeSchema = yield handleAttributesSchema(schema === null || schema === void 0 ? void 0 : schema.properties, parentUid, parentName, affix);
        return attributeSchema;
    });
}
function schemaMapper(key_1) {
    return __awaiter(this, arguments, void 0, function* (key, parentUid = null, parentFieldName = null, affix) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6;
        if (Array.isArray(key)) {
            const schemas = [];
            for (const item of key) {
                const result = yield schemaMapper(item, parentUid, parentFieldName, affix);
                const existingBlock = schemas.find((schemaItem) => {
                    var _a;
                    return (result === null || result === void 0 ? void 0 : result.otherCmsField) === (schemaItem === null || schemaItem === void 0 ? void 0 : schemaItem.otherCmsField) &&
                        (schemaItem === null || schemaItem === void 0 ? void 0 : schemaItem.contentstackFieldType) === (result === null || result === void 0 ? void 0 : result.contentstackFieldType) &&
                        (schemaItem === null || schemaItem === void 0 ? void 0 : schemaItem.contentstackField) === (result === null || result === void 0 ? void 0 : result.contentstackField) &&
                        ((_a = result === null || result === void 0 ? void 0 : result.contentstackFieldUid) === null || _a === void 0 ? void 0 : _a.includes(parentUid));
                });
                (_a = item === null || item === void 0 ? void 0 : item.contentstackFieldUid) === null || _a === void 0 ? void 0 : _a.includes(parentUid);
                if (existingBlock && typeof existingBlock === 'object' && 'advanced' in existingBlock) {
                    existingBlock.advanced = Object.assign(Object.assign({}, existingBlock.advanced), { multiple: true });
                }
                else {
                    if (Array.isArray(result)) {
                        schemas.push(...result);
                    }
                    else {
                        schemas.push(result);
                    }
                }
            }
            return schemas;
        }
        const fieldName = parentFieldName ? `${parentFieldName} > ${getFieldName((_d = (_c = (_b = key === null || key === void 0 ? void 0 : key.attributes) === null || _b === void 0 ? void 0 : _b.metadata) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : ((key === null || key === void 0 ? void 0 : key.name) === 'core/missing' ? 'body' : key === null || key === void 0 ? void 0 : key.name))}` : getFieldName((_g = (_f = (_e = key === null || key === void 0 ? void 0 : key.attributes) === null || _e === void 0 ? void 0 : _e.metadata) === null || _f === void 0 ? void 0 : _f.name) !== null && _g !== void 0 ? _g : ((key === null || key === void 0 ? void 0 : key.name) === 'core/missing' ? 'body' : key === null || key === void 0 ? void 0 : key.name));
        switch (key === null || key === void 0 ? void 0 : key.name) {
            case 'core/paragraph':
            case 'core/html':
            case 'core/pullquote':
            case 'core/table':
            case 'core/columns':
            case 'core/missing':
            case 'core/code':
                {
                    const rteUid = parentUid ?
                        `${parentUid}.${getFieldUid(`${key === null || key === void 0 ? void 0 : key.name}_${key === null || key === void 0 ? void 0 : key.clientId}`, affix)}`
                        : getFieldUid(`${key === null || key === void 0 ? void 0 : key.name}_${key === null || key === void 0 ? void 0 : key.clientId}`, affix);
                    return {
                        uid: rteUid,
                        otherCmsField: getFieldName(key === null || key === void 0 ? void 0 : key.name),
                        otherCmsType: getFieldName((_k = (_j = (_h = key === null || key === void 0 ? void 0 : key.attributes) === null || _h === void 0 ? void 0 : _h.metadata) === null || _j === void 0 ? void 0 : _j.name) !== null && _k !== void 0 ? _k : key === null || key === void 0 ? void 0 : key.name),
                        contentstackField: fieldName,
                        contentstackFieldUid: rteUid,
                        contentstackFieldType: 'json',
                        backupFieldType: 'json',
                        backupFieldUid: rteUid,
                        advanced: {}
                    };
                }
                break;
            case 'core/image':
            case 'core/audio':
            case 'core/video':
            case 'core/file':
                {
                    const fileUid = parentUid ? `${parentUid}.${getFieldUid(`${key === null || key === void 0 ? void 0 : key.name}_${key === null || key === void 0 ? void 0 : key.clientId}`, affix)}` : getFieldUid(`${key === null || key === void 0 ? void 0 : key.name}_${key === null || key === void 0 ? void 0 : key.clientId}`, affix);
                    return {
                        uid: fileUid,
                        otherCmsField: getFieldName(key === null || key === void 0 ? void 0 : key.name),
                        otherCmsType: getFieldName((_o = (_m = (_l = key === null || key === void 0 ? void 0 : key.attributes) === null || _l === void 0 ? void 0 : _l.metadata) === null || _m === void 0 ? void 0 : _m.name) !== null && _o !== void 0 ? _o : key === null || key === void 0 ? void 0 : key.name),
                        contentstackField: fieldName,
                        contentstackFieldUid: fileUid,
                        contentstackFieldType: 'file',
                        backupFieldType: 'file',
                        backupFieldUid: fileUid,
                        advanced: {}
                    };
                }
                break;
            case 'core/heading':
            case 'core/list-item':
                {
                    const textUid = parentUid ? `${parentUid}.${getFieldUid(`${key === null || key === void 0 ? void 0 : key.name}_${key === null || key === void 0 ? void 0 : key.clientId}`, affix)}` : getFieldUid(`${key === null || key === void 0 ? void 0 : key.name}_${key === null || key === void 0 ? void 0 : key.clientId}`, affix);
                    return {
                        uid: textUid,
                        otherCmsField: getFieldName(key === null || key === void 0 ? void 0 : key.name),
                        otherCmsType: getFieldName((_r = (_q = (_p = key === null || key === void 0 ? void 0 : key.attributes) === null || _p === void 0 ? void 0 : _p.metadata) === null || _q === void 0 ? void 0 : _q.name) !== null && _r !== void 0 ? _r : key === null || key === void 0 ? void 0 : key.name),
                        contentstackField: fieldName,
                        contentstackFieldUid: textUid,
                        contentstackFieldType: 'single_line_text',
                        backupFieldType: 'single_line_text',
                        backupFieldUid: textUid,
                        advanced: {}
                    };
                }
                break;
            case 'core/social-link':
            case 'core/navigation-link':
                {
                    const LinkUid = parentUid ? `${parentUid}.${getFieldUid(key === null || key === void 0 ? void 0 : key.name, affix)}` : getFieldUid(`${key === null || key === void 0 ? void 0 : key.name}_${key === null || key === void 0 ? void 0 : key.clientId}`, affix);
                    return {
                        uid: LinkUid,
                        otherCmsField: getFieldName(key === null || key === void 0 ? void 0 : key.name),
                        otherCmsType: getFieldName((_u = (_t = (_s = key === null || key === void 0 ? void 0 : key.attributes) === null || _s === void 0 ? void 0 : _s.metadata) === null || _t === void 0 ? void 0 : _t.name) !== null && _u !== void 0 ? _u : key === null || key === void 0 ? void 0 : key.name),
                        contentstackField: fieldName,
                        contentstackFieldUid: LinkUid,
                        contentstackFieldType: 'link',
                        backupFieldType: 'link',
                        backupFieldUid: LinkUid,
                        advanced: {}
                    };
                }
                break;
            case 'core/list':
            case 'core/quote':
            case 'core/cover':
            case 'core/social-links':
            case 'core/details':
            case 'core/group':
            case 'core/navigation':
                {
                    const groupSchema = [];
                    const groupUid = parentUid ? `${parentUid}.${getFieldUid(`${key === null || key === void 0 ? void 0 : key.name}_${key === null || key === void 0 ? void 0 : key.clientId}`, affix)}` : getFieldUid(`${key === null || key === void 0 ? void 0 : key.name}_${key === null || key === void 0 ? void 0 : key.clientId}`, affix);
                    const innerBlocks = yield processInnerBlocks(key, groupUid, fieldName, affix);
                    (innerBlocks === null || innerBlocks === void 0 ? void 0 : innerBlocks.length) > 0 && groupSchema.push({
                        uid: groupUid,
                        otherCmsField: getFieldName(key === null || key === void 0 ? void 0 : key.name),
                        otherCmsType: getFieldName((_x = (_w = (_v = key === null || key === void 0 ? void 0 : key.attributes) === null || _v === void 0 ? void 0 : _v.metadata) === null || _w === void 0 ? void 0 : _w.name) !== null && _x !== void 0 ? _x : key === null || key === void 0 ? void 0 : key.name),
                        contentstackField: fieldName,
                        contentstackFieldUid: groupUid,
                        contentstackFieldType: 'group',
                        backupFieldType: 'group',
                        backupFieldUid: groupUid,
                        advanced: {}
                    });
                    if ((innerBlocks === null || innerBlocks === void 0 ? void 0 : innerBlocks.length) > 0) {
                        innerBlocks.forEach(schemaObj => {
                            if (schemaObj) {
                                if (Array.isArray(schemaObj)) {
                                    groupSchema.push(...schemaObj);
                                }
                                else {
                                    groupSchema.push(schemaObj);
                                }
                            }
                        });
                        return groupSchema;
                    }
                }
                break;
            case 'core/search':
                {
                    const searchEleUid = parentUid ? `${parentUid}.${getFieldUid(`${key === null || key === void 0 ? void 0 : key.name}_${key === null || key === void 0 ? void 0 : key.clientId}`, affix)}` : getFieldUid(`${key === null || key === void 0 ? void 0 : key.name}_${key === null || key === void 0 ? void 0 : key.clientId}`, affix);
                    const searchEle = yield processAttributes(key, searchEleUid, fieldName, affix);
                    searchEle.push({
                        uid: searchEleUid,
                        otherCmsField: getFieldName(key === null || key === void 0 ? void 0 : key.name),
                        otherCmsType: getFieldName((_0 = (_z = (_y = key === null || key === void 0 ? void 0 : key.attributes) === null || _y === void 0 ? void 0 : _y.metadata) === null || _z === void 0 ? void 0 : _z.name) !== null && _0 !== void 0 ? _0 : key === null || key === void 0 ? void 0 : key.name),
                        contentstackField: fieldName,
                        contentstackFieldUid: searchEleUid,
                        contentstackFieldType: 'group',
                        backupFieldType: 'group',
                        backupFieldUid: searchEleUid,
                    });
                    return searchEle;
                }
                break;
            case 'core/button':
                {
                    const parentName = parentFieldName ? `${parentFieldName}` : `${getFieldName((_3 = (_2 = (_1 = key === null || key === void 0 ? void 0 : key.attributes) === null || _1 === void 0 ? void 0 : _1.metadata) === null || _2 === void 0 ? void 0 : _2.name) !== null && _3 !== void 0 ? _3 : key === null || key === void 0 ? void 0 : key.name)}`;
                    const buttonUid = parentUid ? `${parentUid}` : getFieldUid(`${key === null || key === void 0 ? void 0 : key.name}_${key === null || key === void 0 ? void 0 : key.clientId}`, affix);
                    const button = yield processAttributes(key, buttonUid, parentName, affix);
                    return button;
                }
                break;
            case 'core/buttons':
                {
                    const groupSchema = [];
                    const groupUid = parentUid ? `${parentUid}.${getFieldUid(`${key === null || key === void 0 ? void 0 : key.name}_${key === null || key === void 0 ? void 0 : key.clientId}`, affix)}` : getFieldUid(`${key === null || key === void 0 ? void 0 : key.name}_${key === null || key === void 0 ? void 0 : key.clientId}`, affix);
                    const innerBlocks = yield processInnerBlocks(key, groupUid, fieldName, affix);
                    (innerBlocks === null || innerBlocks === void 0 ? void 0 : innerBlocks.length) > 0 && groupSchema.push({
                        uid: groupUid,
                        otherCmsField: getFieldName(key === null || key === void 0 ? void 0 : key.name),
                        otherCmsType: getFieldName((_6 = (_5 = (_4 = key === null || key === void 0 ? void 0 : key.attributes) === null || _4 === void 0 ? void 0 : _4.metadata) === null || _5 === void 0 ? void 0 : _5.name) !== null && _6 !== void 0 ? _6 : key === null || key === void 0 ? void 0 : key.name),
                        contentstackField: fieldName,
                        contentstackFieldUid: groupUid,
                        contentstackFieldType: 'group',
                        backupFieldType: 'group',
                        backupFieldUid: groupUid,
                        advanced: {}
                    });
                    if ((innerBlocks === null || innerBlocks === void 0 ? void 0 : innerBlocks.length) > 0) {
                        innerBlocks.forEach(schemaObj => {
                            if (schemaObj) {
                                if (Array.isArray(schemaObj)) {
                                    groupSchema.push(...schemaObj);
                                }
                                else {
                                    groupSchema.push(schemaObj);
                                }
                            }
                        });
                        return groupSchema;
                    }
                }
                break;
        }
        return [];
    });
}
