import { checkSchema } from "express-validator";
import { VALIDATION_ERRORS } from "../constants/index.js";

export default checkSchema({
  legacy_cms: {
    in: "body",
    isString: {
      errorMessage: VALIDATION_ERRORS.STRING_REQUIRED.replace(
        "$",
        "legacy_cms"
      ),
      bail: true,
    },
    trim: true,
    isLength: {
      errorMessage: VALIDATION_ERRORS.LENGTH_LIMIT.replace("$", "legacy_cms"),
      options: {
        min: 1,
        max: 200,
      },
      bail: true,
    },
  },
});
