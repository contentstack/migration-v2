import express from "express";
import multer from "multer";
import { projectController } from "../controllers/projects.controller.js";
import { asyncRouter } from "../utils/async-router.utils.js";
import validator from "../validators/index.js";

/**
 * Express router for handling project routes.
 */
const router = express.Router({ mergeParams: true });

// In-memory upload handling for project import zips (capped at 100 MB).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

// GET all projects route
router.get("/", asyncRouter(projectController.getAllProjects));

// GET a single project route
router.get("/:projectId", asyncRouter(projectController.getProject));

// Export a project (project record + mapper stores) as a zip archive
router.get("/:projectId/export", asyncRouter(projectController.exportProject));

// Import a project from an exported zip archive.
// `authenticateUser` (mounted on the router) sets `req.body.token_payload`, but
// multer replaces `req.body` with the parsed multipart fields. Stash the payload
// before multer runs and restore it afterwards so the controller still sees it.
router.post(
  "/import",
  (req, _res, next) => {
    (req as any).tokenPayload = (req as any)?.body?.token_payload;
    next();
  },
  upload.single("file"),
  (req, _res, next) => {
    (req as any).body = (req as any).body || {};
    (req as any).body.token_payload = (req as any).tokenPayload;
    next();
  },
  asyncRouter(projectController.importProject)
);

// Create a new project route
router.post("/", asyncRouter(projectController.createProject));

// Update a project route
router.put("/:projectId", asyncRouter(projectController.updateProject));

// Update project's legacy-cms
router.put(
  "/:projectId/legacy-cms",
  validator("cms"),
  asyncRouter(projectController.updateLegacyCMS)
);

// Update project's Affix
router.put(
  "/:projectId/affix",
  validator("affix"),
  asyncRouter(projectController.updateAffix)
);

// Update project's Affix confirmation
router.put(
  "/:projectId/affix_confirmation",
  validator("affix_confirmation_validator"),
  asyncRouter(projectController.affixConfirmation)
);

// Update project's file format
router.put(
  "/:projectId/file-format",
  validator("file_format"),
  asyncRouter(projectController.updateFileFormat)
);

// Update project's fileformat confirmation
router.put(
  "/:projectId/fileformat_confirmation",
  validator("fileformat_confirmation_validator"),
  asyncRouter(projectController.fileformatConfirmation)
);

// Update project's destination-cms
router.put(
  "/:projectId/destination-stack",
  validator("destination_stack"),
  asyncRouter(projectController.updateDestinationStack)
);

// Update project's current step
router.put(
  "/:projectId/current-step",
  asyncRouter(projectController.updateCurrentStep)
);

// Delete a project route
router.delete("/:projectId", asyncRouter(projectController.deleteProject));

//revert Project Route
router.patch("/:projectId", asyncRouter(projectController.revertProject));

//update stack details Project Route
router.patch("/:projectId/stack-details", asyncRouter(projectController.updateStackDetails));

//update migration execution key 
router.put("/:projectId/migration-excution",asyncRouter(projectController.updateMigrationExecution));

router.get("/:projectId/get-migrated-stacks", asyncRouter(projectController.getMigratedStacks))

export default router;
