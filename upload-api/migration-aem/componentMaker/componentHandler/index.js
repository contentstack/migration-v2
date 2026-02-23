"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const component_identifier_1 = require("../../helper/component.identifier");
const jsonSchema_identifier_1 = require("../../helper/jsonSchema.identifier");
class LoggerHandler {
    handle(component, componentName, count, setSchemaComponent) {
        const { [':type']: componentType, [':itemsOrder']: itemsOrder } = (component === null || component === void 0 ? void 0 : component.props) || {};
        const containerSchema = (0, component_identifier_1.isContainerComponent)(componentType);
        const isExperienceFragment = (0, component_identifier_1.parseXFPath)(componentType);
        const shouldProcess = !itemsOrder ||
            ((containerSchema === null || containerSchema === void 0 ? void 0 : containerSchema.isContainer) === false && !isExperienceFragment && (itemsOrder === null || itemsOrder === void 0 ? void 0 : itemsOrder.length));
        if (shouldProcess) {
            const schemaTypes = (0, jsonSchema_identifier_1.createSchemaTypes)(component);
            setSchemaComponent(schemaTypes, componentName);
        }
    }
}
exports.default = LoggerHandler;
