"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_validator_1 = require("express-validator");
const constants_1 = require("../constants");
exports.default = (0, express_validator_1.checkSchema)({
    email: {
        in: "body",
        isString: {
            errorMessage: constants_1.VALIDATION_ERRORS.STRING_REQUIRED.replace("$", "Email"),
            bail: true,
        },
        isEmail: {
            errorMessage: constants_1.VALIDATION_ERRORS.INVALID_EMAIL,
            bail: true,
        },
        trim: true,
        isLength: {
            errorMessage: constants_1.VALIDATION_ERRORS.EMAIL_LIMIT,
            options: {
                min: 3,
                max: 350,
            },
            bail: true,
        },
    },
    password: {
        in: "body",
        isString: {
            errorMessage: constants_1.VALIDATION_ERRORS.STRING_REQUIRED.replace("$", "Password"),
            bail: true,
        },
        trim: true,
    },
    region: {
        in: "body",
        isString: {
            errorMessage: constants_1.VALIDATION_ERRORS.STRING_REQUIRED.replace("$", "Region"),
            bail: true,
        },
        trim: true,
        isIn: {
            options: [constants_1.CS_REGIONS],
            errorMessage: constants_1.VALIDATION_ERRORS.INVALID_REGION,
            bail: true,
        },
    },
    tfa_token: {
        optional: true,
        in: "body",
        isString: {
            errorMessage: constants_1.VALIDATION_ERRORS.STRING_REQUIRED.replace("$", "2FA Token"),
            bail: true,
        },
        trim: true,
    },
});
