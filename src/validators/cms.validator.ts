import { checkSchema } from "express-validator";
import { constants } from "../constants";

export default checkSchema({
  legacy_cms: {
    in: "body",
    isString: {
      errorMessage: constants.VALIDATION_ERRORS.STRING_REQUIRED.replace(
        "$",
        "legacy_cms"
      ),
      bail: true,
    },
    trim: true,
    isLength: {
      errorMessage: constants.VALIDATION_ERRORS.LENGTH_LIMIT.replace(
        "$",
        "legacy_cms"
      ),
      options: {
        min: 1,
        max: 200,
      },
      bail: true,
    },
  },
});
