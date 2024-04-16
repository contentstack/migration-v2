"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const projects_controller_1 = require("../controllers/projects.controller");
const async_router_utils_1 = require("../utils/async-router.utils");
const validators_1 = __importDefault(require("../validators"));
const projects_uploads_routes_1 = __importDefault(require("./projects.uploads.routes"));
const router = express_1.default.Router({ mergeParams: true });
// GET all projects route
router.get("/", (0, async_router_utils_1.asyncRouter)(projects_controller_1.projectController.getAllProjects));
// GET a single project route
router.get("/:projectId", (0, async_router_utils_1.asyncRouter)(projects_controller_1.projectController.getProject));
// Create a new project route
router.post("/", (0, async_router_utils_1.asyncRouter)(projects_controller_1.projectController.createProject));
// Update a project route
router.put("/:projectId", (0, async_router_utils_1.asyncRouter)(projects_controller_1.projectController.updateProject));
// Update project's legacy-cms
router.put("/:projectId/legacy-cms", (0, validators_1.default)("cms"), (0, async_router_utils_1.asyncRouter)(projects_controller_1.projectController.updateLegacyCMS));
// Update project's file format
router.put("/:projectId/file-format", (0, validators_1.default)("file_format"), (0, async_router_utils_1.asyncRouter)(projects_controller_1.projectController.updateFileFormat));
// Update project's destination-cms
router.put("/:projectId/destination-stack", (0, validators_1.default)("destination_stack"), (0, async_router_utils_1.asyncRouter)(projects_controller_1.projectController.updateDestinationStack));
// Delete a project route
router.delete("/:projectId", (0, async_router_utils_1.asyncRouter)(projects_controller_1.projectController.deleteProject));
// Multipart upload route
router.use("/:projectId/uploads", projects_uploads_routes_1.default);
exports.default = router;
