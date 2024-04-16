"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_validator_1 = require("express-validator");
const constants_1 = require("../constants");
exports.default = (0, express_validator_1.checkSchema)({
    stack_api_key: {
        in: "body",
        isString: {
            errorMessage: constants_1.VALIDATION_ERRORS.STRING_REQUIRED.replace("$", "stack_api_key"),
            bail: true,
        },
        trim: true,
        isLength: {
            errorMessage: constants_1.VALIDATION_ERRORS.LENGTH_LIMIT.replace("$", "stack_api_key"),
            options: {
                min: 1,
                max: 100,
            },
            bail: true,
        },
    },
});
