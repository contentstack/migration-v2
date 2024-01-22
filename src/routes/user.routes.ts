import express from "express";
import { userController } from "../controllers/user.controller";
import { asyncRouter } from "../utils/async-router.utils";

const router = express.Router();

// Profile route
router.get("/profile", asyncRouter(userController.getUserProfile));

export default router;
