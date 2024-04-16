"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.contentMapperService = void 0;
const contentTypesMapper_1 = __importDefault(require("../models/contentTypesMapper"));
const FieldMapper_1 = __importDefault(require("../models/FieldMapper"));
const project_1 = __importDefault(require("../models/project"));
const utils_1 = require("../utils");
const custom_errors_utils_1 = require("../utils/custom-errors.utils");
const constants_1 = require("../constants");
const logger_1 = __importDefault(require("../utils/logger"));
const config_1 = require("../config");
const https_utils_1 = __importDefault(require("../utils/https.utils"));
const auth_utils_1 = __importDefault(require("../utils/auth.utils"));
// Developer service to create dummy contentmapping data
const putTestData = async (req) => {
    const projectId = req.params.projectId;
    const contentTypes = req.body;
    // console.log(contentTypes)
    await Promise.all(contentTypes.map(async (type, index) => {
        await FieldMapper_1.default.insertMany(type.fieldMapping, {
            ordered: true,
        })
            .then(function (docs) {
            // do something with docs
            contentTypes[index].fieldMapping = docs.map((item) => {
                return item._id;
            });
        })
            .catch(function () {
            // console.log("type.fieldMapping")
            //  console.log(err)
            // error handling here
        });
    }));
    let typeIds = [];
    await contentTypesMapper_1.default.insertMany(contentTypes, {
        ordered: true,
    })
        .then(async function (docs) {
        // do something with docs
        typeIds = docs.map((item) => {
            return item._id;
        });
    })
        .catch(function () {
        // console.log(err)
        // error handling here
    });
    const projectDetails = await project_1.default.findOne({
        _id: projectId,
    });
    projectDetails.content_mapper = typeIds;
    projectDetails.save();
    //Add logic to get Project from DB
    return projectDetails;
};
const getContentTypes = async (req) => {
    const sourceFn = "getContentTypes";
    const projectId = req?.params?.projectId;
    const skip = req?.params?.skip;
    const limit = req?.params?.limit;
    const search = req?.params?.searchText?.toLowerCase();
    let result = [];
    let totalCount = 0;
    const projectDetails = await project_1.default.findOne({
        _id: projectId,
    }).populate({
        path: constants_1.POPULATE_CONTENT_MAPPER,
        select: constants_1.CONTENT_TYPE_POPULATE_FIELDS,
    });
    if ((0, utils_1.isEmpty)(projectDetails)) {
        logger_1.default.error((0, utils_1.getLogMessage)(sourceFn, `${constants_1.HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`));
        throw new custom_errors_utils_1.BadRequestError(constants_1.HTTP_TEXTS.PROJECT_NOT_FOUND);
    }
    const { content_mapper } = projectDetails;
    if (!(0, utils_1.isEmpty)(content_mapper)) {
        if (search) {
            const filteredResult = content_mapper
                .filter((item) => item?.otherCmsTitle?.toLowerCase().includes(search))
                ?.sort((a, b) => a.otherCmsTitle.localeCompare(b.otherCmsTitle));
            totalCount = filteredResult.length;
            result = filteredResult.slice(skip, Number(skip) + Number(limit));
        }
        else {
            totalCount = content_mapper.length;
            result = content_mapper
                ?.sort((a, b) => a.otherCmsTitle.localeCompare(b.otherCmsTitle))
                ?.slice(skip, Number(skip) + Number(limit));
        }
    }
    return { count: totalCount, contentTypes: result };
};
const getFieldMapping = async (req) => {
    const srcFunc = "getFieldMapping";
    const contentTypeId = req?.params?.contentTypeId;
    const skip = req?.params?.skip;
    const limit = req?.params?.limit;
    const search = req?.params?.searchText?.toLowerCase();
    let result = [];
    let filteredResult = [];
    let totalCount = 0;
    const contentType = await contentTypesMapper_1.default.findOne({
        _id: contentTypeId,
    }).populate("fieldMapping");
    if ((0, utils_1.isEmpty)(contentType)) {
        logger_1.default.error((0, utils_1.getLogMessage)(srcFunc, `${constants_1.HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND} Id: ${contentTypeId}`));
        throw new custom_errors_utils_1.BadRequestError(constants_1.HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND);
    }
    const { fieldMapping } = contentType;
    if (!(0, utils_1.isEmpty)(fieldMapping)) {
        if (search) {
            filteredResult = fieldMapping.filter((item) => item?.otherCmsField?.toLowerCase().includes(search));
            totalCount = filteredResult.length;
            result = filteredResult.slice(skip, Number(skip) + Number(limit));
        }
        else {
            totalCount = fieldMapping.length;
            result = fieldMapping.slice(skip, Number(skip) + Number(limit));
        }
    }
    return { count: totalCount, fieldMapping: result };
};
const getExistingContentTypes = async (req) => {
    const projectId = req?.params?.projectId;
    const { token_payload } = req.body;
    const authtoken = await (0, auth_utils_1.default)(token_payload?.region, token_payload?.user_id);
    const project = await project_1.default.findById(projectId);
    const stackId = project?.destination_stack_id;
    const [err, res] = await (0, utils_1.safePromise)((0, https_utils_1.default)({
        method: "GET",
        url: `${config_1.config.CS_API[token_payload?.region]}/content_types`,
        headers: {
            api_key: stackId,
            authtoken: authtoken,
        },
    }));
    if (err)
        return {
            data: err.response.data,
            status: err.response.status,
        };
    const contentTypes = res.data.content_types.map((singleCT) => {
        return {
            title: singleCT.title,
            uid: singleCT.uid,
            schema: singleCT.schema,
        };
    });
    //Add logic to get Project from DB
    return { contentTypes };
};
const updateContentType = async (req) => {
    const srcFun = "udateContentType";
    const contentTypeId = req?.params?.contentTypeId;
    const contentTypeData = req?.body;
    const { fieldMapping } = contentTypeData;
    let updatedContentType = {};
    if ((0, utils_1.isEmpty)(contentTypeData)) {
        logger_1.default.error((0, utils_1.getLogMessage)(srcFun, `${constants_1.HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND} Id: ${contentTypeId}`));
        throw new custom_errors_utils_1.BadRequestError(constants_1.HTTP_TEXTS.INVALID_CONTENT_TYPE);
    }
    try {
        updatedContentType = await contentTypesMapper_1.default.findOneAndUpdate({
            _id: contentTypeId,
        }, {
            otherCmsTitle: contentTypeData?.otherCmsTitle,
            otherCmsUid: contentTypeData?.otherCmsUid,
            isUpdated: contentTypeData?.isUpdated,
            updateAt: contentTypeData?.updateAt,
            contentstackTitle: contentTypeData?.contentstackTitle,
            contentstackUid: contentTypeData?.contentstackUid,
        }, { new: true, upsert: true, setDefaultsOnInsert: true });
        if (!(0, utils_1.isEmpty)(fieldMapping)) {
            const bulkWriteOperations = fieldMapping?.map((doc) => ({
                replaceOne: {
                    filter: { _id: doc._id },
                    replacement: doc,
                    upsert: true,
                },
            }));
            await FieldMapper_1.default.bulkWrite(bulkWriteOperations, { ordered: false });
        }
        return { updatedContentType };
    }
    catch (error) {
        logger_1.default.error((0, utils_1.getLogMessage)(srcFun, `Error while updating ContentType Id: ${contentTypeId}`, error));
        throw new custom_errors_utils_1.ExceptionFunction(error?.message || constants_1.HTTP_TEXTS.INTERNAL_ERROR, error?.status || constants_1.HTTP_CODES.SERVER_ERROR);
    }
};
const resetToInitialMapping = async (req) => {
    const srcFunc = "resetToInitialMapping";
    const contentTypeId = req?.params?.contentTypeId;
    const contentType = await contentTypesMapper_1.default.findOne({
        _id: contentTypeId,
    }).populate(constants_1.POPULATE_FIELD_MAPPING);
    if ((0, utils_1.isEmpty)(contentType)) {
        logger_1.default.error((0, utils_1.getLogMessage)(srcFunc, `${constants_1.HTTP_TEXTS.CONTENT_TYPE_NOT_FOUND} Id: ${contentTypeId}`));
        throw new custom_errors_utils_1.BadRequestError(constants_1.HTTP_TEXTS.INVALID_CONTENT_TYPE);
    }
    try {
        if (!(0, utils_1.isEmpty)(contentType?.fieldMapping)) {
            const bulkWriteOperations = contentType?.fieldMapping?.map((doc) => ({
                updateOne: {
                    filter: { _id: doc._id },
                    update: {
                        $set: {
                            contentstackField: "",
                            contentstackFieldUid: "",
                            ContentstackFieldType: doc.backupFieldType,
                        },
                    },
                },
            }));
            await FieldMapper_1.default.bulkWrite(bulkWriteOperations, { ordered: false });
        }
        contentType.contentstackTitle = "";
        contentType.contentstackUid = "";
        contentType?.save();
        return { message: constants_1.HTTP_TEXTS.RESET_CONTENT_MAPPING };
    }
    catch (error) {
        logger_1.default.error((0, utils_1.getLogMessage)(srcFunc, `Error occurred while resetting the field mapping for the ContentType ID: ${contentTypeId}`, {}, error));
        throw new custom_errors_utils_1.ExceptionFunction(error?.message || constants_1.HTTP_TEXTS.INTERNAL_ERROR, error?.status || error.statusCode || constants_1.HTTP_CODES.SERVER_ERROR);
    }
};
const removeMapping = async (req) => {
    const srcFunc = "removeMapping";
    const projectId = req?.params?.projectId;
    const projectDetails = await project_1.default.findOne({
        _id: projectId,
    }).populate({
        path: constants_1.POPULATE_CONTENT_MAPPER,
        populate: { path: constants_1.POPULATE_FIELD_MAPPING },
    });
    if ((0, utils_1.isEmpty)(projectDetails)) {
        logger_1.default.error((0, utils_1.getLogMessage)(srcFunc, `${constants_1.HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`));
        throw new custom_errors_utils_1.BadRequestError(constants_1.HTTP_TEXTS.PROJECT_NOT_FOUND);
    }
    try {
        const contentTypes = projectDetails?.content_mapper;
        const contentTypesbulkWriteOperations = await Promise.all(contentTypes?.map(async (contentType) => {
            if (!(0, utils_1.isEmpty)(contentType?.fieldMapping)) {
                const bulkWriteOperations = contentType?.fieldMapping?.map((doc) => ({
                    deleteOne: {
                        filter: { _id: doc._id },
                    },
                }));
                await FieldMapper_1.default.bulkWrite(bulkWriteOperations, {
                    ordered: false,
                });
            }
            return {
                deleteOne: {
                    filter: { _id: contentType._id },
                },
            };
        }));
        await contentTypesMapper_1.default.bulkWrite(contentTypesbulkWriteOperations, {
            ordered: false,
        });
        projectDetails.content_mapper = [];
        await projectDetails?.save();
        return projectDetails;
    }
    catch (error) {
        logger_1.default.error((0, utils_1.getLogMessage)(srcFunc, `Error occurred while removing the content mapping for the Project [Id: ${projectId}]`, {}, error));
        throw new custom_errors_utils_1.ExceptionFunction(error?.message || constants_1.HTTP_TEXTS.INTERNAL_ERROR, error?.statusCode || error?.status || constants_1.HTTP_CODES.SERVER_ERROR);
    }
};
exports.contentMapperService = {
    putTestData,
    getContentTypes,
    getFieldMapping,
    getExistingContentTypes,
    updateContentType,
    resetToInitialMapping,
    removeMapping,
};
