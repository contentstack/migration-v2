import { checkSchema } from "express-validator";
import { constants } from "../constants";

export default checkSchema({
  email: {
    in: "body",
    isString: {
      errorMessage: constants.VALIDATION_ERRORS.STRING_REQUIRED.replace(
        "$",
        "Email"
      ),
      bail: true,
    },
    isEmail: {
      errorMessage: constants.VALIDATION_ERRORS.INVALID_EMAIL,
      bail: true,
    },
    trim: true,
    isLength: {
      errorMessage: constants.VALIDATION_ERRORS.EMAIL_LIMIT,
      options: {
        min: 3,
        max: 350,
      },
      bail: true,
    },
  },
  password: {
    in: "body",
    isString: {
      errorMessage: constants.VALIDATION_ERRORS.STRING_REQUIRED.replace(
        "$",
        "Password"
      ),
      bail: true,
    },
    trim: true,
  },
  region: {
    in: "body",
    isString: {
      errorMessage: constants.VALIDATION_ERRORS.STRING_REQUIRED.replace(
        "$",
        "Region"
      ),
      bail: true,
    },
    trim: true,
    isIn: {
      options: [constants.CS_REGIONS],
      errorMessage: constants.VALIDATION_ERRORS.INVALID_REGION,
      bail: true,
    },
  },
  tfa_token: {
    optional: true,
    in: "body",
    isString: {
      errorMessage: constants.VALIDATION_ERRORS.STRING_REQUIRED.replace(
        "$",
        "2FA Token"
      ),
      bail: true,
    },
    trim: true,
  },
});
