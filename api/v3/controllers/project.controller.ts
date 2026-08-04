import { Request, Response } from "express";
import { randomUUID } from "crypto";

import { HTTP_CODES } from "../constants/http.js";
import {
  PROJECT_DESCRIPTION_MAX,
  PROJECT_NAME_MAX,
} from "../constants/project.js";
import { createV3Project, listV3Projects } from "../models/project.store.js";
import { V3ProjectScope } from "../models/types.js";
import { v3Log } from "../utils/logger.util.js";

/**
 * v3 Project controller (cs-project-dashboard trd.md API-1, API-2).
 *
 * Thin handlers over the unit-tested store. The caller's scope is assembled here
 * and nowhere else, so there is one place to verify that region and owner come
 * from the verified token rather than from the request (NFR-3).
 */
const badRequest = (res: Response, message: string) =>
  res.status(HTTP_CODES.BAD_REQUEST).json({
    error: { code: HTTP_CODES.BAD_REQUEST, message },
  });

/**
 * The caller's scope.
 *
 * Every dimension comes from the decoded token the auth middleware attached.
 * Nothing is taken from the path, the body or the query string — accepting any of
 * it would let a caller enumerate another user's projects (NFR-3). Since the
 * 2026-08-05 revision there is no organization dimension at all, so there is
 * nothing a caller could supply even in principle.
 */
const scopeOf = (req: Request): V3ProjectScope => {
  const payload = (req.body?.token_payload ?? {}) as {
    region?: string;
    user_id?: string;
  };
  return {
    region: payload.region ?? "",
    owner: payload.user_id ?? "",
  };
};

/** GET /v3/project — the caller's projects. */
const listProjects = async (req: Request, res: Response) => {
  const scope = scopeOf(req);
  const projects = await listV3Projects(scope);
  res.status(HTTP_CODES.OK).json({ projects });
};

/**
 * POST /v3/project — create a project.
 *
 * Server-side validation duplicates the client's rules on purpose: the client's
 * are an affordance, these are the contract. Not idempotent — two identical
 * requests create two projects, and v3 cannot delete either (trd.md TRR-2).
 */
const createProject = async (req: Request, res: Response) => {
  const scope = scopeOf(req);
  const name = typeof req.body?.name === "string" ? req.body.name : "";
  const description =
    typeof req.body?.description === "string" ? req.body.description : undefined;

  if (!name.trim()) return badRequest(res, "Project name is required.");
  if (name.length > PROJECT_NAME_MAX) {
    return badRequest(res, `Project name must be ${PROJECT_NAME_MAX} characters or fewer.`);
  }
  if (name !== name.trimStart()) {
    return badRequest(res, "Project name cannot start with a space.");
  }
  if (description && description.length > PROJECT_DESCRIPTION_MAX) {
    return badRequest(res, `Description must be ${PROJECT_DESCRIPTION_MAX} characters or fewer.`);
  }

  const project = await createV3Project(scope, { name, description }, {
    id: randomUUID(),
    nowIso: new Date().toISOString(),
  });

  // The project id only. The name and description are customer-supplied content
  // and must never reach the logs (NFR-9).
  v3Log("project.created", { projectId: project.id });

  res.status(HTTP_CODES.CREATED).json({ project });
};

export const projectController = {
  listProjects,
  createProject,
};
