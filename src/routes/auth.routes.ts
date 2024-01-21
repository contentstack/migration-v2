import express from "express";
import { authController } from "../controllers/auth.controller";
import { asyncRouter } from "../utils/async-router.utils";

const router = express.Router();

// Login route
router.post("/user-session", asyncRouter(authController.login));

// SMS token route
router.post("/request-token-sms", asyncRouter(authController.RequestSms));

export default router;
