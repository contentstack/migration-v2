import { checkSchema } from "express-validator";
import { VALIDATION_ERRORS } from "../constants/index.js";

/**
 * Validates the affix_confirmation field in the request body.
 *
 * @returns {Object} The validation schema for the affix_confirmation field.
 */
export default checkSchema({
  affix_confirmation: {
    in: "body",
    isBoolean: {
      errorMessage: VALIDATION_ERRORS.BOOLEAN_REQUIRED.replace(
        "$",
        "affix_confirmation"
      ),
      bail: true,
    },
  },
});
