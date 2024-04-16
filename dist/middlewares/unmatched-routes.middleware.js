"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.unmatchedRoutesMiddleware = void 0;
const constants_1 = require("../constants");
const unmatchedRoutesMiddleware = (req, res) => {
    const status = constants_1.HTTP_CODES.NOT_FOUND;
    res.status(status).json({
        error: { code: status, message: constants_1.HTTP_TEXTS.ROUTE_ERROR },
    });
};
exports.unmatchedRoutesMiddleware = unmatchedRoutesMiddleware;
