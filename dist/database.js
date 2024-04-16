"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// database.ts
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("./config");
const logger_1 = __importDefault(require("./utils/logger"));
const project_1 = __importDefault(require("./models/project"));
const authentication_1 = __importDefault(require("./models/authentication"));
const auditLog_1 = __importDefault(require("./models/auditLog"));
const contentTypesMapper_1 = __importDefault(require("./models/contentTypesMapper"));
const FieldMapper_1 = __importDefault(require("./models/FieldMapper"));
const connectToDatabase = async () => {
    try {
        await mongoose_1.default.connect(config_1.config.MONGODB_URI, {
            ...(config_1.config.APP_ENV === "production" ? { autoIndex: false } : {}),
        });
        logger_1.default.info("Connected to MongoDB");
        // Create the collection's if it doesn't exist
        await project_1.default.init();
        await authentication_1.default.init();
        await auditLog_1.default.init();
        await contentTypesMapper_1.default.init();
        await FieldMapper_1.default.init();
    }
    catch (error) {
        logger_1.default.error("Error while connecting to MongoDB:", error);
        process.exit(1);
    }
};
exports.default = connectToDatabase;
