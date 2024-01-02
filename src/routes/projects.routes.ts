import express from "express";
import { projectController } from "../controllers/projects.controller";
import { authenticateUser } from "../middlewares/auth.middleware";

const router = express.Router();

// Login route
router.get(
  "/:orgId/projects",
  authenticateUser,
  projectController.getAllProjects
);
router.get(
  "/:orgId/project/:id",
  authenticateUser,
  projectController.getProject
);
router.post(
  "/:orgId/project",
  authenticateUser,
  projectController.createProject
);
router.delete(
  "/:orgId/project/:id",
  authenticateUser,
  projectController.createProject
);
router.put(
  "/:orgId/project/:id",
  authenticateUser,
  projectController.updateProject
);

export default router;
