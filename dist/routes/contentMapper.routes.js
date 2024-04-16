"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const projects_contentMapper_controller_1 = require("../controllers/projects.contentMapper.controller");
const async_router_utils_1 = require("../utils/async-router.utils");
const router = express_1.default.Router({ mergeParams: true });
//Developer End Point to create dummy data
router.post("/createDummyData/:projectId", (0, async_router_utils_1.asyncRouter)(projects_contentMapper_controller_1.contentMapperController.putTestData));
//Get ContentTypes List
router.get("/contentTypes/:projectId/:skip/:limit/:searchText?", (0, async_router_utils_1.asyncRouter)(projects_contentMapper_controller_1.contentMapperController.getContentTypes));
//Get FieldMapping List
router.get("/fieldMapping/:contentTypeId/:skip/:limit/:searchText?", (0, async_router_utils_1.asyncRouter)(projects_contentMapper_controller_1.contentMapperController.getFieldMapping));
//Get Existing ContentTypes List
router.get("/:projectId", (0, async_router_utils_1.asyncRouter)(projects_contentMapper_controller_1.contentMapperController.getExistingContentTypes));
//Update FieldMapping or contentType
router.put("/contentTypes/:contentTypeId", (0, async_router_utils_1.asyncRouter)(projects_contentMapper_controller_1.contentMapperController.putContentTypeFields));
//Reset FieldMapping or contentType
router.put("/resetFields/:contentTypeId", (0, async_router_utils_1.asyncRouter)(projects_contentMapper_controller_1.contentMapperController.resetContentType));
exports.default = router;
