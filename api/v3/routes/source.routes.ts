import express from "express";
import multer from "multer";

import { asyncRouter } from "../utils/async-router.util.js";
import { sourceController } from "../controllers/source.controller.js";

/**
 * v3 Source routes — mounted at `/v3/source` (auth applied at the mount point
 * in ../index.ts). Endpoint shapes follow trd.md §6 (API-1…API-6).
 */
const router = express.Router({ mergeParams: true });

// In-memory upload for export bundles, capped at 100 MB (FR-3.9 / DEP-5).
// Limit overridable via V3_UPLOAD_LIMIT (bytes) for tests.
const uploadLimit = Number(process.env.V3_UPLOAD_LIMIT) || 100 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: uploadLimit },
});

// Listing (feeds cascading dropdowns) — API-4 / FR-5.3
router.get("/regions", asyncRouter(sourceController.listRegions));

// Cross-region source authentication — real Contentstack login for a region
// other than the caller's home-region session.
router.post("/region-login", asyncRouter(sourceController.regionLogin));
router.get("/orgs", asyncRouter(sourceController.listOrgs));
router.get("/stacks", asyncRouter(sourceController.listStacks));
router.get("/branches", asyncRouter(sourceController.listBranches));

// Modules with counts — API-5 / FR-5.4
router.get("/modules", asyncRouter(sourceController.listModules));

// Async export/extract — API-1, API-2 / FR-5.5
router.post("/export", asyncRouter(sourceController.startExport));
router.get("/export/:jobId", asyncRouter(sourceController.getExportStatus));

// File upload + validate — API-3 / FR-3.3, FR-3.8, FR-3.9
router.post(
  "/upload",
  upload.single("file"),
  asyncRouter(sourceController.uploadBundle)
);

// Content graph — API-6 / FR-5.6
router.get("/:projectId/graph", asyncRouter(sourceController.getGraph));

export default router;
