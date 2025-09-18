import express from "express";
import { referenceLimitValidationController } from "../controllers/referenceLimitValidation.controller.js";
import { authenticateUser } from "../middlewares/auth.middleware.js";

const router = express.Router();

/**
 * @route POST /v2/projects/:projectId/validate-reference-limits
 * @desc Validate reference limits for all content types in a project
 * @access Private
 * @param {string} projectId - The project ID
 * @body {object} token_payload - User authentication token payload
 * @returns {object} Validation result with any violations found
 */
router.post(
  "/:projectId/validate-reference-limits",
  authenticateUser,
  referenceLimitValidationController.validateReferenceeLimits
);

/**
 * @route POST /v2/projects/:projectId/reference-usage-summary
 * @desc Get reference usage summary for a project
 * @access Private
 * @param {string} projectId - The project ID
 * @body {object} token_payload - User authentication token payload
 * @returns {object} Summary of reference usage across content types
 */
router.post(
  "/:projectId/reference-usage-summary",
  authenticateUser,
  referenceLimitValidationController.getReferenceUsageSummary
);

export default router;
