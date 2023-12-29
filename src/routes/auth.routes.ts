import express from "express";
import { authControllr } from "../controllers/auth.controller";
import { authenticateUser } from "../middlewares/auth.middleware";

const router = express.Router();

// Login route
router.post("/login", authenticateUser, authControllr.login);

export default router;
