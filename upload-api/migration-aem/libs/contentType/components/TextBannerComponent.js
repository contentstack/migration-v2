"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextBannerComponent = void 0;
const helper_1 = require("../../../helper");
const fields_1 = require("../fields");
const contentstackFields_1 = require("../fields/contentstackFields");
const textBannerExclude = [
    'dataLayer',
    ':type',
    'id'
];
class TextBannerComponent extends fields_1.ContentstackComponent {
    static isTextBanner(component) {
        var _a, _b;
        const properties = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties;
        if (properties && typeof properties === 'object') {
            const typeField = properties[":type"];
            const isTextBanner = ((typeof typeField === "string" && typeField.includes("/components/textbanner")) ||
                (typeof typeField === "object" && ((_b = typeField.value) === null || _b === void 0 ? void 0 : _b.includes("/components/textbanner"))));
            return isTextBanner;
        }
        return false;
    }
    static mapTextBannerToContentstack(component, parentKey) {
        var _a, _b, _c;
        const componentSchema = component === null || component === void 0 ? void 0 : component.convertedSchema;
        if ((componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.type) === 'object' && (componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.properties)) {
            const fields = [];
            for (const [key, value] of Object.entries(componentSchema.properties)) {
                const schemaProp = value;
                if (textBannerExclude.includes(key)) {
                    console.log(`⏭️ Skipping excluded key: ${key}`);
                    continue;
                }
                if ((schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type) && TextBannerComponent.fieldTypeMap[schemaProp.type]) {
                    const field = TextBannerComponent.fieldTypeMap[schemaProp.type](key, schemaProp);
                    if (field) {
                        fields.push(field);
                    }
                    else {
                        console.warn(`Field mapping returned null for: ${key} (type: ${schemaProp.type})`);
                    }
                }
                else {
                    console.warn(`No field type mapper for: ${key}`, {
                        type: schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type,
                        availableMappers: Object.keys(TextBannerComponent.fieldTypeMap)
                    });
                }
            }
            if (fields.length === 0) {
                console.warn('No fields were generated for textbanner component!');
                return null;
            }
            return Object.assign(Object.assign({}, new contentstackFields_1.GroupField({
                uid: parentKey,
                displayName: parentKey,
                fields: fields,
                required: false,
                multiple: false
            }).toContentstack()), { type: (_c = (_b = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties) === null || _b === void 0 ? void 0 : _b[":type"]) === null || _c === void 0 ? void 0 : _c.value });
        }
        return null;
    }
}
exports.TextBannerComponent = TextBannerComponent;
TextBannerComponent.fieldTypeMap = {
    string: (key, schemaProp) => {
        return (0, helper_1.isHtmlString)(schemaProp.value) ?
            new contentstackFields_1.JsonField({
                uid: key,
                displayName: key,
                description: "",
                defaultValue: ""
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
        isNumber: true,
        defaultValue: ""
    }).toContentstack(),
    object: () => null,
    array: (key, schemaProp) => {
        var _a, _b;
        // For actions array
        if ((schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type) === 'array' &&
            ((_a = schemaProp.items) === null || _a === void 0 ? void 0 : _a.type) === 'object' &&
            ((_b = schemaProp.items) === null || _b === void 0 ? void 0 : _b.properties)) {
            const fields = [];
            for (const [itemKey, itemProp] of Object.entries(schemaProp.items.properties)) {
                if (!textBannerExclude.includes(itemKey)) {
                    const prop = itemProp;
                    if ((prop === null || prop === void 0 ? void 0 : prop.type) && TextBannerComponent.fieldTypeMap[prop.type]) {
                        fields.push(TextBannerComponent.fieldTypeMap[prop.type](itemKey, prop));
                    }
                }
            }
            return new contentstackFields_1.GroupField({
                uid: key,
                displayName: key,
                fields,
                required: false,
                multiple: true
            }).toContentstack();
        }
        return null;
    }
};
