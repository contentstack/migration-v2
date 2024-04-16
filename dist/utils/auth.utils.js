"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const authentication_1 = __importDefault(require("../models/authentication"));
const custom_errors_utils_1 = require("../utils/custom-errors.utils");
exports.default = async (region, userId) => {
    const res = await authentication_1.default.findOne({
        region: region,
        user_id: userId,
    }).lean();
    if (!res?.authtoken)
        throw new custom_errors_utils_1.UnauthorizedError();
    return res?.authtoken;
};
