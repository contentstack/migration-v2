import express from "express";
import { orgController } from "../controllers/org.controller.js";
import { asyncRouter } from "../utils/async-router.utils.js";
import validator from "../validators/index.js";

const router = express.Router({ mergeParams: true });

// GET all org stacks route
router.get("/stacks", asyncRouter(orgController.getAllStacks));

// Create a new stack route
router.post(
  "/stacks",
  validator("project"),
  asyncRouter(orgController.createStack)
);

// GET all contentstack locales route
router.get("/locales", asyncRouter(orgController.getLocales));

// GET Content_types count
router.post(
  "/stack_status",
  validator("destination_stack"),
  asyncRouter(orgController.getStackStatus)
);

export default router;
