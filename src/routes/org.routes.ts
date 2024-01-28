import express from "express";
import { orgController } from "../controllers/org.controller";
import { asyncRouter } from "../utils/async-router.utils";
import validator from "../validators";

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

export default router;
