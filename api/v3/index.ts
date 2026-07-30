import express, { Request, Response } from "express";

import { authenticateV3User } from "./middlewares/auth.middleware.js";
import { v3ErrorMiddleware } from "./middlewares/error.middleware.js";
import sourceRoutes from "./routes/source.routes.js";
import projectSourceRoutes from "./routes/projectSource.routes.js";
import destinationRoutes from "./routes/destination.routes.js";
import projectDestinationRoutes from "./routes/projectDestination.routes.js";

/**
 * v3 API router — fully standalone. Composed here and mounted once at `/v3`
 * from `api/src/server.ts` (the single integration seam). It shares no code
 * with the v2 API; only the `app_token` JWT secret and the database are common.
 */
const v3 = express.Router({ mergeParams: true });

// Unauthenticated liveness check — confirms the v3 router is mounted.
v3.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", api: "v3" });
});

// Source panel (Content Map & Audit) — all endpoints require the app_token JWT.
v3.use("/source", authenticateV3User, sourceRoutes);
v3.use(
  "/org/:orgId/project/:projectId/source",
  authenticateV3User,
  projectSourceRoutes
);

// Destination panel (Content Map & Audit) — all endpoints require the app_token JWT.
v3.use("/destination", authenticateV3User, destinationRoutes);
v3.use(
  "/org/:orgId/project/:projectId/destination",
  authenticateV3User,
  projectDestinationRoutes
);

// v3-local error handler (mounted last).
v3.use(v3ErrorMiddleware);

export default v3;
