"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contentMapperController = void 0;
const contentMapper_service_1 = require("../services/contentMapper.service");
const putTestData = async (req, res) => {
    const resp = await contentMapper_service_1.contentMapperService.putTestData(req);
    res.status(200).json(resp);
};
const getContentTypes = async (req, res) => {
    const resp = await contentMapper_service_1.contentMapperService.getContentTypes(req);
    res.status(200).json(resp);
};
const getFieldMapping = async (req, res) => {
    const resp = await contentMapper_service_1.contentMapperService.getFieldMapping(req);
    res.status(200).json(resp);
};
const getExistingContentTypes = async (req, res) => {
    const resp = await contentMapper_service_1.contentMapperService.getExistingContentTypes(req);
    res.status(201).json(resp);
};
const putContentTypeFields = async (req, res) => {
    const resp = await contentMapper_service_1.contentMapperService.updateContentType(req);
    res.status(200).json(resp);
};
const resetContentType = async (req, res) => {
    const resp = await contentMapper_service_1.contentMapperService.resetToInitialMapping(req);
    res.status(200).json(resp);
};
// TODO Will remove if not required
// const removeMapping = async (req: Request, res: Response): Promise<void> => {
//   const resp = await contentMapperService.removeMapping(req);
//   res.status(200).json(resp);
// };
exports.contentMapperController = {
    getContentTypes,
    getFieldMapping,
    getExistingContentTypes,
    putTestData,
    putContentTypeFields,
    resetContentType,
    // removeMapping,
};
