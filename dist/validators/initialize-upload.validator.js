"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_validator_1 = require("express-validator");
const constants_1 = require("../constants");
exports.default = (0, express_validator_1.checkSchema)({
    file_name: {
        in: "body",
        isString: {
            errorMessage: constants_1.VALIDATION_ERRORS.STRING_REQUIRED.replace("$", "file_name"),
            bail: true,
        },
        trim: true,
    },
});
