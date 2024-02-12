import { checkSchema } from "express-validator";
import { VALIDATION_ERRORS } from "../constants";

export default checkSchema({
  file_name: {
    in: "body",
    isString: {
      errorMessage: VALIDATION_ERRORS.STRING_REQUIRED.replace("$", "file_name"),
      bail: true,
    },
    trim: true,
  },
});
