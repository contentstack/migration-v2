import { Request, Response } from "express";

import { HTTP_CODES } from "../constants/http.js";
import { getV3Project, upsertV3Destination } from "../models/project.store.js";
import { V3Destination, V3ImportAuthMethod } from "../models/types.js";
import { csManagement, TokenPayload } from "../services/csManagement.service.js";
import { resolveRegionCredential } from "../utils/region-credential.util.js";

/**
 * v3 Destination controller (Content Map & Audit — Destination panel).
 * Thin handlers over the unit-tested v3 services. Errors thrown by services
 * carry a `.status` and are mapped by the v3 error middleware via asyncRouter.
 *
 * Region/organization/existing-stack LISTING is deliberately absent here: the
 * Destination panel reuses `cs-source-selection`'s `/v3/source/{regions,orgs,
 * stacks,branches}` endpoints (trd.md TC-1 / TR-2) rather than duplicating them.
 */
const VALID_METHODS: V3ImportAuthMethod[] = ["management", "authToken"];

const badRequest = (res: Response, message: string) =>
  res.status(HTTP_CODES.BAD_REQUEST).json({
    error: { code: HTTP_CODES.BAD_REQUEST, message },
  });

/**
 * Resolves the Contentstack credential for a destination call. A destination
 * region other than the session's home region requires a completed
 * region-login, whose resolved userId the client passes back as `regionUserId`.
 */
const credentialFor = (
  req: Request,
  region?: string,
  regionUserId?: string
): TokenPayload =>
  resolveRegionCredential(req.body?.token_payload, region, regionUserId);

// ---- API-4: create a new destination stack (FR-1.4, FR-1.5, TR-11) ----
const createStack = async (req: Request, res: Response) => {
  const { orgId, name, description, masterLocale, region, regionUserId } = (req.body ??
    {}) as Record<string, any>;
  if (!orgId) return badRequest(res, "'orgId' is required.");
  if (!name || !String(name).trim()) return badRequest(res, "'name' is required.");

  const stack = await csManagement.createStack(
    credentialFor(req, region, regionUserId),
    orgId,
    String(name).trim(),
    description ? String(description).trim() : undefined,
    masterLocale ? String(masterLocale).trim() : undefined
  );
  return res.status(HTTP_CODES.CREATED).json(stack);
};

/**
 * Every locale Contentstack supports — feeds the create-stack master-locale
 * picker. Not stack-scoped: the stack being named doesn't exist yet.
 */
const listContentstackLocales = async (req: Request, res: Response) => {
  const locales = await csManagement.listContentstackLocales(
    credentialFor(
      req,
      req.query.region as string | undefined,
      req.query.regionUserId as string | undefined
    )
  );
  return res.status(HTTP_CODES.OK).json({ locales });
};

// ---- API-3: create a read/write management token (FR-3.3, TR-13) ----
const createManagementToken = async (req: Request, res: Response) => {
  const { stackApiKey, name, region, regionUserId } = (req.body ?? {}) as Record<
    string,
    any
  >;
  if (!stackApiKey) return badRequest(res, "'stackApiKey' is required.");
  if (!name || !String(name).trim()) return badRequest(res, "'name' is required.");

  const token = await csManagement.createManagementToken(
    credentialFor(req, region, regionUserId),
    stackApiKey,
    String(name).trim()
  );
  return res.status(HTTP_CODES.CREATED).json(token);
};

// ---- API-5: destination stack content statistics (FR-10.2–10.4, TR-14) ----
const getStackStats = async (req: Request, res: Response) => {
  const { apiKey } = req.params as { apiKey: string };
  const stats = await csManagement.getStackStats(
    credentialFor(
      req,
      req.query.region as string | undefined,
      req.query.regionUserId as string | undefined
    ),
    apiKey
  );
  return res.status(HTTP_CODES.OK).json(stats);
};

// ---- Locales on the destination stack (feeds FR-4.1/FR-4.2 dropdowns) ----
const listLocales = async (req: Request, res: Response) => {
  const stackApiKey = req.query.stackApiKey as string | undefined;
  if (!stackApiKey) return badRequest(res, "Query param 'stackApiKey' is required.");

  const locales = await csManagement.listLocales(
    credentialFor(
      req,
      req.query.region as string | undefined,
      req.query.regionUserId as string | undefined
    ),
    stackApiKey
  );
  return res.status(HTTP_CODES.OK).json({ locales });
};

// ---- API-1: persist the destination selection (FR-8.2, TR-9) ----
const persistDestination = async (req: Request, res: Response) => {
  const { orgId, projectId } = req.params as { orgId: string; projectId: string };
  const { token_payload, ...rest } = (req.body ?? {}) as Record<string, any>;
  const destination = rest as V3Destination;

  if (!destination.stack?.apiKey) {
    return badRequest(res, "Invalid destination: 'stack.apiKey' is required.");
  }
  if (!VALID_METHODS.includes(destination.importAuth?.method)) {
    return badRequest(
      res,
      "Invalid destination: 'importAuth.method' must be 'management' or 'authToken'."
    );
  }

  const saved = await upsertV3Destination(
    orgId,
    projectId,
    destination,
    new Date().toISOString()
  );
  return res.status(HTTP_CODES.OK).json({ destination: saved });
};

// ---- API-2: read the persisted destination selection (UC-5 resume) ----
const getDestination = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const project = await getV3Project(projectId);
  if (!project || !project.destination) {
    return res.status(HTTP_CODES.NOT_FOUND).json({
      error: {
        code: HTTP_CODES.NOT_FOUND,
        message: "No destination selection found for this project.",
      },
    });
  }
  return res.status(HTTP_CODES.OK).json({ destination: project.destination });
};

export const destinationController = {
  createStack,
  listContentstackLocales,
  createManagementToken,
  getStackStats,
  listLocales,
  persistDestination,
  getDestination,
};
