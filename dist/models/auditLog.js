"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
const mongoose_1 = require("mongoose");
const auditLogSchema = new mongoose_1.Schema({
    project_id: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: "Project",
    },
    actions: {
        type: [
            {
                date: { type: Date, required: true },
                user_id: { type: String, required: true },
                user_first_name: { type: String, required: true },
                user_last_name: { type: String, required: true },
                module: { type: String, required: true, enum: constants_1.MODULES },
                action: {
                    type: String,
                    required: true,
                    enum: constants_1.MODULES_ACTIONS,
                },
            },
        ],
        required: true,
    },
});
const AuditLogModel = (0, mongoose_1.model)("AuditLog", auditLogSchema);
exports.default = AuditLogModel;
