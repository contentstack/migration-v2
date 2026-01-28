import express from "express";
import { authController } from "../controllers/auth.controller.js";
import { asyncRouter } from "../utils/async-router.utils.js";
import validator from "../validators/index.js";

/**
 * Express router for handling authentication routes.
 */
const router = express.Router();

/**
 * Route for user login.
 *
 * @route POST /user-session
 * @group Authentication
 * @param {object} req.body - The request body containing user credentials.
 * @returns {object} The response object containing user session information.
 * @throws {ValidationError} If the request body fails validation.
 * @throws {InternalServerError} If an error occurs while processing the request.
 */
router.post(
  "/user-session",
  validator("auth"),
  asyncRouter(authController.login)
);

/**
 * Route for requesting SMS token.
 *
 * @route POST /request-token-sms
 * @group Authentication
 * @param {object} req.body - The request body containing user information.
 * @returns {object} The response object containing the SMS token.
 * @throws {ValidationError} If the request body fails validation.
 * @throws {InternalServerError} If an error occurs while processing the request.
 */
router.post(
  "/request-token-sms",
  validator("auth"),
  asyncRouter(authController.RequestSms)
);

/**
 * Generates the OAuth token and saves it to the database.
 * @param req - The request object. Sends the code and region.
 * @param res - The response object. Sends the message "Token received successfully."
 * @route POST /v2/auth/save-token
 */
router.get(
  "/save-token",
  asyncRouter(authController.saveOAuthToken)
);

/**
 * @route GET /api/app-config
 * @desc Get app configuration from app.json
 * @access Public
 */
router.get('/app-config', authController.getAppConfigHandler);

/**
 * @route GET /v2/auth/sso-status/:userId
 * @desc Check SSO authentication status for a user
 * @param userId - The user ID to check authentication status for
 * @access Public
 */
router.get('/sso-status/:userId', authController.getSSOAuthStatus);

/**
 * @route POST /v2/auth/logout
 * @desc Log out a user
 * @access Public
 */
router.post('/logout', authController.logout);

export default router;
