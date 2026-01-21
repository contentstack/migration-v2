import { checkSchema } from "express-validator";
import { VALIDATION_ERRORS } from "../constants/index.js";

/**
 * Validates the file path.
 *
 * @returns {Object} The validation schema for the file path.
 */
export default checkSchema({
  file_path: {
    in: "body",
    isString: {
      errorMessage: VALIDATION_ERRORS.STRING_REQUIRED.replace(/\$/g, "file_path"),
      bail: true,
    },
    trim: true,
    isLength: {
      errorMessage: VALIDATION_ERRORS.LENGTH_LIMIT.replace(/\$/g, "file_path"),
      options: {
        min: 1,
        max: 500,
      },
      bail: true,
    },
  },
});

