import { checkSchema } from "express-validator";
import { VALIDATION_ERRORS, AFFIX_REGEX } from "../constants/index.js";

/**
 * Validates the 'affix' property in the request body.
 *
 * @returns {Object} The validation schema for the 'affix' property.
 */
export default checkSchema({
  affix: {
    in: "body",
    isString: {
      errorMessage: VALIDATION_ERRORS.STRING_REQUIRED.replace("$", "affix"),
      bail: true,
    },
    trim: true,
    matches: {
      options: AFFIX_REGEX,
      errorMessage: VALIDATION_ERRORS.INVALID_AFFIX,
      bail: true,
    },
  },
});
