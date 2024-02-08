import { checkSchema } from "express-validator";
import { VALIDATION_ERRORS } from "../constants";

export default checkSchema({
  file_format: {
    in: "body",
    isString: {
      errorMessage: VALIDATION_ERRORS.STRING_REQUIRED.replace(
        "$",
        "file_format"
      ),
      bail: true,
    },
    trim: true,
    isLength: {
      errorMessage: VALIDATION_ERRORS.LENGTH_LIMIT.replace("$", "file_format"),
      options: {
        min: 1,
        max: 200,
      },
      bail: true,
    },
  },
});
