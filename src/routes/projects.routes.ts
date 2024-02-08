import express from "express";
import { projectController } from "../controllers/projects.controller";
import { asyncRouter } from "../utils/async-router.utils";
import validator from "../validators";

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

// Update project's file format
router.put(
  "/:projectId/file-format",
  validator("file_format"),
  asyncRouter(projectController.updateFileFormat)
);

// Update project's destination-cms
router.put(
  "/:projectId/destination-stack",
  validator("destination_stack"),
  asyncRouter(projectController.updateDestinationStack)
);

// Delete a project route
router.delete("/:projectId", asyncRouter(projectController.deleteProject));

export default router;
