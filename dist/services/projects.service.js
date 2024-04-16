"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectService = void 0;
const project_1 = __importDefault(require("../models/project"));
const custom_errors_utils_1 = require("../utils/custom-errors.utils");
const constants_1 = require("../constants");
const config_1 = require("../config");
const utils_1 = require("../utils");
const auth_utils_1 = __importDefault(require("../utils/auth.utils"));
const https_utils_1 = __importDefault(require("../utils/https.utils"));
const get_project_utils_1 = __importDefault(require("../utils/get-project.utils"));
const logger_1 = __importDefault(require("../utils/logger"));
const getAllProjects = async (req) => {
    const orgId = req?.params?.orgId;
    const decodedToken = req.body.token_payload;
    const { user_id = "", region = "" } = decodedToken;
    const project = await project_1.default.find({
        org_id: orgId,
        region,
        owner: user_id,
    }).select(constants_1.PROJECT_UNSELECTED_FIELDS);
    if (!project)
        throw new custom_errors_utils_1.NotFoundError(constants_1.HTTP_TEXTS.PROJECT_NOT_FOUND);
    return project;
};
const getProject = async (req) => {
    const orgId = req?.params?.orgId;
    const projectId = req?.params?.projectId;
    const decodedToken = req.body.token_payload;
    const { user_id = "", region = "" } = decodedToken;
    // Find the project based on both orgId and projectId, region, owner
    const project = await (0, get_project_utils_1.default)(projectId, {
        _id: projectId,
        org_id: orgId,
        region: region,
        owner: user_id,
    }, constants_1.EXCLUDE_CONTENT_MAPPER);
    return project;
};
const getProjectAllDetails = async (req) => {
    const projectId = req?.params?.projectId;
    const srcFunc = "getProjectAllDetails";
    // Find the project
    const project = await project_1.default.findOne({
        _id: projectId,
    }).populate({
        path: constants_1.POPULATE_CONTENT_MAPPER,
        populate: { path: constants_1.POPULATE_FIELD_MAPPING },
    });
    if ((0, utils_1.isEmpty)(project)) {
        logger_1.default.error((0, utils_1.getLogMessage)(srcFunc, `${constants_1.HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`));
        throw new custom_errors_utils_1.BadRequestError(constants_1.HTTP_TEXTS.PROJECT_NOT_FOUND);
    }
    return project;
};
const createProject = async (req) => {
    const orgId = req?.params?.orgId;
    const { name, description } = req.body;
    const decodedToken = req.body.token_payload;
    const { user_id = "", region = "" } = decodedToken;
    const projectData = {
        region,
        org_id: orgId,
        owner: user_id,
        created_by: user_id,
        name,
        description,
    };
    //Add logic to create Project from DB
    const project = await project_1.default.create(projectData);
    if (!project)
        throw new custom_errors_utils_1.NotFoundError(constants_1.HTTP_TEXTS.PROJECT_NOT_FOUND);
    return {
        status: "success",
        message: "Project created successfully",
        project: {
            name: project.name,
            id: project.id,
            status: project.status,
            created_at: project.created_at,
            modified_at: project.updated_at,
            // Add other properties as needed
        },
    };
};
const updateProject = async (req) => {
    const orgId = req?.params?.orgId;
    const projectId = req?.params?.projectId;
    const updateData = req?.body;
    const decodedToken = req.body.token_payload;
    const { user_id = "", region = "" } = decodedToken;
    // Find the project based on both orgId and projectId
    const project = await (0, get_project_utils_1.default)(projectId, {
        _id: projectId,
        org_id: orgId,
        region: region,
        owner: user_id,
    }, constants_1.EXCLUDE_CONTENT_MAPPER);
    // Update the project fields
    project.name = updateData?.name || project.name;
    project.description = updateData?.description || project.description;
    project.updated_by = user_id;
    // Save the updated project
    const updatedProject = await project.save();
    return {
        status: "success",
        message: "Project updated successfully",
        project: {
            name: updatedProject?.name,
            description: updatedProject?.description,
            id: updatedProject?.id,
            status: updatedProject?.status,
            created_at: updatedProject?.created_at,
            modified_at: updatedProject?.updated_at,
            // Add other properties as needed
        },
    };
};
const updateLegacyCMS = async (req) => {
    const { orgId, projectId } = req.params;
    const { token_payload, legacy_cms } = req.body;
    const project = await (0, get_project_utils_1.default)(projectId, {
        _id: projectId,
        org_id: orgId,
        region: token_payload?.region,
        owner: token_payload?.user_id,
    }, constants_1.EXCLUDE_CONTENT_MAPPER);
    project.legacy_cms.cms = legacy_cms;
    await project.save();
    return {
        status: constants_1.HTTP_CODES.OK,
        data: {
            message: constants_1.HTTP_TEXTS.CMS_UPDATED,
        },
    };
};
const updateFileFormat = async (req) => {
    const { orgId, projectId } = req.params;
    const { token_payload, file_format } = req.body;
    const project = await (0, get_project_utils_1.default)(projectId, {
        _id: projectId,
        org_id: orgId,
        region: token_payload?.region,
        owner: token_payload?.user_id,
    }, constants_1.EXCLUDE_CONTENT_MAPPER);
    project.legacy_cms.file_format = file_format;
    await project.save();
    return {
        status: constants_1.HTTP_CODES.OK,
        data: {
            message: constants_1.HTTP_TEXTS.FILE_FORMAT_UPDATED,
        },
    };
};
const updateDestinationStack = async (req) => {
    const { orgId, projectId } = req.params;
    const { token_payload, stack_api_key } = req.body;
    const project = await (0, get_project_utils_1.default)(projectId, {
        _id: projectId,
        org_id: orgId,
        region: token_payload?.region,
        owner: token_payload?.user_id,
    }, constants_1.EXCLUDE_CONTENT_MAPPER);
    const authtoken = await (0, auth_utils_1.default)(token_payload?.region, token_payload?.user_id);
    const [err, res] = await (0, utils_1.safePromise)((0, https_utils_1.default)({
        method: "GET",
        url: `${config_1.config.CS_API[token_payload?.region]}/stacks`,
        headers: {
            organization_uid: orgId,
            authtoken,
        },
    }));
    if (err)
        return {
            data: {
                message: constants_1.HTTP_TEXTS.DESTINATION_STACK_ERROR,
            },
            status: err.response.status,
        };
    if (!res.data.stacks.find((stack) => stack.api_key === stack_api_key))
        throw new custom_errors_utils_1.BadRequestError(constants_1.HTTP_TEXTS.DESTINATION_STACK_NOT_FOUND);
    project.destination_stack_id = stack_api_key;
    // project.migration.modules.destination_cms.org_id = orgId;
    await project.save();
    return {
        status: constants_1.HTTP_CODES.OK,
        data: {
            message: constants_1.HTTP_TEXTS.DESTINATION_STACK_UPDATED,
        },
    };
};
const deleteProject = async (req) => {
    const orgId = req?.params?.orgId;
    const projectId = req?.params?.projectId;
    //Add logic to delete Project from DB
    return { orgId, projectId };
};
exports.projectService = {
    getAllProjects,
    getProject,
    getProjectAllDetails,
    createProject,
    updateProject,
    updateLegacyCMS,
    updateFileFormat,
    updateDestinationStack,
    deleteProject,
};
