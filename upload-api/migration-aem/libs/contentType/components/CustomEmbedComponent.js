"use strict";
// item.name = 
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomEmbedComponent = void 0;
const helper_1 = require("../../../helper");
const fields_1 = require("../fields");
class CustomEmbedComponent extends fields_1.ContentstackComponent {
    /**
     * Determines if a component is a custom embed component
     */
    static isCustomEmbed(component) {
        var _a, _b;
        const properties = (_a = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _a === void 0 ? void 0 : _a.properties;
        if (properties && typeof properties === 'object') {
            const typeField = properties[":type"];
            if ((typeof typeField === "string" && typeField.includes("/components/customembed")) ||
                (typeof typeField === "object" && ((_b = typeField.value) === null || _b === void 0 ? void 0 : _b.includes("/components/customembed")))) {
                return true;
            }
        }
        return false;
    }
    /**
     * Maps the custom embed component schema to Contentstack fields
     */
    static mapCustomEmbedToContentstack(component, parentKey) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const componentSchema = component === null || component === void 0 ? void 0 : component.convertedSchema;
        if ((componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.type) === 'object') {
            const embedType = (_b = (_a = componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.properties) === null || _a === void 0 ? void 0 : _a.type) === null || _b === void 0 ? void 0 : _b.value;
            let appName;
            switch (embedType) {
                case 'EMBEDDABLE': {
                    appName = ((_e = (_d = (_c = componentSchema === null || componentSchema === void 0 ? void 0 : componentSchema.properties) === null || _c === void 0 ? void 0 : _c.embeddableResourceType) === null || _d === void 0 ? void 0 : _d.value) === null || _e === void 0 ? void 0 : _e.includes('/embeddable/youtube')) ? 'Youtube' : null;
                    break;
                }
                case 'HTML': {
                    appName = 'Html';
                    break;
                }
                case 'URL': {
                    appName = 'Url';
                    break;
                }
                default:
                    appName = null;
                    break;
            }
            if (appName !== null) {
                appName = `${parentKey} (${appName}-App)`;
                return {
                    uid: appName,
                    otherCmsField: appName,
                    otherCmsType: 'customembed',
                    contentstackField: appName,
                    contentstackFieldUid: (0, helper_1.uidCorrector)(parentKey),
                    contentstackFieldType: 'app',
                    backupFieldType: 'app',
                    backupFieldUid: (0, helper_1.uidCorrector)(parentKey),
                    advanced: {},
                    type: (_h = (_g = (_f = component === null || component === void 0 ? void 0 : component.convertedSchema) === null || _f === void 0 ? void 0 : _f.properties) === null || _g === void 0 ? void 0 : _g[":type"]) === null || _h === void 0 ? void 0 : _h.value,
                };
            }
            return null;
        }
    }
}
exports.CustomEmbedComponent = CustomEmbedComponent;
