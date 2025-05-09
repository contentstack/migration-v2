/* eslint-disable operator-linebreak */
import ProjectModel from "../models/project-lowdb.js";
import {
  BadRequestError,
  ExceptionFunction,
} from "../utils/custom-errors.utils.js";
import { HTTP_CODES, HTTP_TEXTS } from "../constants/index.js";
import { MigrationQueryType } from "../models/types.js";
import { getLogMessage } from "../utils/index.js";
import logger from "./logger.js";
import { validate } from "uuid";

/**
 * Retrieves a project based on the provided project ID and query.
 * @param projectId - The ID of the project to retrieve.
 * @param query - The query to filter the projects.
 * @param srcFunc - The source function name (optional).
 * @param isIndex - Indicates whether to find the project by index (optional, default: false).
 * @returns The retrieved project.
 * @throws BadRequestError if the project ID is invalid or the project is not found.
 * @throws ExceptionFunction if an error occurs during the retrieval process.
 */
export default async (
  projectId: string,
  query: MigrationQueryType,
  srcFunc: string = "",
  isIndex: boolean = false
) => {
  if (!validate(projectId)) {
    logger.error(
      getLogMessage(srcFunc, HTTP_TEXTS.INVALID_ID.replace("$", "project"))
    );
    throw new BadRequestError(HTTP_TEXTS.INVALID_ID.replace("$", "project"));
  }
  try {
    await ProjectModel.read();
    const project = isIndex
      ? ProjectModel.chain.get("projects").findIndex(query).value()
      : ProjectModel.chain.get("projects").find(query).value();

    if (isIndex && typeof project === "number" ? project < 0 : !project) {
      logger.error(
        getLogMessage(
          srcFunc,
          `${HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`
        )
      );
      throw new BadRequestError(HTTP_TEXTS.PROJECT_NOT_FOUND);
    }
    return project;
  } catch (error: any) {
    logger.error(
      getLogMessage(
        srcFunc,
        `${HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`,
        query
      )
    );
    throw new ExceptionFunction(
      error?.message || HTTP_TEXTS.INTERNAL_ERROR,
      error?.statusCode || error?.status || HTTP_CODES.SERVER_ERROR
    );
  }
};
