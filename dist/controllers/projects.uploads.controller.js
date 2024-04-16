"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadController = void 0;
const projects_uploads_service_1 = require("../services/projects.uploads.service");
const initializeUpload = async (req, res) => {
    const resp = await projects_uploads_service_1.uploadsService.initializeUpload(req);
    res.status(resp.status).json(resp.data);
};
const getPreSignedUrls = async (req, res) => {
    const resp = await projects_uploads_service_1.uploadsService.getPreSignedUrls(req);
    res.status(resp.status).json(resp.data);
};
const finalizeUpload = async (req, res) => {
    const resp = await projects_uploads_service_1.uploadsService.finalizeUpload(req);
    res.status(resp.status).json(resp.data);
};
exports.uploadController = {
    initializeUpload,
    getPreSignedUrls,
    finalizeUpload,
};
