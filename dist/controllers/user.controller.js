"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userController = void 0;
const user_service_1 = require("../services/user.service");
const constants_1 = require("../constants");
const getUserProfile = async (req, res) => {
    const user = await user_service_1.userService.getUserProfile(req);
    res.status(constants_1.HTTP_CODES.OK).json(user);
};
exports.userController = {
    getUserProfile,
};
