"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const auth_service_1 = require("../services/auth.service");
const login = async (req, res) => {
    const resp = await auth_service_1.authService.login(req);
    res.status(resp?.status).json(resp?.data);
};
const RequestSms = async (req, res) => {
    const resp = await auth_service_1.authService.requestSms(req);
    res.status(resp.status).json(resp.data);
};
exports.authController = {
    login,
    RequestSms,
};
