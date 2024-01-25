import { Request, NextFunction, Response } from "express";
import { ValidationError } from "../utils/custom-errors.utils";
import { asyncRouter } from "../utils/async-router.utils";
import authValidator from "./auth.validator";
import projectValidator from "./project.validator";

export default (route: string = "") =>
  asyncRouter(async (req: Request, res: Response, next: NextFunction) => {
    const appValidators = {
      auth: authValidator,
      project: projectValidator,
    };

    const validator = appValidators[route as keyof typeof appValidators];

    const result = (await validator.run(req))
      .map((field) => field.array())
      .reduce((acc, val) => [...acc, ...val], []);

    if (result.length) throw new ValidationError(result[0].msg);

    return next();
  });
