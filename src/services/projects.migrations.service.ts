/* eslint-disable operator-linebreak */
import { Request } from "express";
import { constants } from "../constants";
import ProjectModel from "../models/project";
import { isValidObjectId } from "../utils";
import { NotFoundError, BadRequestError } from "../utils/custom-errors.utils";
import { MigrationQueryType } from "../models/types";
import { safePromise } from "../utils/index";
import { config } from "../config";
import getAuthtoken from "../utils/auth.utils";
import https from "../utils/https.utils";

const _getProject = async (projectId: string, query: MigrationQueryType) => {
  if (!isValidObjectId(projectId))
    throw new BadRequestError(
      constants.HTTP_TEXTS.INVALID_ID.replace("$", "project"),
      "_getProject"
    );

  const project = await ProjectModel.findOne(query);

  if (!project)
    throw new NotFoundError(constants.HTTP_TEXTS.NO_PROJECT, "_getProject");

  return project;
};

const _getCondensedMigration = (projectId: string, data: any) => {
  return {
    name: data.name,
    description: data.description,
    created_at: data.created_at,
    updated_at: data.updated_at,
    project_id: projectId,
    org_id: data.org_id,
  };
};

const getMigration = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const { token_payload } = req.body;

  const project = await _getProject(projectId, {
    _id: projectId,
    org_id: orgId,
    region: token_payload?.region,
    owner: token_payload?.user_id,
  });

  return {
    status: constants.HTTP_CODES.OK,
    data: {
      migration: project?.migration?.name
        ? _getCondensedMigration(projectId, project.migration)
        : {},
    },
  };
};

const createMigration = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const { token_payload } = req.body;

  const project = await _getProject(projectId, {
    _id: projectId,
    org_id: orgId,
    region: token_payload?.region,
    owner: token_payload?.user_id,
  });

  if (project.migration?.name)
    throw new BadRequestError(
      constants.HTTP_TEXTS.MIGRATION_EXISTS,
      "createMigration"
    );

  project.migration = {
    created_at: new Date(),
    updated_at: new Date(),
    ...req?.body,
    modules: {
      legacy_cms: {
        cms: "",
        file_format: "",
        import_data: "",
      },
      destination_cms: {
        stack_id: "",
        org_id: "",
      },
    },
  };

  const updatedProject = await project.save();

  return {
    status: constants.HTTP_CODES.OK,
    data: {
      message: constants.HTTP_TEXTS.MIGRATION_CREATED,
      migration: _getCondensedMigration(projectId, updatedProject.migration),
    },
  };
};

const updateMigration = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const { token_payload, name, description } = req.body;

  const project = await _getProject(projectId, {
    _id: projectId,
    org_id: orgId,
    region: token_payload?.region,
    owner: token_payload?.user_id,
  });

  project.migration.name = name;
  project.migration.description = description;
  project.migration.updated_at = new Date();

  const updatedProject = await project.save();

  return {
    status: constants.HTTP_CODES.OK,
    data: {
      message: constants.HTTP_TEXTS.MIGRATION_UPDATED,
      migration: _getCondensedMigration(projectId, updatedProject.migration),
    },
  };
};

const updateMigrationLegacyCMS = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const { token_payload, legacy_cms } = req.body;

  const project = await _getProject(projectId, {
    _id: projectId,
    org_id: orgId,
    region: token_payload?.region,
    owner: token_payload?.user_id,
  });

  project.migration.modules.legacy_cms.cms = legacy_cms;

  await project.save();

  return {
    status: constants.HTTP_CODES.OK,
    data: {
      message: constants.HTTP_TEXTS.CMS_UPDATED,
    },
  };
};

const updateMigrationFileFormat = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const { token_payload, file_format } = req.body;

  const project = await _getProject(projectId, {
    _id: projectId,
    org_id: orgId,
    region: token_payload?.region,
    owner: token_payload?.user_id,
  });

  project.migration.modules.legacy_cms.file_format = file_format;

  await project.save();

  return {
    status: constants.HTTP_CODES.OK,
    data: {
      message: constants.HTTP_TEXTS.FILE_FORMAT_UPDATED,
    },
  };
};

const updateMigrationDestinationStack = async (req: Request) => {
  const { orgId, projectId } = req.params;
  const { token_payload, stack_api_key } = req.body;

  const project = await _getProject(projectId, {
    _id: projectId,
    org_id: orgId,
    region: token_payload?.region,
    owner: token_payload?.user_id,
  });

  const authtoken = await getAuthtoken(
    token_payload?.region,
    token_payload?.user_id
  );

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
        message: constants.HTTP_TEXTS.DESTINATION_STACK_ERROR,
      },
      status: err.response.status,
    };

  if (!res.data.stacks.find((stack: any) => stack.api_key === stack_api_key))
    throw new BadRequestError(
      constants.HTTP_TEXTS.DESTINATION_STACK_NOT_FOUND,
      "updateMigrationDestinationStack"
    );

  project.migration.modules.destination_cms.stack_id = stack_api_key;
  project.migration.modules.destination_cms.org_id = orgId;

  await project.save();

  return {
    status: constants.HTTP_CODES.OK,
    data: {
      message: constants.HTTP_TEXTS.DESTINATION_STACK_UPDATED,
    },
  };
};

const deleteMigration = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const { token_payload } = req.body;

  const filter = {
    _id: projectId,
    org_id: orgId,
    region: token_payload?.region,
    owner: token_payload?.user_id,
  };

  await _getProject(projectId, filter);

  await ProjectModel.updateOne(
    { _id: projectId },
    { $set: { migration: null } }
  );

  return {
    status: constants.HTTP_CODES.OK,
    data: {
      status: constants.HTTP_CODES.OK,
      message: constants.HTTP_TEXTS.MIGRATION_DELETED,
    },
  };
};

export const migrationService = {
  getMigration,
  createMigration,
  updateMigration,
  deleteMigration,
  updateMigrationLegacyCMS,
  updateMigrationFileFormat,
  updateMigrationDestinationStack,
};
