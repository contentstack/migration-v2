"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateToken = void 0;
/// src/utils/jwt.utils.ts
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
// @typescript-eslint/no-explicit-any
const generateToken = (payload) => {
    return jsonwebtoken_1.default.sign(payload, config_1.config.APP_TOKEN_KEY, {
        expiresIn: config_1.config.APP_TOKEN_EXP,
    });
};
exports.generateToken = generateToken;
