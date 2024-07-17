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

export default router;
