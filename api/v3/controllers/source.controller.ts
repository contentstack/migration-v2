import { Request, Response } from "express";

import { HTTP_CODES } from "../constants/http.js";

/**
 * v3 Source controller — SKELETON.
 *
 * Every handler is a stub returning 501 Not Implemented so the routes stand up
 * and are auth-guarded, without any business logic yet. These are filled in by
 * later tasks (TRD T-2…T-5): CS Management client, upload/validate, async
 * export job, graph build, and persistence.
 */
const notImplemented =
  (endpoint: string) => (_req: Request, res: Response) =>
    res.status(HTTP_CODES.NOT_IMPLEMENTED).json({
      status: HTTP_CODES.NOT_IMPLEMENTED,
      message: `Not implemented yet: ${endpoint}`,
    });

export const sourceController = {
  // Listing endpoints (API-4 / FR-5.3)
  listRegions: notImplemented("GET /v3/source/regions"),
  listOrgs: notImplemented("GET /v3/source/orgs"),
  listStacks: notImplemented("GET /v3/source/stacks"),
  listBranches: notImplemented("GET /v3/source/branches"),

  // Modules with counts (API-5 / FR-5.4)
  listModules: notImplemented("GET /v3/source/modules"),

  // Async export/extract (API-1, API-2 / FR-5.5)
  startExport: notImplemented("POST /v3/source/export"),
  getExportStatus: notImplemented("GET /v3/source/export/:jobId"),

  // File upload + validate (API-3 / FR-3.3, FR-3.8, FR-3.9)
  uploadBundle: notImplemented("POST /v3/source/upload"),

  // Content graph (API-6 / FR-5.6)
  getGraph: notImplemented("GET /v3/source/:projectId/graph"),

  // Persist / read source selection (API-7 / FR-5.2)
  persistSource: notImplemented("PUT /v3/org/:orgId/project/:projectId/source"),
  getSource: notImplemented("GET /v3/org/:orgId/project/:projectId/source"),
};
