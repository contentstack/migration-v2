"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const org_controller_1 = require("../controllers/org.controller");
const async_router_utils_1 = require("../utils/async-router.utils");
const validators_1 = __importDefault(require("../validators"));
const router = express_1.default.Router({ mergeParams: true });
// GET all org stacks route
router.get("/stacks", (0, async_router_utils_1.asyncRouter)(org_controller_1.orgController.getAllStacks));
// Create a new stack route
router.post("/stacks", (0, validators_1.default)("project"), (0, async_router_utils_1.asyncRouter)(org_controller_1.orgController.createStack));
// GET all contentstack locales route
router.get("/locales", (0, async_router_utils_1.asyncRouter)(org_controller_1.orgController.getLocales));
exports.default = router;
