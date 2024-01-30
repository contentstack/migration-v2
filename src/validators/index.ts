import { Request, NextFunction, Response } from "express";
import { ValidationError } from "../utils/custom-errors.utils";
import { asyncRouter } from "../utils/async-router.utils";
import authValidator from "./auth.validator";
import projectValidator from "./project.validator";
import cmsValidator from "./cms.validator";
import fileFormatValidator from "./file-format.validator";
import destinationCmsValidator from "./destination-cms.validator";

export default (route: string = "") =>
  asyncRouter(async (req: Request, res: Response, next: NextFunction) => {
    const appValidators = {
      auth: authValidator,
      project: projectValidator,
      cms: cmsValidator,
      file_format: fileFormatValidator,
      destination_cms: destinationCmsValidator,
    };

    const validator = appValidators[route as keyof typeof appValidators];

    const result = (await validator.run(req))
      .map((field) => field.array())
      .reduce((acc, val) => [...acc, ...val], []);

    if (result.length) throw new ValidationError(result[0].msg, "validation");

    return next();
  });
