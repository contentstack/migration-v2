"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
const constants_1 = require("../constants");
const authenticateUser = (req, res, next) => {
    const status = constants_1.HTTP_CODES.UNAUTHORIZED;
    const token = req.get("app_token");
    if (!token)
        return res
            .status(status)
            .json({ status, message: "Unauthorized - Token missing" });
    jsonwebtoken_1.default.verify(token, config_1.config.APP_TOKEN_KEY, (err, payload) => {
        if (err)
            return res
                .status(status)
                .json({ status, message: "Unauthorized - Invalid token" });
        // Attach the payload to the request object for later use
        req.body.token_payload = payload;
        next();
    });
};
exports.authenticateUser = authenticateUser;
