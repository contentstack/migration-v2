import express from "express";

import { asyncRouter } from "../utils/async-router.util.js";
import { contentMappingController } from "../controllers/contentMapping.controller.js";

/**
 * v3 Content mapping routes — mounted at `/v3/project/:projectId/content-mapping`
 * (auth applied at the mount point in ../index.ts, so every endpoint here is behind
 * the session guard and the project's region/owner scope).
 * Endpoint shapes follow cs-content-type-selection trd.md API-1, API-2.
 */
const router = express.Router({ mergeParams: true });

// The whole content type inventory, the reference graph and any saved selection — API-1
router.get("/inventory", asyncRouter(contentMappingController.getInventory));

// Replace the stored content type selection — API-2
router.put("/selection", asyncRouter(contentMappingController.putSelection));

export default router;
