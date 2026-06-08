import express from "express";
import { userController } from "../controllers/user.controller.js";
import { asyncRouter } from "../utils/async-router.utils.js";

const router = express.Router();

// Profile route
router.get("/profile", asyncRouter(userController.getUserProfile));

// Regional source-login session (stack-to-stack migration). Persists the
// source app token on the user record so it never lives in browser storage
// and survives across browser sessions.
router.get("/source-session", asyncRouter(userController.getSourceSession));
router.put("/source-session", asyncRouter(userController.setSourceSession));
router.delete("/source-session", asyncRouter(userController.clearSourceSession));

export default router;
