import express from "express";
import { uploadController } from "../controllers/projects.uploads.controller";
import { asyncRouter } from "../utils/async-router.utils";
import validator from "../validators";

const router = express.Router({ mergeParams: true });

// Initialize multipart upload
router.post(
  "/initialize",
  validator("initialize_upload"),
  asyncRouter(uploadController.initializeUpload)
);

// GET pre-signed urls
router.post(
  "/pre-signed-urls",
  validator("file_upload"),
  asyncRouter(uploadController.getPreSignedUrls)
);

// Finalize multipart upload
router.post(
  "/finalize",
  validator("file_upload"),
  asyncRouter(uploadController.finalizeUpload)
);

export default router;
