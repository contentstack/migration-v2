/* eslint-disable operator-linebreak */
import { Request } from "express";
import { constants } from "../constants";
import ProjectModel from "../models/project";
import { isValidObjectId, getMongooseID } from "../utils";
import { NotFoundError, BadRequestError } from "../utils/custom-errors.utils";
import { MigrationQueryType } from "../models/types";

const _getProject = async (projectId: string, query: MigrationQueryType) => {
  if (!isValidObjectId(projectId))
    throw new BadRequestError(
      constants.HTTP_TEXTS.INVALID_ID.replace("$", "project")
    );

  const project = await ProjectModel.findOne(query);

  if (!project) throw new NotFoundError(constants.HTTP_TEXTS.NO_PROJECT);

  return project;
};

const _getCondensedMigration = (projectId: string, data: any) => {
  return {
    id: data._id,
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

  const project = await _getProject(projectId, {
    _id: projectId,
    org_id: orgId,
    region: req?.body?.token_payload?.region,
    owner: req?.body?.token_payload?.user_id,
  });

  return {
    status: constants.HTTP_CODES.OK,
    data: {
      migration: [
        project.migration?.[0]?._id
          ? _getCondensedMigration(projectId, project.migration[0])
          : {},
      ],
    },
  };
};

const createMigration = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;

  const project = await _getProject(projectId, {
    _id: projectId,
    org_id: orgId,
    region: req?.body?.token_payload?.region,
    owner: req?.body?.token_payload?.user_id,
  });

  if (project.migration?.length)
    throw new BadRequestError(constants.HTTP_TEXTS.MIGRATION_EXISTS);

  project.migration.push({
    _id: getMongooseID(),
    created_at: new Date(),
    updated_at: new Date(),
    ...req?.body,
  });

  const updatedProject = await project.save();

  return {
    status: constants.HTTP_CODES.OK,
    data: {
      message: constants.HTTP_TEXTS.MIGRATION_CREATED,
      migration: [
        _getCondensedMigration(projectId, updatedProject.migration[0]),
      ],
    },
  };
};

const updateMigration = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const migrationId = req?.params?.migrationId;

  if (!isValidObjectId(migrationId))
    throw new BadRequestError(
      constants.HTTP_TEXTS.INVALID_ID.replace("$", "migration")
    );

  const project = await _getProject(projectId, {
    _id: projectId,
    "migration._id": migrationId,
    org_id: orgId,
    region: req?.body?.token_payload?.region,
    owner: req?.body?.token_payload?.user_id,
  });

  project.migration[0].name = req?.body?.name;
  project.migration[0].description = req?.body?.description;
  project.migration[0].updated_at = new Date();

  const updatedProject = await project.save();

  return {
    status: constants.HTTP_CODES.OK,
    data: {
      message: constants.HTTP_TEXTS.MIGRATION_UPDATED,
      migration: [
        _getCondensedMigration(projectId, updatedProject.migration[0]),
      ],
    },
  };
};

const deleteMigration = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const migrationId = req?.params?.migrationId;

  if (!isValidObjectId(migrationId))
    throw new BadRequestError(
      constants.HTTP_TEXTS.INVALID_ID.replace("$", "migration")
    );

  const filter = {
    _id: projectId,
    "migration._id": migrationId,
    org_id: orgId,
    region: req?.body?.token_payload?.region,
    owner: req?.body?.token_payload?.user_id,
  };

  const project = await _getProject(projectId, filter);

  project.migration.shift();
  await project.save();

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
};
