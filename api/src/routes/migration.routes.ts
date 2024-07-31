import express from "express";

import { asyncRouter } from "../utils/async-router.utils.js";
import { migrationController } from "../controllers/migration.controller.js";

const router = express.Router({ mergeParams: true });
// Create a new project route
router.post(
  "/test-stack/:orgId/:projectId",
  asyncRouter(migrationController.fieldMapping)
);
router.post(
  "/test-stack/:projectId",
  asyncRouter(migrationController.deleteTestStack)
);
export default router;
