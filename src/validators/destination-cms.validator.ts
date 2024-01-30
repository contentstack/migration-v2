import { checkSchema } from "express-validator";
import { constants } from "../constants";

export default checkSchema({
  stack_api_key: {
    in: "body",
    isString: {
      errorMessage: constants.VALIDATION_ERRORS.STRING_REQUIRED.replace(
        "$",
        "stack_api_key"
      ),
      bail: true,
    },
    trim: true,
    isLength: {
      errorMessage: constants.VALIDATION_ERRORS.LENGTH_LIMIT.replace(
        "$",
        "stack_api_key"
      ),
      options: {
        min: 1,
        max: 400,
      },
      bail: true,
    },
  },
});
