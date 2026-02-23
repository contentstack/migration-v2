"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ButtonComponent = void 0;
const helper_1 = require("../../../helper");
const fields_1 = require("../fields");
const contentstackFields_1 = require("../fields/contentstackFields");
const buttonExclude = [
    'dataLayer',
    ':type',
    'path',
    'id',
    'appliedCssClassNames'
];
class ButtonComponent extends fields_1.ContentstackComponent {
    static isButton(component) {
        var _a, _b;
        const properties = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties;
        if (properties && typeof properties === 'object') {
            const typeField = properties[":type"];
            if ((typeof typeField === "string" && typeField.includes("/components/button")) ||
                (typeof typeField === "object" && ((_b = typeField.value) === null || _b === void 0 ? void 0 : _b.includes("/components/button")))) {
                return true;
            }
        }
        return false;
    }
    static mapButtonToContentstack(component, parentKey) {
        var _a, _b, _c;
        const componentSchema = component === null || component === void 0 ? void 0 : component.convertedSchema;
        if ((componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.type) === 'object' && (componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.properties)) {
            const componentsData = [];
            for (const [key, value] of Object.entries(componentSchema.properties)) {
                const schemaProp = value;
                if (!buttonExclude.includes(key) &&
                    (schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type) &&
                    ButtonComponent.fieldTypeMap[schemaProp.type]) {
                    const isImg = (0, helper_1.isImageType)(schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.value);
                    const isUrl = (0, helper_1.isUrlPath)(schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.value);
                    componentsData.push(ButtonComponent.fieldTypeMap[schemaProp.type](key, schemaProp, isImg, isUrl));
                }
            }
            return (componentsData === null || componentsData === void 0 ? void 0 : componentsData.length) ? Object.assign(Object.assign({}, new contentstackFields_1.GroupField({
                uid: parentKey,
                displayName: parentKey,
                fields: componentsData,
                required: false,
                multiple: false
            }).toContentstack()), { type: (_c = (_b = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties) === null || _b === void 0 ? void 0 : _b[":type"]) === null || _c === void 0 ? void 0 : _c.value }) : null;
        }
    }
}
exports.ButtonComponent = ButtonComponent;
ButtonComponent.fieldTypeMap = {
    string: (key, schemaProp, isImg, isURl = false) => {
        if (isURl) {
            return new contentstackFields_1.LinkField({
                uid: key,
                displayName: key,
                description: "",
                defaultValue: "",
            }).toContentstack();
        }
        return isImg ? new contentstackFields_1.ImageField({
            uid: key,
            displayName: key,
        }).toContentstack()
            : new contentstackFields_1.TextField({
                uid: key,
                displayName: key,
                description: "",
                defaultValue: schemaProp.value
            }).toContentstack();
    },
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
    array: () => null,
};
