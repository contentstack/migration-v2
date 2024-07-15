import express from "express";
import { authController } from "../controllers/auth.controller.js";
import { asyncRouter } from "../utils/async-router.utils.js";
import validator from "../validators/index.js";

const router = express.Router();

// Login route
router.post(
  "/user-session",
  validator("auth"),
  asyncRouter(authController.login)
);

// SMS token route
router.post(
  "/request-token-sms",
  validator("auth"),
  asyncRouter(authController.RequestSms)
);

export default router;
