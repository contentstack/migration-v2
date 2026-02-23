"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NavigationComponent = void 0;
const fields_1 = require("../fields");
const contentstackFields_1 = require("../fields/contentstackFields");
const navigationExclude = [
    // Add keys or values you want to exclude from navigation mapping
    'dataLayer',
    ':type',
    'path',
    'id'
];
class NavigationComponent extends fields_1.ContentstackComponent {
    /**
     * Determines if a component is a text component
     */
    static isNavigation(component) {
        var _a, _b;
        const properties = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties;
        if (properties && typeof properties === 'object') {
            const typeField = properties[":type"];
            if ((typeof typeField === "string" && typeField.includes("/components/navigation")) ||
                (typeof typeField === "object" && ((_b = typeField.value) === null || _b === void 0 ? void 0 : _b.includes("/components/navigation")))) {
                return true;
            }
        }
        return false;
    }
    /**
   * Determines if a component is a language navigation component
   */
    static isLanguageNavigation(component) {
        var _a, _b;
        const properties = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties;
        if (properties && typeof properties === 'object') {
            const typeField = properties[":type"];
            if ((typeof typeField === "string" && typeField.includes("/components/languagenavigation")) ||
                (typeof typeField === "object" && ((_b = typeField.value) === null || _b === void 0 ? void 0 : _b.includes("/components/languagenavigation")))) {
                return true;
            }
        }
        return false;
    }
    /**
   * Maps the title property of a navigation component to Contentstack format
   */
    static mapNavigationTOContentstack(component, parentKey) {
        var _a, _b, _c, _d, _e, _f;
        const componentSchema = (_b = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties) === null || _b === void 0 ? void 0 : _b.items;
        if ((componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.type) === 'array' && ((_c = componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.items) === null || _c === void 0 ? void 0 : _c.properties)) {
            const componentsData = [];
            for (const [key, value] of Object.entries(componentSchema.items.properties)) {
                const schemaProp = value;
                if (!navigationExclude.includes(key) &&
                    (schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type) &&
                    NavigationComponent.fieldTypeMap[schemaProp.type]) {
                    componentsData.push(NavigationComponent.fieldTypeMap[schemaProp.type](key, schemaProp));
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
        return [];
    }
}
exports.NavigationComponent = NavigationComponent;
NavigationComponent.fieldTypeMap = {
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
    object: (key, schemaProp) => {
        var _a, _b;
        const urlValue = (_b = (_a = schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.properties) === null || _a === void 0 ? void 0 : _a.url) === null || _b === void 0 ? void 0 : _b.value;
        if (urlValue !== undefined) {
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
            for (const [key, value] of Object.entries(schemaProp.items.properties)) {
                const schemaProp = value;
                if (!navigationExclude.includes(key) &&
                    (schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type) &&
                    NavigationComponent.fieldTypeMap[schemaProp.type]) {
                    componentsData.push(NavigationComponent.fieldTypeMap[schemaProp.type](key, schemaProp));
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
