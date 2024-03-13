import express from "express";
import { projectController } from "../controllers/projects.controller.js";
import { asyncRouter } from "../utils/async-router.utils.js";

const router = express.Router({ mergeParams: true });

// GET Project Details
router.get(
  "/project/:projectId",
  asyncRouter(projectController.getProjectAllDetails)
);

// Update a project route
// router.put("/:projectId", asyncRouter(projectController.updateProject));

export default router;
