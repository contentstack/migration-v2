"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const project_1 = __importDefault(require("../models/project"));
const custom_errors_utils_1 = require("../utils/custom-errors.utils");
const constants_1 = require("../constants");
const utils_1 = require("../utils");
exports.default = async (projectId, query, projections = "") => {
    try {
        if (!(0, utils_1.isValidObjectId)(projectId))
            throw new custom_errors_utils_1.BadRequestError(constants_1.HTTP_TEXTS.INVALID_ID.replace("$", "project"));
        const project = await project_1.default.findOne(query).select(projections);
        if (!project)
            throw new custom_errors_utils_1.NotFoundError(constants_1.HTTP_TEXTS.NO_PROJECT);
        return project;
    }
    catch (err) {
        throw new custom_errors_utils_1.DatabaseError(constants_1.HTTP_TEXTS.SOMETHING_WENT_WRONG);
    }
};
