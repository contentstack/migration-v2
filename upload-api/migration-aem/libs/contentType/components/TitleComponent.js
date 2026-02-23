"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TitleComponent = void 0;
const fields_1 = require("../fields");
const contentstackFields_1 = require("../fields/contentstackFields");
const titleExclude = [
    'dataLayer',
    ':type',
    'id',
];
class TitleComponent extends fields_1.ContentstackComponent {
    /**
     * Determines if a component is a title component
     */
    static isTitle(component) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        // Handle raw component format
        if (component && typeof component === 'object') {
            // Direct properties format
            if (component[":type"] &&
                component[":type"].includes("/components/title") &&
                ((_a = component.type) === null || _a === void 0 ? void 0 : _a.match(/^h[1-6]$/))) {
                return true;
            }
            // Properties object format
            if (component.properties &&
                ((_c = (_b = component.properties[":type"]) === null || _b === void 0 ? void 0 : _b.value) === null || _c === void 0 ? void 0 : _c.includes("/components/title")) &&
                ((_e = (_d = component.properties.type) === null || _d === void 0 ? void 0 : _d.value) === null || _e === void 0 ? void 0 : _e.match(/^h[1-6]$/))) {
                return true;
            }
            // Handle convertedSchema format
            if (component.convertedSchema &&
                component.convertedSchema.properties &&
                ((_g = (_f = component.convertedSchema.properties[":type"]) === null || _f === void 0 ? void 0 : _f.value) === null || _g === void 0 ? void 0 : _g.includes("/components/title")) &&
                ((_j = (_h = component.convertedSchema.properties.type) === null || _h === void 0 ? void 0 : _h.value) === null || _j === void 0 ? void 0 : _j.match(/^h[1-6]$/))) {
                return true;
            }
        }
        return false;
    }
    /**
     * Maps an AEM title component to Contentstack format with grouped properties
     */
    static mapTitleToContentstack(component, parentKey) {
        var _a, _b;
        const properties = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties;
        if (!properties)
            return [];
        const fields = [];
        for (const [key, value] of Object.entries(properties)) {
            if (titleExclude.includes(key))
                continue;
            const schemaProp = value;
            if ((schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type) && TitleComponent.fieldTypeMap[schemaProp.type]) {
                fields.push(TitleComponent.fieldTypeMap[schemaProp.type](key, schemaProp));
            }
        }
        const hasTitleOrText = fields.some(f => ['title', 'text'].includes(f.uid));
        if (!hasTitleOrText) {
            fields.push(new contentstackFields_1.TextField({
                uid: "text",
                displayName: "text",
                description: "",
                required: false,
                multiline: false
            }).toContentstack());
        }
        return Object.assign(Object.assign({}, new contentstackFields_1.GroupField({
            uid: parentKey,
            displayName: parentKey,
            fields,
            required: false,
            multiple: false
        }).toContentstack()), { type: (_b = component.convertedSchema.properties[":type"]) === null || _b === void 0 ? void 0 : _b.value });
    }
}
exports.TitleComponent = TitleComponent;
TitleComponent.fieldTypeMap = {
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
