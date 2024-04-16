"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_validator_1 = require("express-validator");
const constants_1 = require("../constants");
exports.default = (0, express_validator_1.checkSchema)({
    file_format: {
        in: "body",
        isString: {
            errorMessage: constants_1.VALIDATION_ERRORS.STRING_REQUIRED.replace("$", "file_format"),
            bail: true,
        },
        trim: true,
        isLength: {
            errorMessage: constants_1.VALIDATION_ERRORS.LENGTH_LIMIT.replace("$", "file_format"),
            options: {
                min: 1,
                max: 200,
            },
            bail: true,
        },
    },
});
