"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const projects_uploads_controller_1 = require("../controllers/projects.uploads.controller");
const async_router_utils_1 = require("../utils/async-router.utils");
const validators_1 = __importDefault(require("../validators"));
const router = express_1.default.Router({ mergeParams: true });
// Initialize multipart upload
router.post("/initialize", (0, validators_1.default)("initialize_upload"), (0, async_router_utils_1.asyncRouter)(projects_uploads_controller_1.uploadController.initializeUpload));
// GET pre-signed urls
router.post("/pre-signed-urls", (0, validators_1.default)("file_upload"), (0, async_router_utils_1.asyncRouter)(projects_uploads_controller_1.uploadController.getPreSignedUrls));
// Finalize multipart upload
router.post("/finalize", (0, validators_1.default)("file_upload"), (0, async_router_utils_1.asyncRouter)(projects_uploads_controller_1.uploadController.finalizeUpload));
exports.default = router;
