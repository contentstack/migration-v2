import express from "express";
import { migrationController } from "../controllers/projects.migrations.controller";
import { asyncRouter } from "../utils/async-router.utils";
import validator from "../validators";

const router = express.Router({ mergeParams: true });

// GET project's migration route
router.get("/", asyncRouter(migrationController.getMigration));

// Create a new project's migration route
router.post(
  "/",
  validator("project"),
  asyncRouter(migrationController.createMigration)
);

// Update project's migration route
router.put(
  "/:migrationId",
  validator("project"),
  asyncRouter(migrationController.updateMigration)
);

// Update project's legacy-cms
router.put(
  "/:migrationId/legacy-cms",
  validator("cms"),
  asyncRouter(migrationController.updateMigrationLegacyCMS)
);

// Update project's file format
router.put(
  "/:migrationId/file-format",
  validator("file_format"),
  asyncRouter(migrationController.updateMigrationFileFormat)
);

// Delete project's migration route
router.delete(
  "/:migrationId",
  asyncRouter(migrationController.deleteMigration)
);

export default router;
