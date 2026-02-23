"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextComponent = void 0;
const fields_1 = require("../fields");
const uuid_1 = require("uuid");
class TextComponent extends fields_1.ContentstackComponent {
    /**
     * Determines if a component is a text component
     */
    static isText(component) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        if (component && typeof component === 'object') {
            // Direct properties format
            if (component[":type"] &&
                (component[":type"].includes("/components/text") ||
                    component[":type"].includes("/components/richText"))) {
                return true;
            }
            // Properties object format
            if (component.properties &&
                (((_b = (_a = component.properties[":type"]) === null || _a === void 0 ? void 0 : _a.value) === null || _b === void 0 ? void 0 : _b.includes("/components/text")) ||
                    ((_d = (_c = component.properties[":type"]) === null || _c === void 0 ? void 0 : _c.value) === null || _d === void 0 ? void 0 : _d.includes("/components/richText")))) {
                return true;
            }
            // Handle convertedSchema format
            if (component.convertedSchema &&
                component.convertedSchema.properties &&
                (((_f = (_e = component.convertedSchema.properties[":type"]) === null || _e === void 0 ? void 0 : _e.value) === null || _f === void 0 ? void 0 : _f.includes("/components/text")) ||
                    ((_h = (_g = component.convertedSchema.properties[":type"]) === null || _g === void 0 ? void 0 : _g.value) === null || _h === void 0 ? void 0 : _h.includes("/components/richText")))) {
                return true;
            }
        }
        return false;
    }
    /**
     * Extracts the 'richText' property from a text component
     */
    static processTextComponents(component) {
        if (component &&
            component.convertedSchema &&
            component.convertedSchema.properties &&
            component.convertedSchema.properties.richText &&
            typeof component.convertedSchema.properties.richText.value === "boolean") {
            return component.convertedSchema.properties.richText.value;
        }
        return undefined;
    }
    /**
     * Maps a text component to Contentstack rich text schema format
     */
    static mapTextToContentstack(component) {
        var _a, _b, _c, _d;
        const id = (0, uuid_1.v4)();
        const name = 'text';
        const type = 'Rich Text';
        const uid = 'text';
        const default_value = '';
        const isRichText = (_a = this.processTextComponents(component)) !== null && _a !== void 0 ? _a : this.isText(component);
        if (isRichText) {
            return {
                id,
                uid: name,
                otherCmsField: name,
                otherCmsType: type,
                contentstackField: name,
                contentstackFieldUid: uid,
                contentstackFieldType: 'json',
                backupFieldType: 'json',
                backupFieldUid: 'json',
                advanced: { default_value: default_value !== '' ? default_value : null },
                type: (_d = (_c = (_b = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _b === void 0 ? void 0 : _b.properties) === null || _c === void 0 ? void 0 : _c[":type"]) === null || _d === void 0 ? void 0 : _d.value
            };
        }
        return null;
    }
}
exports.TextComponent = TextComponent;
