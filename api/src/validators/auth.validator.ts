import { checkSchema } from "express-validator";
import { VALIDATION_ERRORS, CS_REGIONS } from "../constants/index.js";

/**
 * Validates the authentication request body.
 *
 * @returns {Object} The validation schema for the authentication request body.
 */
export default checkSchema({
  email: {
    in: "body",
    isString: {
      errorMessage: VALIDATION_ERRORS.STRING_REQUIRED.replace(/\$/g, "Email"),
      bail: true,
    },
    isEmail: {
      errorMessage: VALIDATION_ERRORS.INVALID_EMAIL,
      bail: true,
    },
    trim: true,
    isLength: {
      errorMessage: VALIDATION_ERRORS.EMAIL_LIMIT,
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
      errorMessage: VALIDATION_ERRORS.STRING_REQUIRED.replace(/\$/g, "Password"),
      bail: true,
    },
    trim: true,
  },
  region: {
    in: "body",
    isString: {
      errorMessage: VALIDATION_ERRORS.STRING_REQUIRED.replace(/\$/g, "Region"),
      bail: true,
    },
    trim: true,
    isIn: {
      options: [CS_REGIONS],
      errorMessage: VALIDATION_ERRORS.INVALID_REGION,
      bail: true,
    },
  },
  tfa_token: {
    optional: true,
    in: "body",
    isString: {
      errorMessage: VALIDATION_ERRORS.STRING_REQUIRED.replace(/\$/g, "2FA Token"),
      bail: true,
    },
    trim: false,
  },
});
