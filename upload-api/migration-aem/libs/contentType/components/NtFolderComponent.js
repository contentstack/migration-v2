"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NtFolderComponent = void 0;
const fields_1 = require("../fields");
const contentstackFields_1 = require("../fields/contentstackFields");
class NtFolderComponent extends fields_1.ContentstackComponent {
    /**
     * Determines if a component is an nt:folder component
     */
    static isNtFolder(component) {
        var _a;
        const properties = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties;
        if (properties && typeof properties === 'object') {
            const typeField = properties[":type"];
            if ((typeof typeField === "string" && typeField === "nt:folder") ||
                (typeof typeField === "object" && typeField.value === "nt:folder")) {
                return true;
            }
        }
        return false;
    }
    /**
     * Maps the nt:folder component to Contentstack format
     */
    static mapNtFolderToContentstack(component, parentKey) {
        var _a, _b, _c;
        const componentSchema = component === null || component === void 0 ? void 0 : component.convertedSchema;
        if ((componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.type) === 'object' && (componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.properties)) {
            componentSchema.properties[':type'];
            return Object.assign(Object.assign({}, new contentstackFields_1.ReferenceField({
                uid: parentKey,
                displayName: parentKey,
                refrenceTo: []
            }).toContentstack()), { type: (_c = (_b = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties) === null || _b === void 0 ? void 0 : _b[":type"]) === null || _c === void 0 ? void 0 : _c.value });
        }
        return [];
    }
}
exports.NtFolderComponent = NtFolderComponent;
