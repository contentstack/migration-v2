"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const prod_config_1 = require("./prod.config");
dotenv_1.default.config({
    path: path_1.default.resolve(process.cwd(), `${process.env.NODE_ENV}.env`),
});
exports.config = {
    APP_TOKEN_EXP: "1d",
    PORT: process.env.PORT,
    APP_ENV: process.env.NODE_ENV,
    APP_TOKEN_KEY: process.env.APP_TOKEN_KEY,
    FILE_UPLOAD_KEY: process.env.FILE_UPLOAD_KEY,
    MIGRATION_KEY: process.env.MIGRATION_KEY,
    MONGODB_URI: process.env.MONGODB_URI,
    AWS_REGION: process.env.AWS_REGION,
    UPLOAD_BUCKET: process.env.UPLOAD_BUCKET,
    UPLOAD_URL_EXPIRES: 60 * 30,
    ...(process.env.NODE_ENV === "production" ? prod_config_1.prodConfig : prod_config_1.prodConfig),
};
