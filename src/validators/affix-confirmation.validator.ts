import { checkSchema } from "express-validator";
import { VALIDATION_ERRORS } from "../constants/index.js";

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
