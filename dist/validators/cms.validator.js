"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_validator_1 = require("express-validator");
const constants_1 = require("../constants");
exports.default = (0, express_validator_1.checkSchema)({
    legacy_cms: {
        in: "body",
        isString: {
            errorMessage: constants_1.VALIDATION_ERRORS.STRING_REQUIRED.replace("$", "legacy_cms"),
            bail: true,
        },
        trim: true,
        isLength: {
            errorMessage: constants_1.VALIDATION_ERRORS.LENGTH_LIMIT.replace("$", "legacy_cms"),
            options: {
                min: 1,
                max: 200,
            },
            bail: true,
        },
    },
});
