"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finalize = exports.preSignedUrls = exports.initialize = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const config_1 = require("../config");
const S3 = new client_s3_1.S3Client({
    region: config_1.config.AWS_REGION,
    useAccelerateEndpoint: true,
});
const initialize = async (region, orgId, userId, projectId, fileName) => S3.send(new client_s3_1.CreateMultipartUploadCommand({
    Bucket: config_1.config.UPLOAD_BUCKET,
    Key: `${region}/${orgId}_${userId}/${projectId}/${fileName}`,
}));
exports.initialize = initialize;
const preSignedUrls = async (fileKey, fileId, parts) => (await Promise.all(Array.from({ length: parts }, (_, i) => i + 1).map((i) => (0, s3_request_presigner_1.getSignedUrl)(S3, new client_s3_1.UploadPartCommand({
    Bucket: config_1.config.UPLOAD_BUCKET,
    Key: fileKey,
    UploadId: fileId,
    PartNumber: i,
}), { expiresIn: config_1.config.UPLOAD_URL_EXPIRES })))).map((url, i) => ({
    signedUrl: url,
    PartNumber: i + 1,
}));
exports.preSignedUrls = preSignedUrls;
const finalize = async (fileKey, fileId, parts) => S3.send(new client_s3_1.CompleteMultipartUploadCommand({
    Bucket: config_1.config.UPLOAD_BUCKET,
    Key: fileKey,
    UploadId: fileId,
    MultipartUpload: {
        Parts: [...parts].sort((p1, p2) => p1.PartNumber - p2.PartNumber),
    },
}));
exports.finalize = finalize;
