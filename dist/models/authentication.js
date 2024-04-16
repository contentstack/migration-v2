"use strict";
// src/models/Authentication.ts
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const constants_1 = require("../constants");
const authenticationSchema = new mongoose_1.Schema({
    user_id: { type: String, required: true },
    region: { type: String, required: true, enum: constants_1.CS_REGIONS },
    authtoken: { type: String, required: true },
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });
const AuthenticationModel = (0, mongoose_1.model)("Authentication", authenticationSchema);
exports.default = AuthenticationModel;
