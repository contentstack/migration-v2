import { checkSchema } from "express-validator";
import { VALIDATION_ERRORS } from "../constants";

export default checkSchema({
  file_key: {
    in: "body",
    isString: {
      errorMessage: VALIDATION_ERRORS.STRING_REQUIRED.replace("$", "file_key"),
      bail: true,
    },
    trim: true,
  },
  file_id: {
    in: "body",
    isString: {
      errorMessage: VALIDATION_ERRORS.STRING_REQUIRED.replace("$", "file_id"),
      bail: true,
    },
    trim: true,
  },
  parts: {
    in: "body",
    exists: {
      errorMessage: VALIDATION_ERRORS.FIELD_REQUIRED.replace("$", "parts"),
      bail: true,
    },
  },
});
