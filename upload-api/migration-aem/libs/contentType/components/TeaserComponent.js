"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeaserComponent = void 0;
const helper_1 = require("../../../helper");
const fields_1 = require("../fields");
const contentstackFields_1 = require("../fields/contentstackFields");
const teaserExclude = [
    // Add keys or values you want to exclude from navigation mapping
    'dataLayer',
    ':type',
    'path',
    'id',
    'appliedCssClassNames',
    // 'cq:panelTitle'
];
function uidContainsNumber(uid) {
    return /\d/.test(uid);
}
class TeaserComponent extends fields_1.ContentstackComponent {
    static isTeaser(component) {
        var _a;
        const properties = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties;
        if (properties && typeof properties === 'object') {
            const typeField = properties[":type"];
            const typeValue = typeof typeField === "string" ? typeField : typeField === null || typeField === void 0 ? void 0 : typeField.value;
            const isTeaser = /\/components\/(teaser|heroTeaser|overlayBoxTeaser)/.test(typeValue !== null && typeValue !== void 0 ? typeValue : "") ||
                (typeValue !== null && typeValue !== void 0 ? typeValue : "").includes("/productCategoryTeaserList");
            return isTeaser;
        }
        return false;
    }
    static mapTeaserToContentstack(component, parentKey) {
        var _a, _b, _c;
        const componentSchema = component === null || component === void 0 ? void 0 : component.convertedSchema;
        if ((componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.type) === 'object' && (componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.properties)) {
            const componentsData = [];
            for (const [key, value] of Object.entries(componentSchema.properties)) {
                const schemaProp = value;
                if (teaserExclude.includes(key)) {
                    continue;
                }
                if ((schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type) && TeaserComponent.fieldTypeMap[schemaProp.type]) {
                    const isImg = (0, helper_1.isImageType)(schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.value);
                    const fieldData = TeaserComponent.fieldTypeMap[schemaProp.type](key, schemaProp, isImg);
                    if (fieldData) {
                        componentsData.push(fieldData);
                    }
                    else {
                        console.warn(`Field mapping returned null for: ${key} (type: ${schemaProp.type})`);
                    }
                }
                else {
                    console.warn(`No field type mapper for: ${key}`, {
                        type: schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type,
                        availableMappers: Object.keys(TeaserComponent.fieldTypeMap)
                    });
                }
            }
            if (componentsData.length === 0) {
                console.warn('No fields were generated for teaser component!');
                return null;
            }
            return Object.assign(Object.assign({}, new contentstackFields_1.GroupField({
                uid: parentKey,
                displayName: parentKey,
                fields: componentsData,
                required: false,
                multiple: true
            }).toContentstack()), { type: (_c = (_b = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties) === null || _b === void 0 ? void 0 : _b[":type"]) === null || _c === void 0 ? void 0 : _c.value });
        }
        return null;
    }
}
exports.TeaserComponent = TeaserComponent;
TeaserComponent.fieldTypeMap = {
    string: (key, schemaProp, isImg) => isImg ?
        new contentstackFields_1.ImageField({
            uid: key,
            displayName: key,
        }).toContentstack()
        : new contentstackFields_1.TextField({
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
        const data = { convertedSchema: schemaProp };
        const objectData = TeaserComponent.mapTeaserToContentstack(data, key);
        // Accept either `schema` or `fields` depending on what toContentstack returns
        const hasFieldsArray = !!objectData && ((Array.isArray(objectData.schema) && objectData.schema.length > 0) ||
            (Array.isArray(objectData.fields) && objectData.fields.length > 0));
        if ((objectData === null || objectData === void 0 ? void 0 : objectData.uid) && !uidContainsNumber(objectData === null || objectData === void 0 ? void 0 : objectData.uid) && hasFieldsArray) {
            return objectData;
        }
        const urlValue = (_b = (_a = schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.properties) === null || _a === void 0 ? void 0 : _a.url) === null || _b === void 0 ? void 0 : _b.value;
        if (urlValue !== undefined) {
            return new contentstackFields_1.TextField({
                uid: key,
                displayName: key,
                description: "",
                defaultValue: ""
            }).toContentstack();
        }
        return null;
    },
    array: (key, schemaProp) => {
        var _a;
        // Special-case for actions array
        if (key === 'actions') {
            const actionFields = [
                new contentstackFields_1.TextField({
                    uid: 'title',
                    displayName: 'title',
                    description: '',
                    defaultValue: '',
                }),
                new contentstackFields_1.TextField({
                    uid: 'url',
                    displayName: 'url',
                    description: '',
                    defaultValue: ''
                })
            ];
            // Return GroupField instance
            return new contentstackFields_1.GroupField({
                uid: key,
                displayName: key,
                fields: actionFields,
                required: false,
                multiple: true
            }).toContentstack();
        }
        const inferItemSample = () => {
            var _a, _b;
            if (((_a = schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.items) === null || _a === void 0 ? void 0 : _a.properties) && Object.keys(schemaProp.items.properties).length) {
                return { from: 'items.properties', properties: schemaProp.items.properties };
            }
            if (((_b = schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.items) === null || _b === void 0 ? void 0 : _b.value) && Array.isArray(schemaProp.items.value) && schemaProp.items.value[0] && typeof schemaProp.items.value[0] === 'object') {
                return { from: 'items.value', sample: schemaProp.items.value[0] };
            }
            if (Array.isArray(schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.value) && schemaProp.value[0] && typeof schemaProp.value[0] === 'object') {
                return { from: 'value', sample: schemaProp.value[0] };
            }
            return null;
        };
        const inferred = inferItemSample();
        if (!inferred) {
            console.warn(`Array field "${key}" had no schema or sample items to infer from`);
            return null;
        }
        let itemProperties = null;
        if (inferred.from === 'items.properties') {
            itemProperties = inferred.properties;
        }
        else if (inferred.from === 'items.value' || inferred.from === 'value') {
            const sample = inferred.sample;
            itemProperties = {};
            for (const k of Object.keys(sample)) {
                itemProperties[k] = { type: typeof sample[k] === 'number' ? 'integer' : 'string', value: sample[k] };
            }
        }
        if (!itemProperties || !Object.keys(itemProperties).length) {
            console.warn(`After inference, no item properties found for "${key}"`);
            return null;
        }
        const componentsData = []; // Array of Field instances
        for (const [itemKey, itemProp] of Object.entries(itemProperties)) {
            const ik = String(itemKey);
            const inferredType = ((_a = itemProp === null || itemProp === void 0 ? void 0 : itemProp.type) !== null && _a !== void 0 ? _a : 'string').toLowerCase();
            if (inferredType === 'string' || inferredType === 'integer') {
                // Create Field instance
                componentsData.push(new contentstackFields_1.TextField({
                    uid: ik,
                    displayName: ik,
                    description: "",
                    defaultValue: "",
                    isNumber: inferredType === 'integer'
                }));
                continue;
            }
            if (inferredType === 'object' && (itemProp === null || itemProp === void 0 ? void 0 : itemProp.properties)) {
                const nested = TeaserComponent.fieldTypeMap.object(ik, itemProp, false);
                if (nested) {
                    componentsData.push(nested);
                }
                continue;
            }
        }
        if (!componentsData.length) {
            console.warn(`No components generated for array field "${key}" after inference`);
            return null;
        }
        // Return GroupField instance
        return new contentstackFields_1.GroupField({
            uid: key,
            displayName: key,
            fields: componentsData,
            required: false,
            multiple: true
        }).toContentstack();
    },
};
