import { checkSchema } from "express-validator";
import { VALIDATION_ERRORS } from "../constants/index.js";

/**
 * Validates the file format confirmation field in the request body.
 *
 * @returns {Object} The validation schema for the file format confirmation field.
 */
export default checkSchema({
  fileformat_confirmation: {
    in: "body",
    isBoolean: {
      errorMessage: VALIDATION_ERRORS.BOOLEAN_REQUIRED.replace(
        "$",
        "fileformat_confirmation"
      ),
      bail: true,
    },
  },
});
