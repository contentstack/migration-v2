"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentstackComponent = void 0;
class ContentstackComponent {
    constructor(config) {
        this.uid = config.uid;
        this.title = config.title;
        this.fields = config.fields;
    }
    /**
     * Converts component definition to Contentstack schema
     */
    toContentstack() {
        return {
            title: this.title,
            uid: this.uid,
            schema: this.fields.map(field => field.toContentstack())
        };
    }
}
exports.ContentstackComponent = ContentstackComponent;
