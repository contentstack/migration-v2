import { checkSchema } from "express-validator";
import { VALIDATION_ERRORS } from "../constants/index.js";

/**
 * Validates the 'stack_api_key' property in the request body.
 *
 * @returns {Object} The validation schema for the 'stack_api_key' property.
 */
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
