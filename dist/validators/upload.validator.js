"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_validator_1 = require("express-validator");
const constants_1 = require("../constants");
exports.default = (0, express_validator_1.checkSchema)({
    file_key: {
        in: "body",
        isString: {
            errorMessage: constants_1.VALIDATION_ERRORS.STRING_REQUIRED.replace("$", "file_key"),
            bail: true,
        },
        trim: true,
    },
    file_id: {
        in: "body",
        isString: {
            errorMessage: constants_1.VALIDATION_ERRORS.STRING_REQUIRED.replace("$", "file_id"),
            bail: true,
        },
        trim: true,
    },
    parts: {
        in: "body",
        exists: {
            errorMessage: constants_1.VALIDATION_ERRORS.FIELD_REQUIRED.replace("$", "parts"),
            bail: true,
        },
    },
});
