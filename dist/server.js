"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// file deepcode ignore UseCsurfForExpress: We've app_token for all the API calls, so we don't need CSRF token.
const config_1 = require("./config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const projects_routes_1 = __importDefault(require("./routes/projects.routes"));
const org_routes_1 = __importDefault(require("./routes/org.routes"));
const error_middleware_1 = require("./middlewares/error.middleware");
const logger_middleware_1 = __importDefault(require("./middlewares/logger.middleware"));
const database_1 = __importDefault(require("./database"));
const auth_middleware_1 = require("./middlewares/auth.middleware");
const req_headers_middleware_1 = require("./middlewares/req-headers.middleware");
const unmatched_routes_middleware_1 = require("./middlewares/unmatched-routes.middleware");
const logger_1 = __importDefault(require("./utils/logger"));
const contentMapper_routes_1 = __importDefault(require("./routes/contentMapper.routes"));
const migrationMidlleware_routes_1 = __importDefault(require("./routes/migrationMidlleware.routes"));
const uploadService_routes_1 = __importDefault(require("./routes/uploadService.routes"));
const auth_migration_middleware_1 = require("./middlewares/auth.migration.middleware");
const auth_uploadService_middleware_1 = require("./middlewares/auth.uploadService.middleware");
try {
    const app = (0, express_1.default)();
    app.use((0, helmet_1.default)({
        crossOriginOpenerPolicy: false,
    }));
    app.use((0, cors_1.default)({ origin: "*" }));
    app.use(express_1.default.urlencoded({ extended: false, limit: "10mb" }));
    app.use(express_1.default.json({ limit: "10mb" }));
    app.use(logger_middleware_1.default);
    app.use(req_headers_middleware_1.requestHeadersMiddleware);
    // Routes
    app.use("/v2/auth", auth_routes_1.default);
    app.use("/v2/user", auth_middleware_1.authenticateUser, user_routes_1.default);
    app.use("/v2/org/:orgId", auth_middleware_1.authenticateUser, org_routes_1.default);
    app.use("/v2/org/:orgId/project", auth_middleware_1.authenticateUser, projects_routes_1.default);
    app.use("/v2/mapper", auth_middleware_1.authenticateUser, contentMapper_routes_1.default);
    app.use("/v2/migrationMiddleware", auth_migration_middleware_1.authenticateMigrationService, migrationMidlleware_routes_1.default);
    app.use("/v2/uploadService", auth_uploadService_middleware_1.authenticateUploadService, uploadService_routes_1.default);
    //For unmatched route patterns
    app.use(unmatched_routes_middleware_1.unmatchedRoutesMiddleware);
    // Error Middleware
    app.use(error_middleware_1.errorMiddleware);
    // starting the server & DB connection.
    (async () => {
        await (0, database_1.default)();
        app.listen(config_1.config.PORT, () => logger_1.default.info(`Server listening at port ${config_1.config.PORT}`));
    })();
}
catch (e) {
    logger_1.default.error("Error while starting the server!");
    logger_1.default.error(e);
}
