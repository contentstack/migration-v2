import express from "express";
import { authController } from "../controllers/auth.controller";
import { authenticateUser } from "../middlewares/auth.middleware";
import { asyncRouter } from "../utils/async-router.utils";

const router = express.Router();

// Login route
router.post("/login", authenticateUser, asyncRouter(authController.login));

export default router;
