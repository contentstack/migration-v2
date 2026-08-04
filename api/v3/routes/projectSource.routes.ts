import express from "express";

import { asyncRouter } from "../utils/async-router.util.js";
import { sourceController } from "../controllers/source.controller.js";

/**
 * v3 project-scoped source persistence — mounted at
 * `/v3/project/:projectId/source` (auth applied at the mount point
 * in ../index.ts). Follows trd.md API-7 / FR-5.2.
 */
const router = express.Router({ mergeParams: true });

router.put("/", asyncRouter(sourceController.persistSource));
router.get("/", asyncRouter(sourceController.getSource));

export default router;
