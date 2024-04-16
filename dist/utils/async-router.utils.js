"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncRouter = void 0;
const asyncRouter = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};
exports.asyncRouter = asyncRouter;
