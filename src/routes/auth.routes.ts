import express from "express";
import { authController } from "../controllers/auth.controller";
import { asyncRouter } from "../utils/async-router.utils";
import authValidator from "../validators/auth.validator";
import { validationMiddleware } from "../middlewares/validation.middleware";

const router = express.Router();

// Login route
router.post(
  "/user-session",
  authValidator,
  validationMiddleware,
  asyncRouter(authController.login)
);

// SMS token route
router.post(
  "/request-token-sms",
  authValidator,
  validationMiddleware,
  asyncRouter(authController.RequestSms)
);

export default router;
