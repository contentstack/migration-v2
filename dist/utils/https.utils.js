"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const constants_1 = require("../constants");
exports.default = async (obj) => {
    const { url, method, headers, data, timeout } = obj;
    const res = await (0, axios_1.default)(url, {
        method,
        headers: headers,
        ...(headers && { headers }),
        timeout: timeout ?? constants_1.AXIOS_TIMEOUT,
        ...(constants_1.METHODS_TO_INCLUDE_DATA_IN_AXIOS.includes(method) && {
            data,
        }),
    });
    return {
        headers: res?.headers,
        status: res?.status,
        data: res?.data,
    };
};
