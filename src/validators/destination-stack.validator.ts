import { checkSchema } from "express-validator";
import { VALIDATION_ERRORS } from "../constants";

export default checkSchema({
  stack_api_key: {
    in: "body",
    isString: {
      errorMessage: VALIDATION_ERRORS.STRING_REQUIRED.replace(
        "$",
        "stack_api_key"
      ),
      bail: true,
    },
    trim: true,
    isLength: {
      errorMessage: VALIDATION_ERRORS.LENGTH_LIMIT.replace(
        "$",
        "stack_api_key"
      ),
      options: {
        min: 1,
        max: 100,
      },
      bail: true,
    },
  },
});
