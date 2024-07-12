import express from "express";
import { orgController } from "../controllers/org.controller.js";
import { asyncRouter } from "../utils/async-router.utils.js";
import validator from "../validators/index.js";

const router = express.Router({ mergeParams: true });

/**
 * GET all org stacks route
 * @route GET /stacks/:searchText?
 * @param {string} searchText - Optional search text
 * @returns {Promise<void>}
 */
router.get("/stacks/:searchText?", asyncRouter(orgController.getAllStacks));

/**
 * Create a new stack route
 * @route POST /stacks
 * @param {object} project - The project data
 * @returns {Promise<void>}
 */
router.post(
  "/stacks",
  validator("project"),
  asyncRouter(orgController.createStack)
);

/**
 * GET all contentstack locales route
 * @route GET /locales
 * @returns {Promise<void>}
 */
router.get("/locales", asyncRouter(orgController.getLocales));

/**
 * GET Content_types count
 * @route POST /stack_status
 * @param {object} destination_stack - The destination stack data
 * @returns {Promise<void>}
 */
router.post(
  "/stack_status",
  validator("destination_stack"),
  asyncRouter(orgController.getStackStatus)
);

export default router;
