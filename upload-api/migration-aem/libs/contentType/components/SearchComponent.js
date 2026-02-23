"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchComponent = void 0;
const fields_1 = require("../fields");
const contentstackFields_1 = require("../fields/contentstackFields"); // ADD NumberField
const searchExclude = [
    'dataLayer',
    ':type',
    'id',
    'relativePath',
    'searchRootPagePath'
];
class SearchComponent extends fields_1.ContentstackComponent {
    /**
     * Determines if a component is a search component
     */
    static isSearch(component) {
        var _a, _b;
        const properties = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties;
        if (properties && typeof properties === 'object') {
            const typeField = properties[":type"];
            if ((typeof typeField === "string" && typeField.includes("/components/search")) ||
                (typeof typeField === "object" && ((_b = typeField.value) === null || _b === void 0 ? void 0 : _b.includes("/components/search")))) {
                return true;
            }
        }
        return false;
    }
    /**
     * Maps the search component schema to Contentstack fields
     */
    static mapSearchToContentstack(component, parentKey) {
        var _a, _b, _c, _d;
        const properties = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties;
        if (!properties)
            return [];
        const fields = [];
        for (const [key, value] of Object.entries(properties)) {
            if (searchExclude.includes(key))
                continue;
            const schemaProp = value;
            if ((schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type) && SearchComponent.fieldTypeMap[schemaProp.type]) {
                fields.push(SearchComponent.fieldTypeMap[schemaProp.type](key, schemaProp));
            }
        }
        return Object.assign(Object.assign({}, new contentstackFields_1.GroupField({
            uid: parentKey,
            displayName: parentKey,
            fields,
            required: false,
            multiple: false
        }).toContentstack()), { type: (_d = (_c = (_b = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _b === void 0 ? void 0 : _b.properties) === null || _c === void 0 ? void 0 : _c[":type"]) === null || _d === void 0 ? void 0 : _d.value });
    }
}
exports.SearchComponent = SearchComponent;
SearchComponent.fieldTypeMap = {
    string: (key, schemaProp) => new contentstackFields_1.TextField({
        uid: key,
        displayName: key,
        description: "",
        defaultValue: ""
    }).toContentstack(),
    boolean: (key, schemaProp) => new contentstackFields_1.BooleanField({
        uid: key,
        displayName: key,
        description: "",
        defaultValue: false
    }).toContentstack(),
    integer: (key, schemaProp) => new contentstackFields_1.TextField({
        uid: key,
        displayName: key,
        description: "",
        isNumber: true,
        defaultValue: ""
    }).toContentstack(),
    object: () => null,
    array: () => null
};
