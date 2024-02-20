import { checkSchema } from "express-validator";
import { VALIDATION_ERRORS, AFFIX_REGEX } from "../constants";

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
