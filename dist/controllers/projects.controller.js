"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectController = void 0;
const projects_service_1 = require("../services/projects.service");
const getAllProjects = async (req, res) => {
    const allProjects = await projects_service_1.projectService.getAllProjects(req);
    res.status(200).json(allProjects);
};
const getProject = async (req, res) => {
    const project = await projects_service_1.projectService.getProject(req);
    res.status(200).json(project);
};
const getProjectAllDetails = async (req, res) => {
    const project = await projects_service_1.projectService.getProjectAllDetails(req);
    res.status(200).json(project);
};
const createProject = async (req, res) => {
    const project = await projects_service_1.projectService.createProject(req);
    res.status(201).json(project);
};
const updateProject = async (req, res) => {
    const project = await projects_service_1.projectService.updateProject(req);
    res.status(200).json(project);
};
const updateLegacyCMS = async (req, res) => {
    const resp = await projects_service_1.projectService.updateLegacyCMS(req);
    res.status(resp.status).json(resp.data);
};
const updateFileFormat = async (req, res) => {
    const resp = await projects_service_1.projectService.updateFileFormat(req);
    res.status(resp.status).json(resp.data);
};
const updateDestinationStack = async (req, res) => {
    const resp = await projects_service_1.projectService.updateDestinationStack(req);
    res.status(resp.status).json(resp.data);
};
const deleteProject = async (req, res) => {
    const project = await projects_service_1.projectService.deleteProject(req);
    res.status(200).json(project);
};
exports.projectController = {
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
