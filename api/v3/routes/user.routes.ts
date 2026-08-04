import express from "express";

import { asyncRouter } from "../utils/async-router.util.js";
import { userController } from "../controllers/user.controller.js";

/**
 * v3 user route — mounted at `/v3/user` (auth applied at the mount point in
 * ../index.ts). Follows cs-project-dashboard trd.md API-3.
 */
const router = express.Router({ mergeParams: true });

router.get("/", asyncRouter(userController.getUser));

export default router;
