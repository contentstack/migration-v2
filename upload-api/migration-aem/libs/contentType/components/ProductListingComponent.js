"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductListingComponent = void 0;
const fields_1 = require("../fields");
const contentstackFields_1 = require("../fields/contentstackFields");
const productListingExclude = [
    'dataLayer',
    ':type',
    'id',
    'relativePath'
];
class ProductListingComponent extends fields_1.ContentstackComponent {
    static isProductListing(component) {
        var _a, _b, _c, _d;
        const properties = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties;
        if (properties && typeof properties === 'object') {
            const typeField = properties[":type"];
            if ((typeof typeField === "string" &&
                (typeField.includes("/components/productlisting") ||
                    typeField.includes("/components/productTeaserListConfiguredProducts") ||
                    typeField.includes("/components/productTeaserListConfiguredCategory"))) ||
                (typeof typeField === "object" &&
                    (((_b = typeField.value) === null || _b === void 0 ? void 0 : _b.includes("/components/productlisting")) ||
                        ((_c = typeField.value) === null || _c === void 0 ? void 0 : _c.includes("/components/productTeaserListConfiguredProducts")) ||
                        ((_d = typeField.value) === null || _d === void 0 ? void 0 : _d.includes("/components/productTeaserListConfiguredCategory"))))) {
                return true;
            }
        }
        return false;
    }
    static mapProductListingToContentstack(component, parentKey) {
        var _a, _b, _c;
        const componentSchema = component === null || component === void 0 ? void 0 : component.convertedSchema;
        if ((componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.type) === 'object' && (componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.properties)) {
            const componentsData = [];
            for (const [key, value] of Object.entries(componentSchema.properties)) {
                const schemaProp = value;
                if (!productListingExclude.includes(key) &&
                    (schemaProp === null || schemaProp === void 0 ? void 0 : schemaProp.type) &&
                    ProductListingComponent.fieldTypeMap[schemaProp.type]) {
                    componentsData.push(ProductListingComponent.fieldTypeMap[schemaProp.type](key, schemaProp));
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
exports.ProductListingComponent = ProductListingComponent;
ProductListingComponent.fieldTypeMap = {
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
