"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userService = void 0;
const config_1 = require("../config");
const https_utils_1 = __importDefault(require("../utils/https.utils"));
const constants_1 = require("../constants");
const custom_errors_utils_1 = require("../utils/custom-errors.utils");
const authentication_1 = __importDefault(require("../models/authentication"));
const getUserProfile = async (req) => {
    const appTokenPayload = req?.body?.token_payload;
    const user = await authentication_1.default.findOne({
        user_id: appTokenPayload?.user_id,
        region: appTokenPayload?.region,
    }).lean();
    if (!user?.authtoken)
        throw new custom_errors_utils_1.BadRequestError(constants_1.HTTP_TEXTS.NO_CS_USER);
    const res = await (0, https_utils_1.default)({
        method: "GET",
        url: `${config_1.config.CS_API[appTokenPayload?.region]}/user?include_orgs_roles=true`,
        headers: {
            "Content-Type": "application/json",
            authtoken: user?.authtoken,
        },
    });
    if (!res?.data?.user)
        throw new custom_errors_utils_1.BadRequestError(constants_1.HTTP_TEXTS.NO_CS_USER);
    const orgs = (res?.data?.user?.organizations || [])
        ?.filter((org) => org?.org_roles?.some((item) => item.admin))
        ?.map(({ uid, name }) => ({ org_id: uid, org_name: name }));
    return {
        user: {
            email: res?.data?.user?.email,
            first_name: res?.data?.user?.first_name,
            last_name: res?.data?.user?.last_name,
            orgs: orgs,
        },
    };
};
exports.userService = {
    getUserProfile,
};
