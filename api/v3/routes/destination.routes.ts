import express from "express";

import { asyncRouter } from "../utils/async-router.util.js";
import { destinationController } from "../controllers/destination.controller.js";

/**
 * v3 Destination routes — mounted at `/v3/destination` (auth applied at the
 * mount point in ../index.ts). Endpoint shapes follow trd.md §6 (API-3…API-5).
 *
 * Region/organization/existing-stack listing is NOT re-implemented here: the
 * Destination panel calls `cs-source-selection`'s `/v3/source/*` listing
 * endpoints directly (trd.md TC-1 / TR-2).
 */
const router = express.Router({ mergeParams: true });

// Create a new destination stack — API-4 / FR-1.4, FR-1.5
router.post("/stacks", asyncRouter(destinationController.createStack));

// Create a read/write management token on the destination stack — API-3 / FR-3.3
router.post(
  "/management-tokens",
  asyncRouter(destinationController.createManagementToken)
);

// Locales on the destination stack — feeds FR-4.1/FR-4.2 dropdowns
router.get("/locales", asyncRouter(destinationController.listLocales));

// Every locale Contentstack supports — feeds the create-stack master-locale
// picker (the stack being created has no locales of its own yet).
router.get(
  "/contentstack-locales",
  asyncRouter(destinationController.listContentstackLocales)
);

// Existing content statistics for the "Stack contents" card — API-5 / FR-10.2–10.4
router.get(
  "/stacks/:apiKey/stats",
  asyncRouter(destinationController.getStackStats)
);

export default router;
