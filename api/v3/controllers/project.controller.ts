import { Request, Response } from "express";
import { randomUUID } from "crypto";

import { HTTP_CODES } from "../constants/http.js";
import {
  PROJECT_DESCRIPTION_MAX,
  PROJECT_NAME_MAX,
} from "../constants/project.js";
import {
  createV3Project,
  deleteV3Project,
  getV3Project,
  listV3Projects,
} from "../models/project.store.js";
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
 * are an affordance, these are the contract.
 *
 * Revised 2026-08-12 (cs-project-lifecycle). The former note here read "two identical
 * requests create two projects, and v3 cannot delete either" — both halves are now
 * false: a duplicate NAME is refused with 409 (FR-3.1), and DELETE /v3/project/:id
 * exists (FR-1.1). Two requests with DIFFERENT names still create two projects, so the
 * endpoint remains non-idempotent in that sense.
 */
const createProject = async (req: Request, res: Response) => {
  const scope = scopeOf(req);
  const name = typeof req.body?.name === "string" ? req.body.name : "";
  const description =
    typeof req.body?.description === "string" ? req.body.description : undefined;

  /*
    Validation runs BEFORE the uniqueness check, and each failure reports its own
    classification. "You must provide a name" and "that name is taken" are different
    problems; conflating them would tell the operator to change a name they never
    entered (EC-10).
  */
  if (!name.trim()) {
    v3Log("project.create.rejected", { reason: "name_required" });
    return badRequest(res, "Project name is required.");
  }
  if (name.length > PROJECT_NAME_MAX) {
    v3Log("project.create.rejected", { reason: "name_too_long" });
    return badRequest(res, `Project name must be ${PROJECT_NAME_MAX} characters or fewer.`);
  }
  if (name !== name.trimStart()) {
    v3Log("project.create.rejected", { reason: "leading_whitespace" });
    return badRequest(res, "Project name cannot start with a space.");
  }
  if (description && description.length > PROJECT_DESCRIPTION_MAX) {
    v3Log("project.create.rejected", { reason: "description_too_long" });
    return badRequest(res, `Description must be ${PROJECT_DESCRIPTION_MAX} characters or fewer.`);
  }

  let project;
  try {
    project = await createV3Project(scope, { name, description }, {
      id: randomUUID(),
      nowIso: new Date().toISOString(),
    });
  } catch (e: any) {
    if (e?.status === HTTP_CODES.CONFLICT) {
      /*
        Reason code only — never the rejected name. The name is customer-supplied
        content and is the field most naturally added to a log line "for context"
        (FR-1.8 / NFR-9).
      */
      v3Log("project.create.rejected", { reason: "duplicate_name" });
      return res.status(HTTP_CODES.CONFLICT).json({
        status: HTTP_CODES.CONFLICT,
        // Deliberately says nothing about the conflicting project — no id, no owner —
        // so the refusal cannot be used to probe another scope (FR-3.6).
        message: "A project with that name already exists.",
      });
    }
    throw e;
  }

  // The project id only. The name and description are customer-supplied content
  // and must never reach the logs (NFR-9).
  v3Log("project.created", { projectId: project.id });

  res.status(HTTP_CODES.CREATED).json({ project });
};

/**
 * DELETE /v3/project/:projectId — delete a project and its exported content.
 *
 * The project is resolved through the caller's OWN scope first, so an unknown id, an
 * already-deleted project and one belonging to somebody else are indistinguishable
 * 404s — the response cannot be used to discover another operator's projects (FR-1.5).
 *
 * A folder-removal failure is NOT a failed delete: the record is already flagged by
 * then, so the project is gone from the operator's view and only the disk reclaim did
 * not happen. That is reported through the log, not as an error (API-1).
 */
const deleteProject = async (req: Request, res: Response) => {
  const scope = scopeOf(req);
  const projectId = String(req.params.projectId ?? "");
  const startedAt = Date.now();

  const project = await getV3Project(projectId, scope);
  if (!project) {
    v3Log("project.delete.failed", { projectId, reason: "not_found" });
    return res.status(HTTP_CODES.NOT_FOUND).json({
      status: HTTP_CODES.NOT_FOUND,
      message: "Project not found.",
    });
  }

  let result;
  try {
    result = await deleteV3Project(project.id);
  } catch (e: any) {
    // A store 404 here means the record went between the scoped read and the delete —
    // a "gone", not a server fault.
    if (e?.status === HTTP_CODES.NOT_FOUND) {
      v3Log("project.delete.failed", { projectId, reason: "not_found" });
      return res.status(HTTP_CODES.NOT_FOUND).json({
        status: HTTP_CODES.NOT_FOUND,
        message: "Project not found.",
      });
    }
    /*
      Fixed classification only, in BOTH directions. Store errors quote the project id
      and can quote a filesystem path, and `v3ErrorMiddleware` echoes `err.message`
      straight into the response body — so rethrowing `e` would publish that path to the
      client. A sanitised error is raised instead (NFR-2, NFR-6).
    */
    v3Log("project.delete.failed", { projectId, reason: "internal" });
    const safe = new Error("Could not delete the project.") as Error & { status?: number };
    safe.status = HTTP_CODES.SERVER_ERROR;
    throw safe;
  }

  v3Log("project.delete.succeeded", {
    projectId,
    folderRemoved: result.folderRemoved,
    bytesReclaimed: result.bytesReclaimed,
    durationMs: Date.now() - startedAt,
  });

  // An acknowledgement only — no name, no description (NFR-2).
  res.status(HTTP_CODES.OK).json({ deleted: true, id: project.id });
};

export const projectController = {
  listProjects,
  createProject,
  deleteProject,
};
