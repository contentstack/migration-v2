import express from "express";

import { asyncRouter } from "../utils/async-router.utils.js";
import { migrationController } from "../controllers/migration.controller.js";

/**
 * Express router for handling migration routes.
 */
const router = express.Router({ mergeParams: true });

/**
 * Route for test migration .
 * @route POST /test-stack/:orgId/:projectId
 * @group Migration
 * @param {string} orgId - The ID of the organization.
 * @param {string} projectId - The ID of the project.
 * @returns {Promise<void>} - A promise that resolves when the test stack is created.
 */
router.post(
  "/test-stack/:orgId/:projectId",
  asyncRouter(migrationController.startTestMigration)
);

/**
 * Route for deleting a test stack.
 * @route POST /test-stack/:projectId
 * @group Migration
 * @param {string} projectId - The ID of the project.
 * @returns {Promise<void>} - A promise that resolves when the test stack is deleted.
 */
router.post(
  "/test-stack/:projectId",
  asyncRouter(migrationController.deleteTestStack)
);

/**
 * Route for creating a test stack.
 * @route POST /test-stack/:projectId
 * @group Migration
 * @param {string} projectId - The ID of the project.
 * @returns {Promise<void>} - A promise that resolves when the test stack is deleted.
 */
router.post(
  "/create-test-stack/:orgId/:projectId",
  asyncRouter(migrationController.createTestStack)
);


/**
 * Route for final migration .
 * @route POST /test-stack/:orgId/:projectId
 * @group Migration
 * @param {string} orgId - The ID of the organization.
 * @param {string} projectId - The ID of the project.
 * @returns {Promise<void>} - A promise that resolves when the test stack is created.
 */
router.post(
  "/start/:orgId/:projectId",
  asyncRouter(migrationController.startMigration)
);

router.get(
  "/get_migration_logs/:orgId/:projectId/:stackId",
  asyncRouter(migrationController.getLogs)

)

/**
 * Route for updating the source locales from legacy CMS
 * @route POST /validator
 * @group Migration
 * @param {string} projectID - Current project ID
 * @body {Object} locales - Fetched Locales
 * @returns {Promise<void>} - A promise which resolves when the locales are updated in the DB
 */
router.post(
  "/localeMapper/:projectId",
  asyncRouter(migrationController.saveLocales)
)

/**
 * Route for updating the mapped locales by user 
 * @route POST /validator
 * @group Migration
 * @param {string} projectID - Current project ID
 * @body {Object} locales - Mapped Locales
 * @returns {Promise<void>} - A promise which resolves when the locales are updated in the DB
 */
router.post(
  "/updateLocales/:projectId",
  asyncRouter(migrationController.saveMappedLocales)
)


export default router;
