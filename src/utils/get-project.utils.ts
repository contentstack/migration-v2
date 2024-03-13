import ProjectModel from "../models/project.js";
import {
  BadRequestError,
  ExceptionFunction,
} from "../utils/custom-errors.utils.js";
import { HTTP_CODES, HTTP_TEXTS } from "../constants/index.js";
import { MigrationQueryType } from "../models/types.js";
import { getLogMessage, isValidObjectId } from "../utils/index.js";
import logger from "./logger.js";

export default async (
  projectId: string,
  query: MigrationQueryType,
  projections: string = "",
  srcFunc: string = ""
) => {
  if (!isValidObjectId(projectId)) {
    logger.error(
      getLogMessage(srcFunc, HTTP_TEXTS.INVALID_ID.replace("$", "project"))
    );
    throw new BadRequestError(HTTP_TEXTS.INVALID_ID.replace("$", "project"));
  }
  try {
    const project = await ProjectModel.findOne(query).select(projections);

    if (!project) {
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
