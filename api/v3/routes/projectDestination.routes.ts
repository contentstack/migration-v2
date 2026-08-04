import express from "express";

import { asyncRouter } from "../utils/async-router.util.js";
import { destinationController } from "../controllers/destination.controller.js";

/**
 * v3 project-scoped destination persistence — mounted at
 * `/v3/project/:projectId/destination` (auth applied at the mount
 * point in ../index.ts). Follows trd.md API-1 / API-2 / FR-8.2.
 */
const router = express.Router({ mergeParams: true });

router.put("/", asyncRouter(destinationController.persistDestination));
router.get("/", asyncRouter(destinationController.getDestination));

export default router;
