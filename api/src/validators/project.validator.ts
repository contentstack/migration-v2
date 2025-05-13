import { checkSchema } from "express-validator";
import { VALIDATION_ERRORS } from "../constants/index.js";

/**
 * Validates the project data.
 *
 * @returns {Object} The validation schema for the project data.
 */

export default checkSchema({
  name: {
    in: "body",
    isString: {
      errorMessage: VALIDATION_ERRORS.STRING_REQUIRED.replace(/\$/g, "Name"),
      bail: true,
    },
    trim: true,
    isLength: {
      errorMessage: VALIDATION_ERRORS.LENGTH_LIMIT.replace(/\$/g, "Name"),
      options: {
        min: 1,
        max: 200,
      },
      bail: true,
    },
  },
  description: {
    in: "body",
    isString: {
      errorMessage: VALIDATION_ERRORS.STRING_REQUIRED.replace(/\$/g, "Description"),
      bail: true,
    },
    trim: true,
    isLength: {
      errorMessage: VALIDATION_ERRORS.LENGTH_LIMIT.replace(/\$/g, "Description"),
      options: {
        min: 1,
        max: 255,
      },
      bail: true,
    },
  },
});
