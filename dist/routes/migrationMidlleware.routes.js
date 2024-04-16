"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const projects_controller_1 = require("../controllers/projects.controller");
const async_router_utils_1 = require("../utils/async-router.utils");
const router = express_1.default.Router({ mergeParams: true });
// GET Project Details
router.get("project/:projectId", (0, async_router_utils_1.asyncRouter)(projects_controller_1.projectController.getProjectAllDetails));
// Update a project route
// router.put("/:projectId", asyncRouter(projectController.updateProject));
exports.default = router;
