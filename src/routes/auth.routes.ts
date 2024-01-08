import express from "express";
import { authController } from "../controllers/auth.controller";
import { authenticateUser } from "../middlewares/auth.middleware";
import { asyncRouter } from "../utils/async-router.utils";

const router = express.Router();

// Login route
router.post("/user-session", asyncRouter(authController.login));

// SMS token route
router.post("/request-token-sms", asyncRouter(authController.RequestSms));

// Logout route
//TODO:

// Profile route
router.get(
  "/profile",
  authenticateUser,
  asyncRouter(authController.getUserProfile)
);

export default router;
