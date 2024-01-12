import express from "express";
import { projectController } from "../controllers/projects.controller";
import { asyncRouter } from "../utils/async-router.utils";

const router = express.Router({ mergeParams: true });

// GET all projects route
router.get(
  "/",
  asyncRouter(projectController.getAllProjects)
);

// GET a single project route
router.get(
  "/:id",
  asyncRouter(projectController.getProject)
);

// Create a new project route
router.post(
  "/",
  asyncRouter(projectController.createProject)
);

// Delete a project route
router.delete(
  "/:id",
  asyncRouter(projectController.deleteProject)
);

// Update a project route
router.put(
  "/:id",
  asyncRouter(projectController.updateProject)
);

export default router;
