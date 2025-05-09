import express from "express";
import { userController } from "../controllers/user.controller.js";
import { asyncRouter } from "../utils/async-router.utils.js";

const router = express.Router();

// Profile route
router.get("/profile", asyncRouter(userController.getUserProfile));

export default router;
