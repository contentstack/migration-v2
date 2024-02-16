import ProjectModel from "../models/project";
import { BadRequestError, NotFoundError } from "../utils/custom-errors.utils";
import { HTTP_TEXTS } from "../constants";
import { MigrationQueryType } from "../models/types";
import { isValidObjectId, getLogMessage } from "../utils";
import logger from "../utils/logger";

export default async (
  projectId: string,
  query: MigrationQueryType,
  projections: string = ""
) => {
  if (!isValidObjectId(projectId))
    throw new BadRequestError(HTTP_TEXTS.INVALID_ID.replace("$", "project"));

  try {
    const project = await ProjectModel.findOne(query).select(projections);

    if (!project) throw new NotFoundError(HTTP_TEXTS.NO_PROJECT);

    return project;
  } catch (err) {
    logger.error(
      getLogMessage(
        "get-project.utils",
        `${HTTP_TEXTS.PROJECT_NOT_FOUND} projectId: ${projectId}`,
        query
      )
    );
    throw err;
  }
};
