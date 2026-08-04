import express from "express";

import { asyncRouter } from "../utils/async-router.util.js";
import { projectController } from "../controllers/project.controller.js";

/**
 * v3 project routes — mounted at `/v3/project` (auth applied at the
 * mount point in ../index.ts, so a route added here cannot be left unguarded).
 * Follows cs-project-dashboard trd.md API-1 / API-2.
 */
const router = express.Router({ mergeParams: true });

router.get("/", asyncRouter(projectController.listProjects));
router.post("/", asyncRouter(projectController.createProject));

export default router;
