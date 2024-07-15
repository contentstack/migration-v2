import { checkSchema } from "express-validator";
import { VALIDATION_ERRORS } from "../constants/index.js";

/**
 * Validates the affix_confirmation property in the request body.
 *
 * @returns {Object} The validation schema for affix_confirmation.
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
