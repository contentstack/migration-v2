import { Request } from "express";
import ProjectModelLowdb from "../models/project-lowdb.js";
import ContentTypesMapperModelLowdb from "../models/contentTypesMapper-lowdb.js";
import FieldMapperModel from "../models/FieldMapper.js";

import {
  BadRequestError,
  ExceptionFunction,
  NotFoundError,
} from "../utils/custom-errors.utils.js";
import {
  HTTP_TEXTS,
  HTTP_CODES,
  STEPPER_STEPS,
  NEW_PROJECT_STATUS,
} from "../constants/index.js";
import { config } from "../config/index.js";
import { getLogMessage, isEmpty, safePromise } from "../utils/index.js";
import getAuthtoken from "../utils/auth.utils.js";
import https from "../utils/https.utils.js";
import getProjectUtil from "../utils/get-project.utils.js";
import logger from "../utils/logger.js";
// import { contentMapperService } from "./contentMapper.service.js";
import { v4 as uuidv4 } from "uuid";

/**
 * Retrieves all projects based on the provided request object.
 *
 * @param req - The request object containing the orgId and token_payload.
 * @returns A Promise that resolves to an array of projects.
 * @throws {NotFoundError} If no projects are found.
 */
const getAllProjects = async (req: Request) => {
  const orgId = req?.params?.orgId;

  const decodedToken = req.body.token_payload;
  const { user_id = "", region = "" } = decodedToken;

  await ProjectModelLowdb.read();
  const projects = ProjectModelLowdb.chain
    .get("projects")
    .filter({
      org_id: orgId,
      region,
      owner: user_id,
      isDeleted: false
    })
    .value();

  if (!projects) throw new NotFoundError(HTTP_TEXTS.PROJECT_NOT_FOUND);

  return projects;
};

/**
 * Retrieves a project based on the provided request.
 * @param req - The request object containing the orgId, projectId, and token_payload.
 * @returns A Promise that resolves to the retrieved project.
 */
const getProject = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const decodedToken = req.body.token_payload;
  const { user_id = "", region = "" } = decodedToken;
  // Find the project based on both orgId and projectId, region, owner
  const project = await getProjectUtil(
    projectId,
    {
      id: projectId,
      org_id: orgId,
      region: region,
      owner: user_id,
    },
    "getProject"
  );

  return project;
};

/**
 * Creates a new project.
 * @param req - The request object containing the project details.
 * @returns An object with the status, message, and project details.
 * @throws ExceptionFunction if there is an error creating the project.
 */
const createProject = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const { name, description } = req.body;
  const decodedToken = req.body.token_payload;
  const { user_id = "", region = "" } = decodedToken;
  const srcFunc = "createProject";
  const projectData = {
    id: uuidv4(),
    region,
    org_id: orgId,
    owner: user_id,
    former_owner_ids: [],
    name,
    description,
    status: NEW_PROJECT_STATUS[0],
    current_step: STEPPER_STEPS.LEGACY_CMS,
    destination_stack_id: "",
    test_stacks: [],
    current_test_stack_id: "",
    legacy_cms: {
      is_fileValid: false,
      awsDetails: {
        awsRegion: "",
        bucketName: "",
        buketKey: "",
      },
    },
    content_mapper: [],
    execution_log: [],
    created_by: user_id,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    isDeleted: false,
    isNewStack: false,
    newStackId: "",
    stackDetails: {
      uid: '',
      label: '',
      master_locale: '',
      created_at: '',
    },
    mapperKeys: []
  };

  try {
    //Add logic to create Project from DB
    await ProjectModelLowdb.read();

    ProjectModelLowdb.update((data: any) => {
      data.projects.push(projectData);
    });

    logger.info(
      getLogMessage(
        srcFunc,
        `Project successfully created Id : ${projectData.id}.`,
        decodedToken
      )
    );
    return {
      status: "success",
      message: "Project created successfully",
      project: {
        name: projectData.name,
        id: projectData.id,
        status: projectData.status,
        created_at: projectData.created_at,
        modified_at: projectData.updated_at,
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

/**
 * Updates a project based on the provided request.
 * @param req - The request object containing the necessary information.
 * @returns An object with the updated project details.
 * @throws ExceptionFunction if an error occurs while updating the project.
 */
const updateProject = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const updateData = req?.body;
  const decodedToken = req.body.token_payload;
  const { user_id = "", region = "" } = decodedToken;
  const srcFunc = "updateProject";
  let project: any;

  // Find the project based on both orgId and projectId
  const projectIndex = (await getProjectUtil(
    projectId,
    {
      id: projectId,
      org_id: orgId,
      region: region,
      owner: user_id,
    },
    srcFunc,
    true
  )) as number;

  try {
    // Update the project fields
    ProjectModelLowdb.update((data: any) => {
      data.projects[projectIndex].name = updateData?.name;
      data.projects[projectIndex].description = updateData?.description;
      if (
        data.projects[projectIndex].isNewStack === false &&
        updateData?.isNewStack === true
      ) {
        data.projects[projectIndex].isNewStack = updateData?.isNewStack;
        data.projects[projectIndex].newStackId = updateData?.newStackId;
      }
      data.projects[projectIndex].updated_by = user_id;
      data.projects[projectIndex].updated_at = new Date().toISOString();
      data.projects[projectIndex].stackDetails = updateData?.stackDetails;
      data.projects[projectIndex].mapperKeys = updateData?.mapperKeys;

      project = data.projects[projectIndex];
    });

    logger.info(
      getLogMessage(
        srcFunc,
        `Project details have been successfully revised Id : ${projectId}.`,
        decodedToken
      )
    );
    return {
      status: "success",
      message: "Project updated successfully",
      project: {
        name: updateData?.name,
        description: updateData?.description,
        id: project?.id,
        status: project?.status,
        created_at: project?.created_at,
        modified_at: project?.updated_at,
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

/**
 * Updates the legacy CMS for a project.
 *
 * @param req - The request object containing the parameters and body.
 * @returns An object with the status and data of the update operation.
 * @throws BadRequestError if the project status is invalid.
 * @throws ExceptionFunction if an error occurs during the update.
 */
const updateLegacyCMS = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const { token_payload, legacy_cms } = req.body;
  const srcFunc = "updateLegacyCMS";

  await ProjectModelLowdb.read();
  const projectIndex = (await getProjectUtil(
    projectId,
    {
      id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    srcFunc,
    true
  )) as number;

  const project = ProjectModelLowdb.data.projects[projectIndex];

  if (
    project.status === NEW_PROJECT_STATUS[4] ||
    project.status === NEW_PROJECT_STATUS[5]
  ) {
    logger.error(
      getLogMessage(srcFunc, HTTP_TEXTS.CANNOT_UPDATE_LEGACY_CMS, token_payload)
    );
    throw new BadRequestError(HTTP_TEXTS.CANNOT_UPDATE_LEGACY_CMS);
  }

  // if (project.current_step > STEPPER_STEPS.LEGACY_CMS) {
  //   await contentMapperService.removeMapping(projectId);
  //   logger.info(
  //     getLogMessage(
  //       srcFunc,
  //       `Content Mapping for project [Id : ${projectId}] has been successfully removed.`,
  //       token_payload
  //     )
  //   );
  // }

  try {
    ProjectModelLowdb.update((data: any) => {
      data.projects[projectIndex].legacy_cms.cms = legacy_cms;
      data.projects[projectIndex].current_step = STEPPER_STEPS.LEGACY_CMS;
      data.projects[projectIndex].status = NEW_PROJECT_STATUS[0];
      data.projects[projectIndex].updated_at = new Date().toISOString();
    });

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

/**
 * Updates the affix of a project.
 *
 * @param req - The request object containing the parameters and body.
 * @returns An object with the status and data properties.
 */
const updateAffix = async (req: Request) => {
  const srcFunc = "updateAffix";
  const { orgId, projectId } = req.params;
  const { token_payload, affix } = req.body;

  await ProjectModelLowdb.read();
  const projectIndex = (await getProjectUtil(
    projectId,
    {
      id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    srcFunc,
    true
  )) as number;

  ProjectModelLowdb.update((data: any) => {
    data.projects[projectIndex].legacy_cms.affix = affix;
    data.projects[projectIndex].updated_at = new Date().toISOString();
  });

  return {
    status: HTTP_CODES.OK,
    data: {
      message: HTTP_TEXTS.AFFIX_UPDATED,
    },
  };
};

/**
 * Affixes the confirmation to a project in the database.
 *
 * @param req - The request object containing the parameters and body.
 * @returns An object with the status and data properties.
 */
const affixConfirmation = async (req: Request) => {
  const srcFunc = "affixConfirmation";
  const { orgId, projectId } = req.params;
  const { token_payload, affix_confirmation } = req.body;

  await ProjectModelLowdb.read();
  const projectIndex = (await getProjectUtil(
    projectId,
    {
      id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    srcFunc,
    true
  )) as number;

  ProjectModelLowdb.update((data: any) => {
    data.projects[projectIndex].legacy_cms.affix_confirmation =
      affix_confirmation;
    data.projects[projectIndex].updated_at = new Date().toISOString();
  });

  return {
    status: HTTP_CODES.OK,
    data: {
      message: HTTP_TEXTS.AFFIX_CONFIRMATION_UPDATED,
    },
  };
};

/**
 * Updates the file format for a project.
 * @param req - The request object containing the parameters and body.
 * @returns An object with the status and data properties.
 * @throws BadRequestError if the project status is invalid.
 * @throws ExceptionFunction if an error occurs while updating the file format.
 */
const updateFileFormat = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const {
    token_payload,
    file_format,
    file_path,
    is_localPath,
    is_fileValid,
    awsDetails,
  } = req.body;
  const srcFunc = "updateFileFormat";
  const projectIndex = (await getProjectUtil(
    projectId,
    {
      id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    srcFunc,
    true
  )) as number;

  const project = ProjectModelLowdb.data.projects[projectIndex];

  if (
    project.status === NEW_PROJECT_STATUS[4] ||
    project.status === NEW_PROJECT_STATUS[5]
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

  // if (project.current_step > STEPPER_STEPS.LEGACY_CMS) {
  //   await contentMapperService.removeMapping(projectId);
  //   logger.info(
  //     getLogMessage(
  //       srcFunc,
  //       `Content Mapping for project [Id : ${projectId}] has been successfully removed.`,
  //       token_payload
  //     )
  //   );
  // }

  try {
    ProjectModelLowdb.update((data: any) => {
      data.projects[projectIndex].legacy_cms.file_format = file_format;
      data.projects[projectIndex].legacy_cms.file_path = file_path;
      data.projects[projectIndex].legacy_cms.is_fileValid = is_fileValid;
      data.projects[projectIndex].legacy_cms.is_localPath = is_localPath;
      data.projects[projectIndex].current_step = STEPPER_STEPS.LEGACY_CMS;
      data.projects[projectIndex].status = NEW_PROJECT_STATUS[0];
      data.projects[projectIndex].updated_at = new Date().toISOString();
      data.projects[projectIndex].legacy_cms.awsDetails.awsRegion =
        awsDetails.awsRegion;
      data.projects[projectIndex].legacy_cms.awsDetails.bucketName =
        awsDetails.bucketName;
      data.projects[projectIndex].legacy_cms.awsDetails.buketKey =
        awsDetails.buketKey;
    });

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

/**
 * Updates the file format confirmation for a project.
 * @param req - The request object containing the parameters and body.
 * @returns An object with the status and data properties.
 */
const fileformatConfirmation = async (req: Request) => {
  const srcFunc = "fileformat";
  const { orgId, projectId } = req.params;
  const { token_payload, fileformat_confirmation } = req.body;

  await ProjectModelLowdb.read();
  const projectIndex = (await getProjectUtil(
    projectId,
    {
      id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    srcFunc,
    true
  )) as number;

  ProjectModelLowdb.update((data: any) => {
    data.projects[projectIndex].legacy_cms.file_format_confirmation =
      fileformat_confirmation;
    data.projects[projectIndex].updated_at = new Date().toISOString();
  });

  return {
    status: HTTP_CODES.OK,
    data: {
      message: HTTP_TEXTS.FILEFORMAT_CONFIRMATION_UPDATED,
    },
  };
};

/**
 * Updates the destination stack for a project.
 *
 * @param req - The request object containing the parameters and body.
 * @returns An object with the status and data of the update operation.
 * @throws BadRequestError if the project status is invalid or the destination stack is not found.
 * @throws ExceptionFunction if an error occurs while updating the destination stack.
 */
const updateDestinationStack = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const { token_payload, stack_api_key } = req.body;
  const srcFunc = "updateDestinationStack";

  await ProjectModelLowdb.read();
  const projectIndex = (await getProjectUtil(
    projectId,
    {
      id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    srcFunc,
    true
  )) as number;

  const project = ProjectModelLowdb.data.projects[projectIndex];

  const authtoken = await getAuthtoken(
    token_payload?.region,
    token_payload?.user_id
  );

  if (
    project.status === NEW_PROJECT_STATUS[4] ||
    project.status === NEW_PROJECT_STATUS[5] ||
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
  // if (project.current_step > STEPPER_STEPS.DESTINATION_STACK) {
  //   await contentMapperService.resetAllContentTypesMapping(projectId);
  //   logger.info(
  //     getLogMessage(
  //       srcFunc,
  //       `Content Mapping for project [Id : ${projectId}] has been successfully reset.`,
  //       token_payload
  //     )
  //   );
  // }
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

    ProjectModelLowdb.update((data: any) => {
      data.projects[projectIndex].destination_stack_id = stack_api_key;
      data.projects[projectIndex].current_step =
        STEPPER_STEPS.DESTINATION_STACK;
      data.projects[projectIndex].status = NEW_PROJECT_STATUS[0];
      data.projects[projectIndex].updated_at = new Date().toISOString();
    });

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

/**
 * Updates the current step of a project based on the provided request.
 * @param req - The request object containing the parameters and body.
 * @returns The updated project object.
 * @throws {BadRequestError} If the current step cannot be updated.
 * @throws {ExceptionFunction} If an error occurs while updating the current step.
 */
const updateCurrentStep = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const token_payload = req.body.token_payload;
  const srcFunc = "updateCurrentStep";

  try {
    await ProjectModelLowdb.read();
    const projectIndex = (await getProjectUtil(
      projectId,
      {
        id: projectId,
        org_id: orgId,
        region: token_payload?.region,
        owner: token_payload?.user_id,
      },
      srcFunc,
      true
    )) as number;

    const project = ProjectModelLowdb.data.projects[projectIndex];

    const isStepCompleted =
      project?.legacy_cms?.cms && project?.legacy_cms?.file_format;

    switch (project.current_step) {
      case STEPPER_STEPS.LEGACY_CMS: {
        if (project.status !== NEW_PROJECT_STATUS[0] || !isStepCompleted) {
          logger.error(
            getLogMessage(
              srcFunc,
              HTTP_TEXTS.CANNOT_PROCEED_LEGACY_CMS,
              token_payload
            )
          );
          throw new BadRequestError(HTTP_TEXTS.CANNOT_PROCEED_LEGACY_CMS);
        }

        ProjectModelLowdb.update((data: any) => {
          data.projects[projectIndex].current_step =
            STEPPER_STEPS.DESTINATION_STACK;
          data.projects[projectIndex].status =
            project.current_step <= STEPPER_STEPS.CONTENT_MAPPING ? NEW_PROJECT_STATUS[0]
              : NEW_PROJECT_STATUS[1];
          data.projects[projectIndex].updated_at = new Date().toISOString();
        });
        break;
      }
      case STEPPER_STEPS.DESTINATION_STACK: {
        if (
          project.status !== NEW_PROJECT_STATUS[0] ||
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
          throw new BadRequestError(
            HTTP_TEXTS.CANNOT_PROCEED_DESTINATION_STACK
          );
        }

        ProjectModelLowdb.update((data: any) => {
          data.projects[projectIndex].current_step =
            STEPPER_STEPS.CONTENT_MAPPING;
          data.projects[projectIndex].status = NEW_PROJECT_STATUS[3];
          // data.projects[projectIndex].status = NEW_PROJECT_STATUS[3];
          data.projects[projectIndex].updated_at = new Date().toISOString();
        });
        break;
      }
    }
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

/**
 * Deletes a project.
 * @param req - The request object containing the project ID and organization ID.
 * @returns An object with the status and data properties.
 */
const deleteProject = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const decodedToken = req.body.token_payload;
  const { user_id = "", region = "" } = decodedToken;
  const srcFunc = "deleteProject";

  await ProjectModelLowdb.read();
  const projectIndex = (await getProjectUtil(
    projectId,
    {
      id: projectId,
      org_id: orgId,
      region: region,
      owner: user_id,
    },
    srcFunc,
    true
  )) as number;

  const projects = ProjectModelLowdb.data.projects[projectIndex];
  if (!projects) throw new NotFoundError(HTTP_TEXTS.PROJECT_NOT_FOUND);

  if (projects?.status == NEW_PROJECT_STATUS[5]) {
    const content_mapper_id = projects?.content_mapper;

    await ContentTypesMapperModelLowdb.read();
    await FieldMapperModel.read();
    if (!isEmpty(content_mapper_id)) {
      content_mapper_id.map((item: any) => {
        const contentMapperData = ContentTypesMapperModelLowdb.chain
          .get("ContentTypesMappers")
          .find({ id: item, projectId: projectId })
          .value();

        const fieldMappingIds = contentMapperData?.fieldMapping;

        //delete all fieldMapping which is related content Mapper and Project
        if (!isEmpty(fieldMappingIds)) {
          (fieldMappingIds || []).forEach((field: any) => {
            const fieldIndex = FieldMapperModel.chain
              .get("field_mapper")
              .findIndex({ id: field, projectId: projectId })
              .value();
            if (fieldIndex > -1) {
              FieldMapperModel.update((data: any) => {
                delete data.field_mapper[fieldIndex];
              });
            }
          });
        }
        //delete all content Mapper which is related to Project
        const contentMapperID = ContentTypesMapperModelLowdb.chain
          .get("ContentTypesMappers")
          .findIndex({ id: item, projectId: projectId })
          .value();
        ContentTypesMapperModelLowdb.update((Cdata: any) => {
          delete Cdata.ContentTypesMappers[contentMapperID];
        });
      });
    }
    //delete Project
    ProjectModelLowdb.update((Pdata: any) => {
      delete Pdata.projects[projectIndex];
    });
  } else {
    ProjectModelLowdb.update((data: any) => {
      data.projects[projectIndex].isDeleted = true;
    });
  }

  logger.info(
    getLogMessage(
      srcFunc,
      `Project [Id : ${projectId}] Deleted Successfully`,
      decodedToken
    )
  );
  return {
    status: HTTP_CODES.OK,
    data: {
      message: HTTP_TEXTS.PROJECT_DELETE,
    },
  };
};

/**
 * Reverts a project by setting its 'isDeleted' property to false.
 *
 * @param req - The request object containing the parameters and body.
 * @returns An object with the status and data of the reverted project.
 * @throws {NotFoundError} If the project is not found.
 */
const revertProject = async (req: Request) => {
  const { orgId, projectId } = req?.params ?? {};
  const decodedToken = req.body.token_payload;
  const { user_id = "", region = "" } = decodedToken;
  const srcFunc = "revertProject";

  await ProjectModelLowdb.read();
  const projectIndex = (await getProjectUtil(
    projectId,
    {
      id: projectId,
      org_id: orgId,
      region: region,
      owner: user_id,
    },
    srcFunc,
    true
  )) as number;

  const projects = ProjectModelLowdb.data.projects[projectIndex];
  if (!projects) {
    throw new NotFoundError(HTTP_TEXTS.PROJECT_NOT_FOUND);
  } else {
    ProjectModelLowdb.update((data: any) => {
      data.projects[projectIndex].isDeleted = false;
    });
    logger.info(
      getLogMessage(
        srcFunc,
        `Project [Id : ${projectId}] Reverted Successfully`,
        decodedToken
      )
    );
    return {
      status: HTTP_CODES.OK,
      data: {
        message: HTTP_TEXTS.PROJECT_REVERT,
        Project: projects
      },
    };
  }
};

/**
 * Updates the stack details for a project.
 *
 * @param req - The request object containing the parameters and body.
 * @returns An object with the status and data of the update operation.
 * @throws BadRequestError if the project status is invalid.
 * @throws ExceptionFunction if an error occurs during the update.
 */
const updateStackDetails = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const { token_payload, stack_details } = req.body;
  const srcFunc = "updateStackDetails";

  await ProjectModelLowdb.read();
  const projectIndex = (await getProjectUtil(
    projectId,
    {
      id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    srcFunc,
    true
  )) as number;

  try {
    ProjectModelLowdb.update((data: any) => {
      data.projects[projectIndex].stackDetails = stack_details;
      data.projects[projectIndex].updated_at = new Date().toISOString();
    });

    logger.info(
      getLogMessage(
        srcFunc,
        `Stack Details for project [Id : ${projectId}] has been successfully updated.`,
        token_payload
      )
    );
    return {
      status: HTTP_CODES.OK,
      data: {
        message: HTTP_TEXTS.STACK_UPDATED,
      },
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while updating stack details for project [Id : ${projectId}].`,
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

/**
 * Updates the content mapper details for a project.
 *
 * @param req - The request object containing the parameters and body.
 * @returns An object with the status and data of the update operation.
 * @throws BadRequestError if the project status is invalid.
 * @throws ExceptionFunction if an error occurs during the update.
 */
const updateContentMapper = async (req: Request) => {
  console.info("updateContentMapper", req.params, req.body);

  const { orgId, projectId } = req.params;
  const { token_payload, content_mapper } = req.body;
  const srcFunc = "updateContentMapper";


  await ProjectModelLowdb.read();
  const projectIndex = (await getProjectUtil(
    projectId,
    {
      id: projectId,
      org_id: orgId,
      region: token_payload?.region,
      owner: token_payload?.user_id,
    },
    srcFunc,
    true
  )) as number;

  try {
    ProjectModelLowdb.update((data: any) => {
      data.projects[projectIndex].mapperKeys = content_mapper;
      data.projects[projectIndex].updated_at = new Date().toISOString();
    });

    logger.info(
      getLogMessage(
        srcFunc,
        `Content mapping for project [Id : ${projectId}] has been successfully updated.`,
        token_payload
      )
    );
    return {
      status: HTTP_CODES.OK,
      data: {
        message: HTTP_TEXTS.CONTENT_MAPPER_UPDATED,
      },
    };
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `Error occurred while updating content mapping for project [Id : ${projectId}].`,
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

export const projectService = {
  getAllProjects,
  getProject,
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
  revertProject,
  updateStackDetails,
  updateContentMapper
};
