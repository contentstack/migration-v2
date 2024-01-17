import express from "express";
import { migrationController } from "../controllers/projects.migrations.controller";
import { asyncRouter } from "../utils/async-router.utils";

const router = express.Router({ mergeParams: true });

// GET project's migration route
router.get("/", asyncRouter(migrationController.getMigration));

// Create a new project's migration route
router.post("/", asyncRouter(migrationController.createMigration));

// Update project's migration route
router.put("/:migrationId", asyncRouter(migrationController.updateMigration));

// Delete project's migration route
router.delete(
  "/:migrationId",
  asyncRouter(migrationController.deleteMigration)
);

export default router;
