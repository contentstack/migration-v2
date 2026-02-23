"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BreadcrumbComponent = void 0;
const fields_1 = require("../fields");
const contentstackFields_1 = require("../fields/contentstackFields");
const breadcrumbExclude = [
    'dataLayer',
    ':type',
    'path',
    'id'
];
class BreadcrumbComponent extends fields_1.ContentstackComponent {
    static isBreadcrumb(component) {
        var _a, _b;
        const properties = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties;
        if (properties && typeof properties === 'object') {
            const typeField = properties[":type"];
            if ((typeof typeField === "string" && typeField.includes("components/navigation/breadcrumb")) ||
                (typeof typeField === "object" && ((_b = typeField.value) === null || _b === void 0 ? void 0 : _b.includes("components/navigation/breadcrumb")))) {
                return true;
            }
        }
        return false;
    }
    static mapBreadcrumbToContentstack(component, parentKey) {
        var _a, _b, _c, _d, _e, _f;
        const breadcrumbItems = (_b = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties) === null || _b === void 0 ? void 0 : _b.breadcrumbLinkItems;
        if ((breadcrumbItems === null || breadcrumbItems === void 0 ? void 0 : breadcrumbItems.type) === 'array' && ((_c = breadcrumbItems === null || breadcrumbItems === void 0 ? void 0 : breadcrumbItems.items) === null || _c === void 0 ? void 0 : _c.properties)) {
            const componentsData = [];
            for (const [key, value] of Object.entries(breadcrumbItems.items.properties)) {
                const schemaProp = value;
                if (!breadcrumbExclude.includes(key) &&
                    (schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type) &&
                    BreadcrumbComponent.fieldTypeMap[schemaProp.type]) {
                    componentsData.push(BreadcrumbComponent.fieldTypeMap[schemaProp.type](key, schemaProp));
                }
            }
            return Object.assign(Object.assign({}, new contentstackFields_1.GroupField({
                uid: parentKey,
                displayName: parentKey,
                fields: componentsData,
                required: false,
                multiple: true
            }).toContentstack()), { type: (_f = (_e = (_d = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _d === void 0 ? void 0 : _d.properties) === null || _e === void 0 ? void 0 : _e[":type"]) === null || _f === void 0 ? void 0 : _f.value });
        }
    }
}
exports.BreadcrumbComponent = BreadcrumbComponent;
BreadcrumbComponent.fieldTypeMap = {
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
    object: (key, schemaProp) => {
        var _a, _b;
        // For breadcrumb, handle the link object
        if (((_b = (_a = schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.properties) === null || _a === void 0 ? void 0 : _a.url) === null || _b === void 0 ? void 0 : _b.value) !== undefined) {
            return new contentstackFields_1.LinkField({
                uid: key,
                displayName: key,
                description: "",
                defaultValue: ""
            }).toContentstack();
        }
        return null;
    },
    array: (key, schemaProp) => {
        var _a, _b;
        if (((_a = schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.value) === null || _a === void 0 ? void 0 : _a.length) &&
            (schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type) === 'array' &&
            ((_b = schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.items) === null || _b === void 0 ? void 0 : _b.properties)) {
            const componentsData = [];
            for (const [itemKey, itemValue] of Object.entries(schemaProp.items.properties)) {
                const itemSchemaProp = itemValue;
                if (!breadcrumbExclude.includes(itemKey) &&
                    (itemSchemaProp === null || itemSchemaProp === void 0 ? void 0 : itemSchemaProp.type) &&
                    BreadcrumbComponent.fieldTypeMap[itemSchemaProp.type]) {
                    componentsData.push(BreadcrumbComponent.fieldTypeMap[itemSchemaProp.type](itemKey, itemSchemaProp));
                }
            }
            return new contentstackFields_1.GroupField({
                uid: key,
                displayName: key,
                fields: componentsData,
                required: false,
                multiple: true
            }).toContentstack();
        }
        return null;
    }
};
