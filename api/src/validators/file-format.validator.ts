import { checkSchema } from "express-validator";
import { VALIDATION_ERRORS } from "../constants/index.js";

/**
 * Validates the file format.
 *
 * @returns {Object} The validation schema for the file format.
 */
export default checkSchema({
  file_format: {
    in: "body",
    isString: {
      errorMessage: VALIDATION_ERRORS.STRING_REQUIRED.replace(/\$/g, "file_format"),
      bail: true,
    },
    trim: true,
    isLength: {
      errorMessage: VALIDATION_ERRORS.LENGTH_LIMIT.replace(/\$/g, "file_format"),
      options: {
        min: 1,
        max: 200,
      },
      bail: true,
    },
  },
});
