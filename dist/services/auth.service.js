"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const config_1 = require("../config");
const index_1 = require("../utils/index");
const https_utils_1 = __importDefault(require("../utils/https.utils"));
const constants_1 = require("../constants");
const jwt_utils_1 = require("../utils/jwt.utils");
const custom_errors_utils_1 = require("../utils/custom-errors.utils");
const authentication_1 = __importDefault(require("../models/authentication"));
const login = async (req) => {
    const userData = req?.body;
    const [err, res] = await (0, index_1.safePromise)((0, https_utils_1.default)({
        method: "POST",
        url: `${config_1.config.CS_API[userData?.region]}/user-session`,
        headers: {
            "Content-Type": "application/json",
        },
        data: {
            user: {
                email: userData?.email,
                password: userData?.password,
                ...(userData?.tfa_token && { tfa_token: userData?.tfa_token }),
            },
        },
    }));
    if (err)
        return {
            data: err?.response?.data,
            status: err?.response?.status,
        };
    if (res?.status === constants_1.HTTP_CODES.SUPPORT_DOC)
        return {
            data: res?.data,
            status: res?.status,
        };
    if (!res?.data?.user)
        throw new custom_errors_utils_1.BadRequestError(constants_1.HTTP_TEXTS.NO_CS_USER);
    const appTokenPayload = {
        region: userData?.region,
        user_id: res?.data?.user.uid,
    };
    // Saving auth info in the DB
    await authentication_1.default.findOneAndUpdate(appTokenPayload, {
        authtoken: res?.data.user?.authtoken,
    }, {
        upsert: true,
    });
    // JWT token generation
    const app_token = (0, jwt_utils_1.generateToken)(appTokenPayload);
    return {
        data: {
            message: constants_1.HTTP_TEXTS.SUCCESS_LOGIN,
            app_token,
        },
        status: constants_1.HTTP_CODES.OK,
    };
};
const requestSms = async (req) => {
    const userData = req?.body;
    try {
        const [err, res] = await (0, index_1.safePromise)((0, https_utils_1.default)({
            method: "POST",
            url: `${config_1.config.CS_API[userData?.region]}/user/request_token_sms`,
            data: {
                user: {
                    email: userData?.email,
                    password: userData?.password,
                },
            },
        }));
        if (err)
            return {
                data: err.response.data,
                status: err.response.status,
            };
        return {
            data: res.data,
            status: res.status,
        };
    }
    catch (error) {
        throw new custom_errors_utils_1.InternalServerError(constants_1.HTTP_TEXTS.INTERNAL_ERROR);
    }
};
exports.authService = {
    login,
    requestSms,
};
