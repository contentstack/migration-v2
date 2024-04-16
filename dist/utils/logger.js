"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = require("winston");
//Logger for custom logs
const logger = (0, winston_1.createLogger)({
    level: "info",
    format: winston_1.format.combine(winston_1.format.timestamp(), winston_1.format.json()),
    transports: [
        // - Write all logs with importance level of `error` or less to `error.log`
        new winston_1.transports.File({ filename: "error.log", level: "error" }),
        // - Write all logs with importance level of `info` or less to `combined.log`
        new winston_1.transports.File({ filename: "combine.log" }),
        new winston_1.transports.Console({
            format: winston_1.format.combine(winston_1.format.timestamp(), winston_1.format.prettyPrint()),
        }),
    ],
});
exports.default = logger;
