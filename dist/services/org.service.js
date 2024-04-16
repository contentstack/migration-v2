"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orgService = void 0;
const config_1 = require("../config");
const index_1 = require("../utils/index");
const https_utils_1 = __importDefault(require("../utils/https.utils"));
const auth_utils_1 = __importDefault(require("../utils/auth.utils"));
const getAllStacks = async (req) => {
    const orgId = req?.params?.orgId;
    const { token_payload } = req.body;
    const authtoken = await (0, auth_utils_1.default)(token_payload?.region, token_payload?.user_id);
    const [err, res] = await (0, index_1.safePromise)((0, https_utils_1.default)({
        method: "GET",
        url: `${config_1.config.CS_API[token_payload?.region]}/stacks`,
        headers: {
            organization_uid: orgId,
            authtoken,
        },
    }));
    if (err)
        return {
            data: err.response.data,
            status: err.response.status,
        };
    return {
        data: {
            stacks: res.data.stacks?.map((stack) => ({
                name: stack.name,
                api_key: stack.api_key,
            })) || [],
        },
        status: res.status,
    };
};
const createStack = async (req) => {
    const orgId = req?.params?.orgId;
    const { token_payload, name, description, master_locale } = req.body;
    const authtoken = await (0, auth_utils_1.default)(token_payload?.region, token_payload?.user_id);
    const [err, res] = await (0, index_1.safePromise)((0, https_utils_1.default)({
        method: "POST",
        url: `${config_1.config.CS_API[token_payload?.region]}/stacks`,
        headers: {
            organization_uid: orgId,
            authtoken,
        },
        data: {
            stack: {
                name,
                description,
                master_locale,
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
};
const getLocales = async (req) => {
    const { token_payload } = req.body;
    const authtoken = await (0, auth_utils_1.default)(token_payload?.region, token_payload?.user_id);
    const [err, res] = await (0, index_1.safePromise)((0, https_utils_1.default)({
        method: "GET",
        url: `${config_1.config.CS_API[token_payload?.region]}/locales?include_all=true`,
        headers: {
            authtoken,
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
};
exports.orgService = {
    getAllStacks,
    getLocales,
    createStack,
};
