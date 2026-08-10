import express, { Request, Response } from "express";

import { authenticateV3User } from "./middlewares/auth.middleware.js";
import { v3ErrorMiddleware } from "./middlewares/error.middleware.js";
import sourceRoutes from "./routes/source.routes.js";
import projectSourceRoutes from "./routes/projectSource.routes.js";
import destinationRoutes from "./routes/destination.routes.js";
import projectDestinationRoutes from "./routes/projectDestination.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import contentMappingRoutes from "./routes/contentMapping.routes.js";
import projectRoutes from "./routes/project.routes.js";
import userRoutes from "./routes/user.routes.js";

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
v3.use("/project/:projectId/source", authenticateV3User, projectSourceRoutes);

// Audit step — reads the project's export folder; no Contentstack calls.
v3.use("/project/:projectId/audit", authenticateV3User, auditRoutes);

// Content mapping — cs-content-type-selection API-1 / API-2
v3.use(
  "/project/:projectId/content-mapping",
  authenticateV3User,
  contentMappingRoutes
);

// Destination panel (Content Map & Audit) — all endpoints require the app_token JWT.
v3.use("/destination", authenticateV3User, destinationRoutes);
v3.use(
  "/project/:projectId/destination",
  authenticateV3User,
  projectDestinationRoutes
);

/*
  Project list + create (cs-project-dashboard). Mounted AFTER the two
  `/project/:projectId/*` routers above, which is required rather than incidental:
  this router's own paths are `/` under `/project`, and keeping the more specific
  `:projectId` prefixes first avoids depending on Express's prefix-matching order.

  No `/org/:orgId` segment: a project is not organization-specific, so nothing
  identifies it but its id (cs-project-dashboard FR-9.13).
*/
v3.use("/project", authenticateV3User, projectRoutes);

// The authenticated user's display identity, for the projects page avatar (API-3).
v3.use("/user", authenticateV3User, userRoutes);

// v3-local error handler (mounted last).
v3.use(v3ErrorMiddleware);

export default v3;
