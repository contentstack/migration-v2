"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const fieldMapperSchema = new mongoose_1.Schema({
    uid: { type: String, required: true },
    otherCmsField: { type: String, required: true },
    otherCmsType: { type: String, required: true },
    contentstackField: { type: String },
    contentstackFieldUid: { type: String },
    ContentstackFieldType: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
    backupFieldType: { type: String },
    refrenceTo: {
        uid: { type: String },
        title: { type: String },
    },
});
const FieldMapperModel = (0, mongoose_1.model)("FieldMapping", fieldMapperSchema);
exports.default = FieldMapperModel;
