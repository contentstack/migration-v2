import express from "express";

import { asyncRouter } from "../utils/async-router.util.js";
import { auditController } from "../controllers/audit.controller.js";

/**
 * v3 Audit routes — mounted at `/v3/project/:projectId/audit` (auth applied at the
 * mount point in ../index.ts, so every endpoint here is behind the session guard
 * and the project's region/owner scope). Endpoint shapes follow trd.md API-1…API-5.
 */
const router = express.Router({ mergeParams: true });

// Start a scan, and poll it — API-1 / API-2
router.post("/run", asyncRouter(auditController.startScan));
router.get("/run/:jobId", asyncRouter(auditController.getJob));

// One page of flagged items, filtered and searched server-side — API-4.
// Declared before "/" so it is not shadowed by the findings read.
router.get("/items", asyncRouter(auditController.getItems));

// Persist the user's include/exclude decisions — API-5
router.put("/decisions", asyncRouter(auditController.putDecisions));

// The cached findings summary plus resolved decisions and impact — API-3
router.get("/", asyncRouter(auditController.getFindings));

export default router;
