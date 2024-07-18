import { Request, NextFunction, Response } from "express";
import { ValidationError } from "../utils/custom-errors.utils.js";
import { asyncRouter } from "../utils/async-router.utils.js";
import authValidator from "./auth.validator.js";
import projectValidator from "./project.validator.js";
import cmsValidator from "./cms.validator.js";
import fileFormatValidator from "./file-format.validator.js";
import destinationStackValidator from "./destination-stack.validator.js";
import affixValidator from "./affix.validator.js";
import affixConfirmationValidator from "./affix-confirmation.validator.js";
import fileformatConfirmationValidator from "./fileformat-confirmation.validator.js";

/**
 * Middleware function that validates the request based on the specified route.
 * @param route - The route to determine the validator to use.
 * @returns The middleware function that performs the validation.
 */
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
