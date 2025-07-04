import express from "express";
import { orgController } from "../controllers/org.controller.js";
import { asyncRouter } from "../utils/async-router.utils.js";
import validator from "../validators/index.js";

/**
 * Express router for handling organization routes.
 */
const router = express.Router({ mergeParams: true });

/**
 * GET all org stacks route.
 * @param searchText - Optional parameter for searching stacks.
 */
router.get("/stacks/:searchText?", asyncRouter(orgController.getAllStacks));

/**
 * Create a new stack route.
 * @param req - Express request object.
 * @param res - Express response object.
 */
router.post(
  "/stacks",
  validator("stack"),
  asyncRouter(orgController.createStack)
);

/**
 * GET all contentstack locales route.
 * @param req - Express request object.
 * @param res - Express response object.
 */
router.get("/locales", asyncRouter(orgController.getLocales));

/**
 * GET Content_types count.
 * @param req - Express request object.
 * @param res - Express response object.
 */
router.post(
  "/stack_status",
  validator("destination_stack"),
  asyncRouter(orgController.getStackStatus)
);

/**
 * GET all contentstack locales route.
 * @param req - Express request object.
 * @param res - Express response object.
 */
router.get("/get_stack_locales", asyncRouter(orgController.getStackLocale));


/**
 * GET all contentstack org details route.
 * @param req - Express request object.
 * @param res - Express response object.
 */
router.get("/get_org_details", asyncRouter(orgController.getOrgDetails));



export default router;
