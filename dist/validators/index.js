"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const custom_errors_utils_1 = require("../utils/custom-errors.utils");
const async_router_utils_1 = require("../utils/async-router.utils");
const auth_validator_1 = __importDefault(require("./auth.validator"));
const project_validator_1 = __importDefault(require("./project.validator"));
const cms_validator_1 = __importDefault(require("./cms.validator"));
const file_format_validator_1 = __importDefault(require("./file-format.validator"));
const destination_stack_validator_1 = __importDefault(require("./destination-stack.validator"));
const initialize_upload_validator_1 = __importDefault(require("./initialize-upload.validator"));
const upload_validator_1 = __importDefault(require("./upload.validator"));
exports.default = (route = "") => (0, async_router_utils_1.asyncRouter)(async (req, res, next) => {
    const appValidators = {
        auth: auth_validator_1.default,
        project: project_validator_1.default,
        cms: cms_validator_1.default,
        file_format: file_format_validator_1.default,
        destination_stack: destination_stack_validator_1.default,
        initialize_upload: initialize_upload_validator_1.default,
        file_upload: upload_validator_1.default,
    };
    const validator = appValidators[route];
    const result = (await validator.run(req))
        .map((field) => field.array())
        .reduce((acc, val) => [...acc, ...val], []);
    if (result.length)
        throw new custom_errors_utils_1.ValidationError(result[0].msg);
    return next();
});
