import express from "express";
import authController from "../controllers/auth.controller";
import { authenticateUser } from "../middlewares/auth.middleware";

const router = express.Router();

// Login route
router.post("/login", authenticateUser, authController.login);

export default router;
