import { Request } from "express";
import ProjectModel from "../models/project.js";
import {
  BadRequestError,
  ExceptionFunction,
  NotFoundError,
} from "../utils/custom-errors.utils.js";
import {
  EXCLUDE_CONTENT_MAPPER,
  PROJECT_UNSELECTED_FIELDS,
  HTTP_TEXTS,
  HTTP_CODES,
  POPULATE_CONTENT_MAPPER,
  POPULATE_FIELD_MAPPING,
  PROJECT_STATUS,
  STEPPER_STEPS,
} from "../constants/index.js";
import { config } from "../config/index.js";
import { getLogMessage, isEmpty, safePromise } from "../utils/index.js";
import getAuthtoken from "../utils/auth.utils.js";
import https from "../utils/https.utils.js";
import getProjectUtil from "../utils/get-project.utils.js";
import logger from "../utils/logger.js";
import { contentMapperService } from "./contentMapper.service.js";

const getAllProjects = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const decodedToken = req.body.token_payload;
  const { user_id = "", region = "" } = decodedToken;

  const project = await ProjectModel.find({
    org_id: orgId,
    region,
    owner: user_id,
  }).select(PROJECT_UNSELECTED_FIELDS);

  if (!project) throw new NotFoundError(HTTP_TEXTS.PROJECT_NOT_FOUND);

  return project;
};

const getProject = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const decodedToken = req.body.token_payload;
  const { user_id = "", region = "" } = decodedToken;
  // Find the project based on both orgId and projectId, region, owner
  const project = await getProjectUtil(
    projectId,
    {
      _id: projectId,
      org_id: orgId,
      region: region,
      owner: user_id,
    },
    EXCLUDE_CONTENT_MAPPER,
    "getProject"
  );

  return project;
};

const getProjectAllDetails = async (req: Request) => {
  const projectId = req?.params?.projectId;
  const srcFunc = "getProjectAllDetails";

  // Find the project
  const project = await ProjectModel.findOne({
    _id: projectId,
  }).populate({
    path: POPULATE_CONTENT_MAPPER,
    populate: { path: POPULATE_FIELD_MAPPING },
  });

  if (isEmpty(project)) {
    logger.error(
      getLogMessage(
        srcFunc,
        `${HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`
      )
    );
    throw new BadRequestError(HTTP_TEXTS.PROJECT_NOT_FOUND);
  }

  return project;
};

const createProject = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const { name, description } = req.body;
  const decodedToken = req.body.token_payload;
  const { user_id = "", region = "" } = decodedToken;
  const srcFunc = "createProject";
  const projectData = {
    region,
    org_id: orgId,
    owner: user_id,
    created_by: user_id,
    name,
    description,
  };

  try {
    //Add logic to create Project from DB
    const project = await ProjectModel.create(projectData);

    if (!project) throw new BadRequestError(HTTP_TEXTS.PROJECT_CREATION_FAILED);

    logger.info(
      getLogMessage(
        srcFunc,
        `Project successfully created Id : ${project._id}.`,
        decodedToken
      )
    );
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
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        HTTP_TEXTS.PROJECT_CREATION_FAILED,
        decodedToken,
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

const updateProject = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const updateData = req?.body;
  const decodedToken = req.body.token_payload;
  const { user_id = "", region = "" } = decodedToken;
  const srcFunc = "updateProject";

  // Find the project based on both orgId and projectId
  const project = await getProjectUtil(
    projectId,
    {
      _id: projectId,
      org_id: orgId,
      region: region,
      owner: user_id,
    },
    EXCLUDE_CONTENT_MAPPER,
    srcFunc
  );

  try {
    // Update the project fields
    project.name = updateData?.name || project.name;
    project.description = updateData?.description || project.description;
    project.updated_by = user_id;

    // Save the updated project
    const updatedProject = await project.save();
    logger.info(
      getLogMessage(
        srcFunc,
        `Project details have been successfully revised Id : ${project._id}.`,
        decodedToken
      )
    );
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
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while updating project [Id : ${projectId}].`,
        decodedToken,
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

const updateLegacyCMS = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const { token_payload, legacy_cms } = req.body;
  const srcFunc = "updateLegacyCMS";

  const project = await getProjectUtil(
    projectId,
    {
      _id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    EXCLUDE_CONTENT_MAPPER,
    srcFunc
  );

  if (
    project.status === PROJECT_STATUS.INPROGRESS ||
    project.status === PROJECT_STATUS.SUCCESS
  ) {
    logger.error(
      getLogMessage(srcFunc, HTTP_TEXTS.CANNOT_UPDATE_LEGACY_CMS, token_payload)
    );
    throw new BadRequestError(HTTP_TEXTS.CANNOT_UPDATE_LEGACY_CMS);
  }

  if (project.current_step > STEPPER_STEPS.LEGACY_CMS) {
    contentMapperService.removeMapping(projectId);
    logger.info(
      getLogMessage(
        srcFunc,
        `Content Mapping for project [Id : ${projectId}] has been successfully removed.`,
        token_payload
      )
    );
  }

  try {
    project.legacy_cms.cms = legacy_cms;
    project.current_step = STEPPER_STEPS.LEGACY_CMS;
    project.status = PROJECT_STATUS.DRAFT;

    await project.save();
    logger.info(
      getLogMessage(
        srcFunc,
        `Legacy CMS for project [Id : ${projectId}] has been successfully updated.`,
        token_payload
      )
    );
    return {
      status: HTTP_CODES.OK,
      data: {
        message: HTTP_TEXTS.CMS_UPDATED,
      },
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while updating legacy cms for project [Id : ${projectId}].`,
        token_payload,
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

const updateAffix = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const { token_payload, affix } = req.body;

  const project = await getProjectUtil(
    projectId,
    {
      _id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    EXCLUDE_CONTENT_MAPPER
  );

  project.legacy_cms.affix = affix;

  await project.save();

  return {
    status: HTTP_CODES.OK,
    data: {
      message: HTTP_TEXTS.AFFIX_UPDATED,
    },
  };
};

const affixConfirmation = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const { token_payload, affix_confirmation } = req.body;

  const project = await getProjectUtil(
    projectId,
    {
      _id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    EXCLUDE_CONTENT_MAPPER
  );

  project.legacy_cms.affix_confirmation = affix_confirmation;

  await project.save();

  return {
    status: HTTP_CODES.OK,
    data: {
      message: HTTP_TEXTS.AFFIX_CONFIRMATION_UPDATED,
    },
  };
};

const updateFileFormat = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const { token_payload, file_format } = req.body;
  const srcFunc = "updateFileFormat";

  const project = await getProjectUtil(
    projectId,
    {
      _id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    EXCLUDE_CONTENT_MAPPER,
    srcFunc
  );
  if (
    project.status === PROJECT_STATUS.INPROGRESS ||
    project.status === PROJECT_STATUS.SUCCESS
  ) {
    logger.error(
      getLogMessage(
        srcFunc,
        HTTP_TEXTS.CANNOT_UPDATE_FILE_FORMAT,
        token_payload
      )
    );
    throw new BadRequestError(HTTP_TEXTS.CANNOT_UPDATE_FILE_FORMAT);
  }

  if (project.current_step > STEPPER_STEPS.LEGACY_CMS) {
    contentMapperService.removeMapping(projectId);
    logger.info(
      getLogMessage(
        srcFunc,
        `Content Mapping for project [Id : ${projectId}] has been successfully removed.`,
        token_payload
      )
    );
  }

  try {
    project.legacy_cms.file_format = file_format;
    project.current_step = STEPPER_STEPS.LEGACY_CMS;
    project.status = PROJECT_STATUS.DRAFT;

    await project.save();
    logger.info(
      getLogMessage(
        srcFunc,
        `Legacy CMS file format for project [Id : ${projectId}] has been successfully updated.`,
        token_payload
      )
    );
    return {
      status: HTTP_CODES.OK,
      data: {
        message: HTTP_TEXTS.FILE_FORMAT_UPDATED,
      },
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while updating file format for project [Id : ${projectId}].`,
        token_payload,
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

const fileformatConfirmation = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const { token_payload, fileformat_confirmation } = req.body;

  const project = await getProjectUtil(
    projectId,
    {
      _id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    EXCLUDE_CONTENT_MAPPER
  );

  project.legacy_cms.file_format_confirmation = fileformat_confirmation;

  await project.save();

  return {
    status: HTTP_CODES.OK,
    data: {
      message: HTTP_TEXTS.FILEFORMAT_CONFIRMATION_UPDATED,
    },
  };
};

const updateDestinationStack = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const { token_payload, stack_api_key } = req.body;
  const srcFunc = "updateDestinationStack";

  const project = await getProjectUtil(
    projectId,
    {
      _id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    EXCLUDE_CONTENT_MAPPER,
    srcFunc
  );

  const authtoken = await getAuthtoken(
    token_payload?.region,
    token_payload?.user_id
  );

  if (
    project.status === PROJECT_STATUS.INPROGRESS ||
    project.status === PROJECT_STATUS.SUCCESS ||
    project.current_step < STEPPER_STEPS.DESTINATION_STACK
  ) {
    logger.error(
      getLogMessage(
        srcFunc,
        HTTP_TEXTS.CANNOT_UPDATE_DESTINATION_STACK,
        token_payload
      )
    );
    throw new BadRequestError(HTTP_TEXTS.CANNOT_UPDATE_DESTINATION_STACK);
  }

  if (project.current_step > STEPPER_STEPS.LEGACY_CMS) {
    contentMapperService.resetAllContentTypesMapping(projectId);
    logger.info(
      getLogMessage(
        srcFunc,
        `Content Mapping for project [Id : ${projectId}] has been successfully reset.`,
        token_payload
      )
    );
  }
  try {
    const [err, res] = await safePromise(
      https({
        method: "GET",
        url: `${config.CS_API[
          token_payload?.region as keyof typeof config.CS_API
        ]!}/stacks`,
        headers: {
          organization_uid: orgId,
          authtoken,
        },
      })
    );

    if (err)
      return {
        data: {
          message: HTTP_TEXTS.DESTINATION_STACK_ERROR,
        },
        status: err.response.status,
      };

    if (!res.data.stacks.find((stack: any) => stack.api_key === stack_api_key))
      throw new BadRequestError(HTTP_TEXTS.DESTINATION_STACK_NOT_FOUND);

    project.destination_stack_id = stack_api_key;
    project.current_step = STEPPER_STEPS.DESTINATION_STACK;
    project.status = PROJECT_STATUS.DRAFT;

    await project.save();
    logger.info(
      getLogMessage(
        srcFunc,
        `Destination stack for project [Id : ${projectId}] has been successfully updated`,
        token_payload
      )
    );
    return {
      status: HTTP_CODES.OK,
      data: {
        message: HTTP_TEXTS.DESTINATION_STACK_UPDATED,
      },
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while updating destination stack for project [Id : ${projectId}].`,
        token_payload,
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

const updateCurrentStep = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const token_payload = req.body.token_payload;
  const srcFunc = "updateCurrentStep";

  const project = await getProjectUtil(
    projectId,
    {
      _id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    EXCLUDE_CONTENT_MAPPER,
    srcFunc
  );
  const isStepCompleted =
    project?.legacy_cms?.cms && project?.legacy_cms?.file_format;

  switch (project.current_step) {
    case STEPPER_STEPS.LEGACY_CMS: {
      if (project.status !== PROJECT_STATUS.DRAFT || !isStepCompleted) {
        logger.error(
          getLogMessage(
            srcFunc,
            HTTP_TEXTS.CANNOT_PROCEED_LEGACY_CMS,
            token_payload
          )
        );
        throw new BadRequestError(HTTP_TEXTS.CANNOT_PROCEED_LEGACY_CMS);
      }
      project.current_step = STEPPER_STEPS.DESTINATION_STACK;
      break;
    }
    case STEPPER_STEPS.DESTINATION_STACK: {
      if (
        project.status !== PROJECT_STATUS.DRAFT ||
        !isStepCompleted ||
        !project?.destination_stack_id
      ) {
        logger.error(
          getLogMessage(
            srcFunc,
            HTTP_TEXTS.CANNOT_PROCEED_DESTINATION_STACK,
            token_payload
          )
        );
        throw new BadRequestError(HTTP_TEXTS.CANNOT_PROCEED_DESTINATION_STACK);
      }
      project.current_step = STEPPER_STEPS.CONTENT_MAPPING;
      project.status = PROJECT_STATUS.READY;
      break;
    }
  }
  try {
    await project.save();
    logger.info(
      getLogMessage(
        srcFunc,
        `Successfully progressed to the next step: ${project.current_step} for project [Id : ${projectId}].`,
        token_payload
      )
    );
    return project;
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while updating current step for project [Id : ${projectId}].`,
        token_payload,
        error
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};

const deleteProject = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;

  //Add logic to delete Project from DB
  return { orgId, projectId };
};

export const projectService = {
  getAllProjects,
  getProject,
  getProjectAllDetails,
  createProject,
  updateProject,
  updateLegacyCMS,
  updateAffix,
  affixConfirmation,
  updateFileFormat,
  fileformatConfirmation,
  updateDestinationStack,
  updateCurrentStep,
  deleteProject,
};
