"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadsService = void 0;
const constants_1 = require("../constants");
const s3_uploads_utils_1 = require("../utils/s3-uploads.utils");
const get_project_utils_1 = __importDefault(require("../utils/get-project.utils"));
const initializeUpload = async (req) => {
    const orgId = req?.params?.orgId;
    const projectId = req?.params?.projectId;
    const fileName = req.body.file_name;
    const { user_id = "", region = "" } = req.body.token_payload;
    // Find the project based on both orgId and projectId, region, owner
    await (0, get_project_utils_1.default)(projectId, {
        _id: projectId,
        org_id: orgId,
        region: region,
        owner: user_id,
    }, constants_1.EXCLUDE_CONTENT_MAPPER);
    const result = await (0, s3_uploads_utils_1.initialize)(region, orgId, user_id, projectId, fileName);
    return {
        status: constants_1.HTTP_CODES.OK,
        data: {
            file_id: result.UploadId,
            file_key: result.Key,
        },
    };
};
const getPreSignedUrls = async (req) => {
    const orgId = req?.params?.orgId;
    const projectId = req?.params?.projectId;
    const { file_key, file_id, parts } = req.body;
    const { user_id = "", region = "" } = req.body.token_payload;
    // Find the project based on both orgId and projectId, region, owner
    await (0, get_project_utils_1.default)(projectId, {
        _id: projectId,
        org_id: orgId,
        region: region,
        owner: user_id,
    }, constants_1.EXCLUDE_CONTENT_MAPPER);
    const result = await (0, s3_uploads_utils_1.preSignedUrls)(file_key, file_id, parts);
    return {
        status: constants_1.HTTP_CODES.OK,
        data: { parts: result },
    };
};
const finalizeUpload = async (req) => {
    const orgId = req?.params?.orgId;
    const projectId = req?.params?.projectId;
    const { file_key, file_id, parts } = req.body;
    const { user_id = "", region = "" } = req.body.token_payload;
    // Find the project based on both orgId and projectId, region, owner
    await (0, get_project_utils_1.default)(projectId, {
        _id: projectId,
        org_id: orgId,
        region: region,
        owner: user_id,
    }, constants_1.EXCLUDE_CONTENT_MAPPER);
    await (0, s3_uploads_utils_1.finalize)(file_key, file_id, parts);
    return {
        status: constants_1.HTTP_CODES.OK,
        data: {
            message: constants_1.HTTP_TEXTS.UPLOAD_SUCCESS,
        },
    };
};
exports.uploadsService = {
    initializeUpload,
    getPreSignedUrls,
    finalizeUpload,
};
