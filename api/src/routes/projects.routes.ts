import express from "express";
import { projectController } from "../controllers/projects.controller.js";
import { asyncRouter } from "../utils/async-router.utils.js";
import validator from "../validators/index.js";

const router = express.Router({ mergeParams: true });

/**
 * GET all projects route
 * @route GET /projects
 */
router.get("/", asyncRouter(projectController.getAllProjects));

/**
 * GET a single project route
 * @route GET /projects/:projectId
 * @param {string} projectId - The ID of the project
 */
router.get("/:projectId", asyncRouter(projectController.getProject));

/**
 * Create a new project route
 * @route POST /projects
 */
router.post("/", asyncRouter(projectController.createProject));

/**
 * Update a project route
 * @route PUT /projects/:projectId
 * @param {string} projectId - The ID of the project
 */
router.put("/:projectId", asyncRouter(projectController.updateProject));

/**
 * Update project's legacy-cms
 * @route PUT /projects/:projectId/legacy-cms
 * @param {string} projectId - The ID of the project
 */
router.put(
  "/:projectId/legacy-cms",
  validator("cms"),
  asyncRouter(projectController.updateLegacyCMS)
);

/**
 * Update project's Affix
 * @route PUT /projects/:projectId/affix
 * @param {string} projectId - The ID of the project
 */
router.put(
  "/:projectId/affix",
  validator("affix"),
  asyncRouter(projectController.updateAffix)
);

/**
 * Update project's Affix confirmation
 * @route PUT /projects/:projectId/affix_confirmation
 * @param {string} projectId - The ID of the project
 */
router.put(
  "/:projectId/affix_confirmation",
  validator("affix_confirmation_validator"),
  asyncRouter(projectController.affixConfirmation)
);

/**
 * Update project's file format
 * @route PUT /projects/:projectId/file-format
 * @param {string} projectId - The ID of the project
 */
router.put(
  "/:projectId/file-format",
  validator("file_format"),
  asyncRouter(projectController.updateFileFormat)
);

/**
 * Update project's fileformat confirmation
 * @route PUT /projects/:projectId/fileformat_confirmation
 * @param {string} projectId - The ID of the project
 */
router.put(
  "/:projectId/fileformat_confirmation",
  validator("fileformat_confirmation_validator"),
  asyncRouter(projectController.fileformatConfirmation)
);

/**
 * Update project's destination-cms
 * @route PUT /projects/:projectId/destination-stack
 * @param {string} projectId - The ID of the project
 */
router.put(
  "/:projectId/destination-stack",
  validator("destination_stack"),
  asyncRouter(projectController.updateDestinationStack)
);

/**
 * Update project's current step
 * @route PUT /projects/:projectId/current-step
 * @param {string} projectId - The ID of the project
 */
router.put(
  "/:projectId/current-step",
  asyncRouter(projectController.updateCurrentStep)
);

/**
 * Delete a project route
 * @route DELETE /projects/:projectId
 * @param {string} projectId - The ID of the project
 */
router.delete("/:projectId", asyncRouter(projectController.deleteProject));

/**
 * Revert Project Route
 * @route PATCH /projects/:projectId
 * @param {string} projectId - The ID of the project
 */
router.patch("/:projectId", asyncRouter(projectController.revertProject));

export default router;
