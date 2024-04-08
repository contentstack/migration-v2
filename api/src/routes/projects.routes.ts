import express from "express";
import { projectController } from "../controllers/projects.controller.js";
import { asyncRouter } from "../utils/async-router.utils.js";
import validator from "../validators/index.js";

const router = express.Router({ mergeParams: true });

// GET all projects route
router.get("/", asyncRouter(projectController.getAllProjects));

// GET a single project route
router.get("/:projectId", asyncRouter(projectController.getProject));

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

export default router;
