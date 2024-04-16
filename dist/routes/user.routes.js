"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const user_controller_1 = require("../controllers/user.controller");
const async_router_utils_1 = require("../utils/async-router.utils");
const router = express_1.default.Router();
// Profile route
router.get("/profile", (0, async_router_utils_1.asyncRouter)(user_controller_1.userController.getUserProfile));
exports.default = router;
