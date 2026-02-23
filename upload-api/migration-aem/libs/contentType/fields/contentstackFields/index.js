"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModularBlocksField = exports.JsonField = exports.ImageField = exports.ReferenceField = exports.LinkField = exports.GroupField = exports.BooleanField = exports.SelectField = exports.TextField = exports.Field = void 0;
const uuid_1 = require("uuid");
/**
 * Base field class for Contentstack components
 */
class Field {
    constructor(config) {
        this.uid = config.uid;
        this.displayName = config.displayName;
        this.required = config.required || false;
        this.description = config.description;
    }
    // Generate a common ID based on the UID
    generateId() {
        return (0, uuid_1.v4)();
    }
}
exports.Field = Field;
/**
 * Text field implementation
 */
class TextField extends Field {
    constructor(config) {
        super(config);
        this.defaultValue = config.defaultValue;
        this.multiline = config.multiline || false;
        this.isNumber = config.isNumber || false;
    }
    toContentstack() {
        let fieldType = this.multiline ? 'multi_line_text' : 'single_line_text';
        if (this.isNumber === true) {
            fieldType = 'number';
        }
        return {
            id: this.generateId(),
            uid: this.uid,
            otherCmsField: this.displayName,
            otherCmsType: 'text',
            contentstackField: this.displayName,
            contentstackFieldUid: this.uid,
            contentstackFieldType: fieldType,
            backupFieldType: fieldType,
            backupFieldUid: this.uid,
            advanced: {
                default_value: this.defaultValue !== undefined ? this.defaultValue : null,
                description: this.description,
                required: this.required
            }
        };
    }
}
exports.TextField = TextField;
/**
 * Select field implementation
 */
class SelectField extends Field {
    constructor(config) {
        super(config);
        this.options = config.options;
        this.defaultValue = config.defaultValue;
        this.multiple = config.multiple || false;
    }
    toContentstack() {
        return {
            id: this.generateId(),
            uid: this.uid,
            otherCmsField: this.displayName,
            otherCmsType: 'select',
            contentstackField: this.displayName,
            contentstackFieldUid: this.uid,
            contentstackFieldType: this.multiple ? 'multi_select' : 'select',
            backupFieldType: 'select',
            backupFieldUid: this.uid,
            advanced: {
                default_value: this.defaultValue !== undefined ? this.defaultValue : null,
                description: this.description,
                required: this.required,
                options: this.options.map(opt => ({
                    value: opt.value,
                    display_value: opt.displayValue
                }))
            }
        };
    }
}
exports.SelectField = SelectField;
/**
 * Boolean field implementation
 */
class BooleanField extends Field {
    constructor(config) {
        super(config);
        this.defaultValue = config.defaultValue;
    }
    toContentstack() {
        return {
            id: this.generateId(),
            uid: this.uid,
            otherCmsField: this.displayName,
            otherCmsType: 'boolean',
            contentstackField: this.displayName,
            contentstackFieldUid: this.uid,
            contentstackFieldType: 'boolean',
            backupFieldType: 'boolean',
            backupFieldUid: this.uid,
            advanced: {
                default_value: this.defaultValue !== undefined ? this.defaultValue : null,
                description: this.description,
                required: this.required
            }
        };
    }
}
exports.BooleanField = BooleanField;
/**
 * Group field implementation
 */
class GroupField extends Field {
    constructor(config) {
        super(config);
        this.fields = config.fields;
        this.multiple = config.multiple || false;
    }
    toContentstack() {
        const processedSchema = this.fields.filter(Boolean).map(field => {
            if (field && typeof field.toContentstack === 'function') {
                return field.toContentstack();
            }
            return field;
        });
        return {
            id: this.generateId(),
            uid: this.uid,
            otherCmsField: this.displayName,
            otherCmsType: 'group',
            contentstackField: this.displayName,
            contentstackFieldUid: this.uid,
            contentstackFieldType: 'group',
            backupFieldType: 'group',
            backupFieldUid: this.uid,
            schema: processedSchema,
            advanced: {
                mandatory: !!this.required,
                multiple: this.multiple,
            }
        };
    }
}
exports.GroupField = GroupField;
class LinkField extends Field {
    constructor(config) {
        super(config);
        this.defaultValue = config.defaultValue;
    }
    toContentstack() {
        var _a;
        const id = this.generateId();
        const name = this.displayName;
        const type = 'link';
        const uid = this.uid;
        const default_value = (_a = this.defaultValue) !== null && _a !== void 0 ? _a : '';
        return {
            id: id,
            uid: uid,
            otherCmsField: name,
            otherCmsType: type,
            contentstackField: name,
            contentstackFieldUid: uid,
            contentstackFieldType: 'link',
            backupFieldType: 'link',
            backupFieldUid: uid,
            advanced: { default_value: default_value !== '' ? default_value : null }
        };
    }
}
exports.LinkField = LinkField;
class ReferenceField extends Field {
    constructor(config) {
        var _a, _b;
        super(config);
        this.refrenceTo = config.refrenceTo;
        this.isDeleted = (_a = config.isDeleted) !== null && _a !== void 0 ? _a : false;
        this.backupFieldUid = (_b = config.backupFieldUid) !== null && _b !== void 0 ? _b : config.uid;
    }
    toContentstack() {
        return {
            uid: this.uid,
            otherCmsField: this.displayName,
            otherCmsType: this.displayName,
            contentstackField: this.displayName,
            contentstackFieldUid: this.uid,
            contentstackFieldType: 'reference',
            isDeleted: this.isDeleted,
            backupFieldType: 'reference',
            backupFieldUid: this.uid,
            refrenceTo: this.refrenceTo
        };
    }
}
exports.ReferenceField = ReferenceField;
class ImageField extends Field {
    constructor(config) {
        super(config);
        this.defaultValue = config.defaultValue;
    }
    toContentstack() {
        var _a;
        const id = this.generateId();
        const uid = this.uid;
        const name = this.displayName;
        const type = 'image';
        const default_value = (_a = this.defaultValue) !== null && _a !== void 0 ? _a : '';
        return {
            id: id,
            uid,
            otherCmsField: name,
            otherCmsType: type,
            contentstackField: name,
            contentstackFieldUid: uid,
            contentstackFieldType: 'file',
            backupFieldType: 'file',
            backupFieldUid: uid,
            advanced: { default_value: default_value !== '' ? default_value : null }
        };
    }
}
exports.ImageField = ImageField;
class JsonField extends Field {
    constructor(config) {
        super(config);
        this.defaultValue = config.defaultValue;
    }
    toContentstack() {
        var _a;
        const id = this.generateId();
        const uid = this.uid;
        const name = this.displayName;
        const type = 'json';
        const default_value = (_a = this.defaultValue) !== null && _a !== void 0 ? _a : '';
        return {
            id: id,
            uid: uid,
            otherCmsField: name,
            otherCmsType: type,
            contentstackField: name,
            contentstackFieldUid: uid,
            contentstackFieldType: 'json',
            backupFieldType: 'json',
            backupFieldUid: uid,
            advanced: { default_value: default_value !== '' ? default_value : null }
        };
    }
}
exports.JsonField = JsonField;
/**
 * Modular Blocks field implementation
 */
class ModularBlocksField extends Field {
    constructor(config) {
        var _a;
        super(config);
        this.blocks = config.blocks;
        this.multiple = (_a = config.multiple) !== null && _a !== void 0 ? _a : true;
    }
    toContentstack() {
        const id = this.generateId();
        return {
            id: id,
            uid: this.uid,
            otherCmsField: this.displayName,
            otherCmsType: 'container',
            blocks: this.blocks,
            contentstackField: this.displayName,
            contentstackFieldUid: this.uid,
            contentstackFieldType: 'modular_blocks',
            backupFieldType: 'modular_blocks',
            backupFieldUid: this.uid,
        };
    }
}
exports.ModularBlocksField = ModularBlocksField;
