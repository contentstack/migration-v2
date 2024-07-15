import express from "express";
import { userController } from "../controllers/user.controller.js";
import { asyncRouter } from "../utils/async-router.utils.js";

const router = express.Router();

/**
 * Route for getting user profile.
 * @route GET /profile
 * @group User
 * @returns {Promise<void>} - A promise that resolves when the user profile is retrieved.
 */
router.get("/profile", asyncRouter(userController.getUserProfile));

export default router;
