"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const contentTypesMapperSchema = new mongoose_1.Schema({
    otherCmsTitle: { type: String, required: true },
    otherCmsUid: { type: String, required: true },
    isUpdated: { type: Boolean, default: false },
    updateAt: { type: Date },
    contentstackTitle: { type: String },
    contentstackUid: { type: String },
    fieldMapping: [{ type: mongoose_1.Schema.Types.ObjectId, ref: "FieldMapping" }],
});
const ContentTypesMapperModel = (0, mongoose_1.model)("ContentTypes Mapper", contentTypesMapperSchema);
exports.default = ContentTypesMapperModel;
