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
const constant_1 = require("../../constant");
const helper_1 = require("../../helper");
const component_identifier_1 = require("../../helper/component.identifier");
const fragment_1 = require("./fragment");
const contentstackFields_1 = require("./fields/contentstackFields");
const fieldMappings_merge_1 = require("../../helper/fieldMappings.merge");
const contentType_flatten_1 = require("../../helper/contentType.flatten");
function processTemplateItems(itemsOrder, items, contentstackComponents) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d;
        const schema = [];
        for (const element of itemsOrder) {
            const item = items === null || items === void 0 ? void 0 : items[element];
            const type = item === null || item === void 0 ? void 0 : item[':type'];
            const isContainerCheck = (0, component_identifier_1.isContainerComponent)(type);
            if ((0, component_identifier_1.parseXFPath)(type)) {
                const keys = (_a = item === null || item === void 0 ? void 0 : item.localizedFragmentVariationPath) === null || _a === void 0 ? void 0 : _a.split('/');
                const keyElement = element === null || element === void 0 ? void 0 : element.split('-');
                const segmentData = keys === null || keys === void 0 ? void 0 : keys.filter((segment) => keyElement === null || keyElement === void 0 ? void 0 : keyElement.includes(segment));
                const referenceField = yield (0, fragment_1.createFragmentComponent)(segmentData, item, contentstackComponents);
                schema === null || schema === void 0 ? void 0 : schema.push(referenceField);
            }
            else if (isContainerCheck === null || isContainerCheck === void 0 ? void 0 : isContainerCheck.isContainer) {
                const itemsOrder = item === null || item === void 0 ? void 0 : item[':itemsOrder'];
                const items = item === null || item === void 0 ? void 0 : item[':items'];
                const conatinerSchema = yield processTemplateItems(itemsOrder, items, contentstackComponents);
                if (conatinerSchema === null || conatinerSchema === void 0 ? void 0 : conatinerSchema.length) {
                    const modularData = new contentstackFields_1.ModularBlocksField({
                        uid: element,
                        displayName: element,
                        blocks: [],
                    }).toContentstack();
                    for (const object of conatinerSchema) {
                        if ((object === null || object === void 0 ? void 0 : object.contentstackFieldType) === 'group' ||
                            (object === null || object === void 0 ? void 0 : object.contentstackFieldType) === 'modular_blocks') {
                            const block = {
                                uid: object === null || object === void 0 ? void 0 : object.uid,
                                otherCmsField: object === null || object === void 0 ? void 0 : object.otherCmsField,
                                contentstackField: object === null || object === void 0 ? void 0 : object.contentstackField,
                                contentstackFieldUid: object === null || object === void 0 ? void 0 : object.contentstackFieldUid,
                                backupFieldUid: object === null || object === void 0 ? void 0 : object.backupFieldUid,
                                contentstackFieldType: 'modular_blocks_child',
                                backupFieldType: 'modular_blocks_child',
                                otherCmsType: 'modular_blocks_child',
                                schema: (object === null || object === void 0 ? void 0 : object.contentstackFieldType) === 'modular_blocks' ? [object] : object === null || object === void 0 ? void 0 : object.schema,
                            };
                            (_b = modularData.blocks) === null || _b === void 0 ? void 0 : _b.push(block);
                        }
                        else if (object) {
                            const block = {
                                uid: object === null || object === void 0 ? void 0 : object.uid,
                                otherCmsField: object === null || object === void 0 ? void 0 : object.otherCmsField,
                                contentstackField: object === null || object === void 0 ? void 0 : object.contentstackField,
                                contentstackFieldUid: object === null || object === void 0 ? void 0 : object.contentstackFieldUid,
                                backupFieldUid: object === null || object === void 0 ? void 0 : object.backupFieldUid,
                                contentstackFieldType: 'modular_blocks_child',
                                backupFieldType: 'modular_blocks_child',
                                otherCmsType: 'modular_blocks_child',
                                schema: [object],
                            };
                            (_c = modularData.blocks) === null || _c === void 0 ? void 0 : _c.push(block);
                        }
                    }
                    schema === null || schema === void 0 ? void 0 : schema.push(modularData);
                }
            }
            else {
                const [, csValue] = (_d = (0, helper_1.findComponentByType)(contentstackComponents, type)) !== null && _d !== void 0 ? _d : [];
                if (csValue && typeof csValue === "object" && "type" in csValue) {
                    schema === null || schema === void 0 ? void 0 : schema.push(csValue);
                }
                else {
                    console.info("🚀 ~ processTemplateItems ~ type:", type);
                }
            }
        }
        return schema;
    });
}
const contentTypeMaker = (_a) => __awaiter(void 0, [_a], void 0, function* ({ templateData, affix, contentstackComponents }) {
    var _b, e_1, _c, _d, _e, e_2, _f, _g;
    var _h, _j, _k, _l;
    const contentData = [];
    try {
        for (var _m = true, _o = __asyncValues(Object.entries(templateData !== null && templateData !== void 0 ? templateData : {})), _p; _p = yield _o.next(), _b = _p.done, !_b; _m = true) {
            _d = _p.value;
            _m = false;
            const [key, value] = _d;
            if (!Array.isArray(value))
                return console.warn(`Value for key "${key}" is not an array:`, value);
            try {
                for (var _q = true, value_1 = (e_2 = void 0, __asyncValues(value)), value_1_1; value_1_1 = yield value_1.next(), _e = value_1_1.done, !_e; _q = true) {
                    _g = value_1_1.value;
                    _q = false;
                    const template = _g;
                    const itemsOrder = (_j = (_h = template === null || template === void 0 ? void 0 : template[':items']) === null || _h === void 0 ? void 0 : _h.root) === null || _j === void 0 ? void 0 : _j[':itemsOrder'];
                    const items = (_l = (_k = template === null || template === void 0 ? void 0 : template[':items']) === null || _k === void 0 ? void 0 : _k.root) === null || _l === void 0 ? void 0 : _l[':items'];
                    const Schema = yield processTemplateItems(itemsOrder, items, contentstackComponents);
                    const contentTypeObject = (0, helper_1.createContentTypeObject)({
                        otherCmsTitle: key,
                        otherCmsUid: key,
                        fieldMapping: Schema,
                    });
                    contentData === null || contentData === void 0 ? void 0 : contentData.push(contentTypeObject);
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (!_q && !_e && (_f = value_1.return)) yield _f.call(value_1);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (!_m && !_b && (_c = _o.return)) yield _c.call(_o);
        }
        finally { if (e_1) throw e_1.error; }
    }
    const contentDataFilePath = path_1.default.resolve(constant_1.CONSTANTS === null || constant_1.CONSTANTS === void 0 ? void 0 : constant_1.CONSTANTS.CONENT_DATA_FILE);
    const processData = (0, fieldMappings_merge_1.processContentModels)(contentData);
    const flattenData = (0, contentType_flatten_1.flattenContentTypes)(processData);
    flattenData.forEach((schema) => {
        (0, helper_1.ensureField)(schema.fieldMapping, {
            uid: 'url',
            otherCmsField: 'url',
            otherCmsType: 'text',
            contentstackField: 'Url',
            contentstackFieldUid: 'url',
            contentstackFieldType: 'url',
            backupFieldType: 'url',
            backupFieldUid: 'url'
        }, 'url');
        (0, helper_1.ensureField)(schema.fieldMapping, {
            uid: 'title',
            otherCmsField: 'title',
            otherCmsType: 'text',
            contentstackField: 'Title',
            contentstackFieldUid: 'title',
            contentstackFieldType: 'text',
            backupFieldType: 'text',
            backupFieldUid: 'title'
        }, 'title');
    });
    yield (0, helper_1.writeJsonFile)(flattenData, contentDataFilePath);
    return flattenData !== null && flattenData !== void 0 ? flattenData : [];
});
exports.default = contentTypeMaker;
