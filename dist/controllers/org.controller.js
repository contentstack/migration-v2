"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.orgController = void 0;
const org_service_1 = require("../services/org.service");
const getAllStacks = async (req, res) => {
    const resp = await org_service_1.orgService.getAllStacks(req);
    res.status(resp?.status).json(resp?.data);
};
const createStack = async (req, res) => {
    const resp = await org_service_1.orgService.createStack(req);
    res.status(resp.status).json(resp.data);
};
const getLocales = async (req, res) => {
    const resp = await org_service_1.orgService.getLocales(req);
    res.status(resp.status).json(resp.data);
};
exports.orgController = {
    getAllStacks,
    createStack,
    getLocales,
};
