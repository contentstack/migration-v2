import express from "express";
import migrationsRoutes from "./projects.migrations.routes";
import { projectController } from "../controllers/projects.controller";
import { asyncRouter } from "../utils/async-router.utils";

const router = express.Router({ mergeParams: true });

// GET all projects route
router.get("/", asyncRouter(projectController.getAllProjects));

// GET a single project route
router.get("/:projectId", asyncRouter(projectController.getProject));

// Create a new project route
router.post("/", asyncRouter(projectController.createProject));

// Update a project route
router.put("/:projectId", asyncRouter(projectController.updateProject));

// Delete a project route
router.delete("/:projectId", asyncRouter(projectController.deleteProject));

// Project migration's Router
router.use("/:projectId/migration", migrationsRoutes);

export default router;
