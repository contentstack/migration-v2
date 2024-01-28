import { checkSchema } from "express-validator";
import { constants } from "../constants";

export default checkSchema({
  name: {
    in: "body",
    isString: {
      errorMessage: constants.VALIDATION_ERRORS.STRING_REQUIRED.replace(
        "$",
        "Name"
      ),
      bail: true,
    },
    trim: true,
    isLength: {
      errorMessage: constants.VALIDATION_ERRORS.LENGTH_LIMIT.replace(
        "$",
        "Name"
      ),
      options: {
        min: 1,
        max: 200,
      },
      bail: true,
    },
  },
  description: {
    in: "body",
    isString: {
      errorMessage: constants.VALIDATION_ERRORS.STRING_REQUIRED.replace(
        "$",
        "Description"
      ),
      bail: true,
    },
    trim: true,
    isLength: {
      errorMessage: constants.VALIDATION_ERRORS.LENGTH_LIMIT.replace(
        "$",
        "Description"
      ),
      options: {
        min: 1,
        max: 255,
      },
      bail: true,
    },
  },
});
