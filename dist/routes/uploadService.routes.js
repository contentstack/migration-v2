"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const projects_controller_1 = require("../controllers/projects.controller");
const async_router_utils_1 = require("../utils/async-router.utils");
const projects_contentMapper_controller_1 = require("../controllers/projects.contentMapper.controller");
const router = express_1.default.Router({ mergeParams: true });
//TODO Will update
// Upload project's file
router.put("/:projectId/file-path", (0, async_router_utils_1.asyncRouter)(projects_controller_1.projectController.updateFileFormat));
//TODO Will update
//Add Initial ContentMapper
router.post("/initialMapper/:projectId", (0, async_router_utils_1.asyncRouter)(projects_contentMapper_controller_1.contentMapperController.putTestData));
exports.default = router;
