import express from "express";
import { uploadController } from "../controllers/projects.uploads.controller";
import { asyncRouter } from "../utils/async-router.utils";
// import validator from "../validators";

const router = express.Router({ mergeParams: true });

// Initialize multipart upload
router.post("/initialize", asyncRouter(uploadController.initializeUpload));

// GET pre-signed urls
router.post("/pre-signed-urls", asyncRouter(uploadController.getPreSignedUrls));

// Finalize multipart upload
router.post("/finalize", asyncRouter(uploadController.finalizeUpload));

export default router;
