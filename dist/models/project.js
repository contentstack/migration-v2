"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const constants_1 = require("../constants");
const projectSchema = new mongoose_1.Schema({
    region: { type: String, required: true, enum: constants_1.CS_REGIONS },
    org_id: { type: String, required: true },
    owner: { type: String, required: true },
    created_by: { type: String, required: true },
    updated_by: { type: String },
    former_owner_ids: [{ type: String }],
    name: { type: String, required: true },
    description: { type: String, required: true },
    status: { type: Boolean, default: true },
    destination_stack_id: { type: String },
    legacy_cms: {
        cms: { type: String },
        file_format: { type: String },
        import_data: { type: String },
    },
    content_mapper: [
        { type: mongoose_1.Schema.Types.ObjectId, ref: "ContentTypes Mapper" },
    ],
    execution_log: [
        {
            log_url: { type: String },
            date: { type: Date },
        },
    ],
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });
const ProjectModel = (0, mongoose_1.model)("Project", projectSchema);
exports.default = ProjectModel;
