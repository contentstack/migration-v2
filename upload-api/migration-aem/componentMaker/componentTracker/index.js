"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class ComponentTracker {
    constructor(handlers = []) {
        this.data = [];
        this.countMap = {};
        this.schemaComponent = {};
        this.handlers = handlers;
    }
    pushComponent(component) {
        var _a;
        const { component: name } = component;
        this.data.push(component);
        this.countMap[name] = (this.countMap[name] || 0) + 1;
        const setSchemaComponents = (data, componentName) => {
            this.schemaComponent[componentName] = data;
        };
        for (const handler of this.handlers) {
            handler.handle(component, name, (_a = this === null || this === void 0 ? void 0 : this.countMap) === null || _a === void 0 ? void 0 : _a[name], setSchemaComponents);
        }
    }
    getCount(componentName) {
        return this.countMap[componentName] || 0;
    }
    getAllData() {
        return this.data;
    }
    getAllComponents() {
        return this.schemaComponent;
    }
}
exports.default = ComponentTracker;
