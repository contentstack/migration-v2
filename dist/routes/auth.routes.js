"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_controller_1 = require("../controllers/auth.controller");
const async_router_utils_1 = require("../utils/async-router.utils");
const validators_1 = __importDefault(require("../validators"));
const router = express_1.default.Router();
// Login route
router.post("/user-session", (0, validators_1.default)("auth"), (0, async_router_utils_1.asyncRouter)(auth_controller_1.authController.login));
// SMS token route
router.post("/request-token-sms", (0, validators_1.default)("auth"), (0, async_router_utils_1.asyncRouter)(auth_controller_1.authController.RequestSms));
exports.default = router;
