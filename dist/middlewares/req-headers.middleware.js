"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestHeadersMiddleware = void 0;
const requestHeadersMiddleware = (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, app_token");
    if (req.method === "OPTIONS") {
        res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
        return res.status(200).json({});
    }
    next();
};
exports.requestHeadersMiddleware = requestHeadersMiddleware;
