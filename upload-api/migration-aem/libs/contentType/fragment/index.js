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
exports.createFragmentComponent = void 0;
const path_1 = __importDefault(require("path"));
const constant_1 = require("../../../constant");
const helper_1 = require("../../../helper");
const contentstackFields_1 = require("../fields/contentstackFields");
const createFragmentComponent = (segmentData, itemData, contentstackComponents) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b, _c, _d;
    const key = segmentData === null || segmentData === void 0 ? void 0 : segmentData[0];
    if (!key) {
        console.info('Fragment key does not exist. itemsOrder:', itemData === null || itemData === void 0 ? void 0 : itemData[':itemsOrder']);
        return null;
    }
    const fragmentPath = path_1.default.resolve(constant_1.CONSTANTS === null || constant_1.CONSTANTS === void 0 ? void 0 : constant_1.CONSTANTS.FRAGMENT_FILE);
    const data = (_a = (yield (0, helper_1.readFiles)(fragmentPath))) !== null && _a !== void 0 ? _a : {};
    // Ensure data[key] is an array
    if (!Array.isArray(data[key])) {
        data[key] = [];
    }
    // Iterate over items and push to fragment array, avoiding duplicates
    for (const [itemKey, objValue] of Object.entries((_d = (_c = (_b = itemData === null || itemData === void 0 ? void 0 : itemData[':items']) === null || _b === void 0 ? void 0 : _b.root) === null || _c === void 0 ? void 0 : _c[':items']) !== null && _d !== void 0 ? _d : {})) {
        const type = objValue[':type'];
        // Find matching entry in contentstackComponents by type
        const foundEntry = Object.entries(contentstackComponents !== null && contentstackComponents !== void 0 ? contentstackComponents : {}).find(([, csValue]) => csValue['type'] === type);
        if (foundEntry) {
            const [, csValue] = foundEntry;
            const obj = { [itemKey]: csValue };
            if (!data[key].some((existing) => JSON.stringify(existing) === JSON.stringify(obj))) {
                data[key].push(obj);
            }
        }
    }
    // Remove empty objects from the fragment array
    data[key] = data[key].filter((entry) => Object.keys(entry).length > 0);
    // Write updated data back to file
    yield (0, helper_1.writeJsonFile)(data, fragmentPath);
    if (data[key].length) {
        return new contentstackFields_1.ReferenceField({
            uid: key,
            displayName: key,
            refrenceTo: [key]
        }).toContentstack();
    }
    return null;
});
exports.createFragmentComponent = createFragmentComponent;
