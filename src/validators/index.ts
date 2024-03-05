import { Request, NextFunction, Response } from "express";
import { ValidationError } from "../utils/custom-errors.utils";
import { asyncRouter } from "../utils/async-router.utils";
import authValidator from "./auth.validator";
import projectValidator from "./project.validator";
import cmsValidator from "./cms.validator";
import fileFormatValidator from "./file-format.validator";
import destinationStackValidator from "./destination-stack.validator";
import affixValidator from "./affix.validator";
import affixConfirmationValidator from "./affix-confirmation.validator";
import fileformatConfirmationValidator from "./fileformat-confirmation.validator";

export default (route: string = "") =>
  asyncRouter(async (req: Request, res: Response, next: NextFunction) => {
    const appValidators = {
      auth: authValidator,
      project: projectValidator,
      cms: cmsValidator,
      file_format: fileFormatValidator,
      destination_stack: destinationStackValidator,
      affix: affixValidator,
      affix_confirmation_validator: affixConfirmationValidator,
      fileformat_confirmation_validator: fileformatConfirmationValidator,
    };

    const validator = appValidators[route as keyof typeof appValidators];

    const result = (await validator.run(req))
      .map((field) => field.array())
      .reduce((acc, val) => [...acc, ...val], []);

    if (result.length) throw new ValidationError(result[0].msg);

    return next();
  });
