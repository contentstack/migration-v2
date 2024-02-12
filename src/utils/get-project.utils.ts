import ProjectModel from "../models/project";
import {
  BadRequestError,
  NotFoundError,
  DatabaseError,
} from "../utils/custom-errors.utils";
import { HTTP_TEXTS } from "../constants";
import { MigrationQueryType } from "../models/types";
import { isValidObjectId } from "../utils";

export default async (
  projectId: string,
  query: MigrationQueryType,
  projections: string = ""
) => {
  try {
    if (!isValidObjectId(projectId))
      throw new BadRequestError(HTTP_TEXTS.INVALID_ID.replace("$", "project"));

    const project = await ProjectModel.findOne(query).select(projections);

    if (!project) throw new NotFoundError(HTTP_TEXTS.NO_PROJECT);

    return project;
  } catch (err) {
    throw new DatabaseError(HTTP_TEXTS.SOMETHING_WENT_WRONG);
  }
};
