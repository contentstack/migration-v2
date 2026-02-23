"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeparatorComponent = void 0;
const fields_1 = require("../fields");
const contentstackFields_1 = require("../fields/contentstackFields");
class SeparatorComponent extends fields_1.ContentstackComponent {
    /**
     * Determines if a component is a separator component
     */
    static isSeparator(component) {
        var _a, _b;
        const properties = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties;
        if (properties && typeof properties === 'object') {
            const typeField = properties[":type"];
            if ((typeof typeField === "string" && typeField.includes("/components/separator")) ||
                (typeof typeField === "object" && ((_b = typeField.value) === null || _b === void 0 ? void 0 : _b.includes("/components/separator")))) {
                return true;
            }
        }
        return false;
    }
    /**
     * Maps the separator component to Contentstack format
     */
    static mapSeparatorToContentstack(component, parentKey) {
        var _a, _b, _c;
        // You can customize this mapping as needed for your use case
        return Object.assign(Object.assign({}, new contentstackFields_1.BooleanField({
            uid: parentKey,
            displayName: parentKey,
            description: "",
            defaultValue: true
        }).toContentstack()), { type: (_c = (_b = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties) === null || _b === void 0 ? void 0 : _b[":type"]) === null || _c === void 0 ? void 0 : _c.value });
    }
}
exports.SeparatorComponent = SeparatorComponent;
