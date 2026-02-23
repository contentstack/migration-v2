"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageComponent = void 0;
const helper_1 = require("../../../helper");
const fields_1 = require("../fields");
const contentstackFields_1 = require("../fields/contentstackFields");
const imageExclude = [
    'dataLayer',
    ':type',
    'id',
    //no need for this in contentstack its can handle by api call
    'srcUriTemplate'
];
class ImageComponent extends fields_1.ContentstackComponent {
    static isImage(component) {
        var _a, _b;
        const properties = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties;
        if (properties && typeof properties === 'object') {
            const typeField = properties[":type"];
            if ((typeof typeField === "string" && typeField.includes("/components/image")) ||
                (typeof typeField === "object" && ((_b = typeField.value) === null || _b === void 0 ? void 0 : _b.includes("/components/image")))) {
                return true;
            }
        }
        return false;
    }
    static mapImageToContentstack(component, parentKey) {
        var _a, _b, _c;
        const componentSchema = component === null || component === void 0 ? void 0 : component.convertedSchema;
        if ((componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.type) === 'object' && (componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.properties)) {
            const fields = [];
            // Add essential image fields first
            const essentialFields = ['alt', 'src', 'link'];
            for (const fieldName of essentialFields) {
                const schemaProp = componentSchema.properties[fieldName];
                const isImg = (0, helper_1.isImageType)(schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.value);
                if ((schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type) && ImageComponent.fieldTypeMap[schemaProp.type]) {
                    fields.push(ImageComponent.fieldTypeMap[schemaProp.type](fieldName, schemaProp, isImg));
                }
            }
            // Add remaining fields
            for (const [key, value] of Object.entries(componentSchema.properties)) {
                if (!imageExclude.includes(key) && !essentialFields.includes(key)) {
                    const schemaProp = value;
                    if ((schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type) && ImageComponent.fieldTypeMap[schemaProp.type]) {
                        fields.push(ImageComponent.fieldTypeMap[schemaProp.type](key, schemaProp));
                    }
                }
            }
            return Object.assign(Object.assign({}, new contentstackFields_1.GroupField({
                uid: parentKey,
                displayName: parentKey,
                fields,
                required: false,
                multiple: false
            }).toContentstack()), { type: (_c = (_b = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties) === null || _b === void 0 ? void 0 : _b[":type"]) === null || _c === void 0 ? void 0 : _c.value });
        }
        return null;
    }
}
exports.ImageComponent = ImageComponent;
ImageComponent.fieldTypeMap = {
    string: (key, schemaProp, isImg) => {
        return isImg ?
            new contentstackFields_1.ImageField({
                uid: key,
                displayName: key,
            }).toContentstack()
            : new contentstackFields_1.TextField({
                uid: key,
                displayName: key,
                description: "",
                defaultValue: ""
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
        defaultValue: "",
        isNumber: true
    }).toContentstack(),
    object: () => null,
    array: () => null
};
