"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateMigrationService = void 0;
const constants_1 = require("../constants");
const config_1 = require("../config");
const authenticateMigrationService = (req, res, next) => {
    const status = constants_1.HTTP_CODES.UNAUTHORIZED;
    const secret_key = req.get("secret_key");
    if (secret_key !== config_1.config.MIGRATION_KEY)
        return res
            .status(status)
            .json({ status, message: "Unauthorized - Please provide a valid key" });
    next();
};
exports.authenticateMigrationService = authenticateMigrationService;
