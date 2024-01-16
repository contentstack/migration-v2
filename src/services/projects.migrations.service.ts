import { Request } from "express";

const getMigration = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;

  //Add logic to get Project from DB
  return { orgId, projectId };
};
const createMigration = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;

  //Add logic to create Project from DB
  return { orgId, projectId };
};

const updateMigration = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const migrationId = req?.params?.migrationId;

  //Add logic to update Project from DB
  return { orgId, projectId, migrationId };
};

const deleteMigration = async (req: Request) => {
  const orgId = req?.params?.orgId;
  const projectId = req?.params?.projectId;
  const migrationId = req?.params?.migrationId;

  //Add logic to delete Project from DB
  return { orgId, projectId, migrationId };
};

export const migrationService = {
  getMigration,
  createMigration,
  updateMigration,
  deleteMigration,
};
