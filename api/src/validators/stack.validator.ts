import { checkSchema } from "express-validator";
import { VALIDATION_ERRORS } from "../constants/index.js";

/**
 * Validates the stack data.
 *
 * @returns {Object} The validation schema for the stack data.
 */

export default checkSchema({
  name: {
    in: "body",
    isString: {
      errorMessage: VALIDATION_ERRORS.STRING_REQUIRED.replace("$", "Name"),
      bail: true,
    },
    trim: true,
    isLength: {
      errorMessage: VALIDATION_ERRORS.LENGTH_LIMIT.replace("$", "Name"),
      options: {
        min: 1,
        max: 255,
      },
      bail: true,
    },
  },
  description: {
    in: "body",
    isString: {
      errorMessage: VALIDATION_ERRORS.STRING_REQUIRED.replace(
        "$",
        "Description"
      ),
      bail: true,
    },
    trim: true,
    isLength: {
      errorMessage: VALIDATION_ERRORS.LENGTH_LIMIT.replace("$", "Description"),
      options: {
        min: 1,
        max: 512,
      },
      bail: true,
    },
  },
});