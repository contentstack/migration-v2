import { Request, Response } from "express";
import { randomUUID } from "crypto";

import { HTTP_CODES } from "../constants/http.js";
import { getV3Project, upsertV3Source } from "../models/project.store.js";
import { getUploadMeta, saveUpload } from "../models/upload.store.js";
import { saveAuthtoken } from "../models/auth.store.js";
import { V3Source, V3SourceMode } from "../models/types.js";
import { csManagement, TokenPayload } from "../services/csManagement.service.js";
import { parseBundle, MODULE_DEFS } from "../services/bundle.service.js";
import { getJob, startExportJob } from "../services/export.service.js";
import { SOURCE_REGIONS } from "../config/cs.js";
import { resolveRegionCredential } from "../utils/region-credential.util.js";

/**
 * v3 Source controller. Thin handlers over the (unit-tested) v3 services.
 * Errors thrown by services carry a `.status` and are mapped by the v3 error
 * middleware via asyncRouter.
 */
const VALID_MODES: V3SourceMode[] = ["stack", "file"];

// ---- Listing (API-4 / FR-5.3) ----

/**
 * GET /v3/source/regions — the fixed set of selectable source regions, plus
 * the caller's home (already-authenticated) region so the UI can default to
 * it and know which other selections require a region-login.
 */
const listRegions = (req: Request, res: Response) => {
  const homeRegion = req.body?.token_payload?.region as string | undefined;
  return res.status(HTTP_CODES.OK).json({ regions: SOURCE_REGIONS, homeRegion });
};

/**
 * Reads the caller's requested region-credential from the query string
 * (`region`, `regionUserId`) and resolves it against the session's home
 * credential. Throws RegionAuthError (401) if a non-home region is requested
 * without a completed region-login.
 */
const credentialFromQuery = (req: Request): TokenPayload =>
  resolveRegionCredential(
    req.body?.token_payload,
    req.query.region as string | undefined,
    req.query.regionUserId as string | undefined
  );

const listOrgs = async (req: Request, res: Response) => {
  const orgs = await csManagement.listOrgs(credentialFromQuery(req));
  return res.status(HTTP_CODES.OK).json({ orgs });
};

const listStacks = async (req: Request, res: Response) => {
  const orgId = req.query.orgId as string | undefined;
  if (!orgId) {
    return res
      .status(HTTP_CODES.BAD_REQUEST)
      .json({ status: HTTP_CODES.BAD_REQUEST, message: "Query param 'orgId' is required." });
  }
  const stacks = await csManagement.listStacks(credentialFromQuery(req), orgId);
  return res.status(HTTP_CODES.OK).json({ stacks });
};

const listBranches = async (req: Request, res: Response) => {
  const stackApiKey = req.query.stackApiKey as string | undefined;
  if (!stackApiKey) {
    return res
      .status(HTTP_CODES.BAD_REQUEST)
      .json({ status: HTTP_CODES.BAD_REQUEST, message: "Query param 'stackApiKey' is required." });
  }
  const branches = await csManagement.listBranches(credentialFromQuery(req), stackApiKey);
  return res.status(HTTP_CODES.OK).json({ branches });
};

/**
 * POST /v3/source/region-login — real Contentstack login for a region other
 * than the caller's home-region session (FR — cross-region source auth).
 * Persists the resulting credential to the shared auth store and returns only
 * the (region-specific) userId + email — never the authtoken — to the client.
 */
const regionLogin = async (req: Request, res: Response) => {
  const { region, email, password } = (req.body ?? {}) as Record<string, any>;
  if (!region || !email || !password) {
    return res.status(HTTP_CODES.BAD_REQUEST).json({
      status: HTTP_CODES.BAD_REQUEST,
      message: "'region', 'email' and 'password' are required.",
    });
  }

  const { userId, email: csEmail, authtoken } = await csManagement.regionLogin(
    region,
    email,
    password
  );
  await saveAuthtoken(region, userId, csEmail, authtoken);

  return res.status(HTTP_CODES.OK).json({ userId, email: csEmail });
};

// ---- Modules (API-5 / FR-5.4) ----
const listModules = async (req: Request, res: Response) => {
  const sourceId = req.query.sourceId as string | undefined;
  if (sourceId) {
    const meta = getUploadMeta(sourceId);
    if (!meta) {
      return res
        .status(HTTP_CODES.NOT_FOUND)
        .json({ status: HTTP_CODES.NOT_FOUND, message: "Unknown sourceId — upload the bundle first." });
    }
    const modules = MODULE_DEFS.map((m) => ({
      key: m.key,
      label: m.label,
      count: meta.modules[m.key] ?? 0,
      dependsOn: m.dependsOn,
    }));
    return res.status(HTTP_CODES.OK).json({ modules });
  }

  const stackApiKey = req.query.stackApiKey as string | undefined;
  if (stackApiKey) {
    const branch = req.query.branch as string | undefined;
    const counts = await csManagement.getStackModuleCounts(
      credentialFromQuery(req),
      stackApiKey,
      branch
    );
    const modules = MODULE_DEFS.map((m) => ({
      key: m.key,
      label: m.label,
      count: counts[m.key] ?? 0,
      dependsOn: m.dependsOn,
    }));
    return res.status(HTTP_CODES.OK).json({ modules });
  }

  return res
    .status(HTTP_CODES.BAD_REQUEST)
    .json({ status: HTTP_CODES.BAD_REQUEST, message: "Provide 'sourceId' (file) or 'stackApiKey' (stack)." });
};

// ---- Upload/validate (API-3 / FR-3.3, FR-3.8, FR-3.9) ----
const uploadBundle = async (req: Request, res: Response) => {
  const file = (req as any).file as
    | { buffer: Buffer; originalname: string; size: number }
    | undefined;
  if (!file) {
    return res
      .status(HTTP_CODES.BAD_REQUEST)
      .json({ status: HTTP_CODES.BAD_REQUEST, message: "No file uploaded (field 'file')." });
  }

  const parsed = parseBundle(file.buffer); // throws BundleError(400) on invalid
  const sourceId = randomUUID();
  saveUpload(sourceId, file.buffer, {
    sourceId,
    fileName: file.originalname,
    sizeBytes: file.size,
    contentVersion: parsed.contentVersion,
    modules: parsed.modules,
    manifest: parsed.manifest,
    createdAt: new Date().toISOString(),
  });

  return res.status(HTTP_CODES.OK).json({
    sourceId,
    fileName: file.originalname,
    sizeBytes: file.size,
    manifest: parsed.manifest,
  });
};

// ---- Async export/status (API-1, API-2 / FR-5.5) ----
const startExport = async (req: Request, res: Response) => {
  const { token_payload, projectId, mode, stack, file } =
    (req.body ?? {}) as Record<string, any>;

  if (!projectId) {
    return res
      .status(HTTP_CODES.BAD_REQUEST)
      .json({ status: HTTP_CODES.BAD_REQUEST, message: "'projectId' is required." });
  }
  if (!VALID_MODES.includes(mode)) {
    return res
      .status(HTTP_CODES.BAD_REQUEST)
      .json({ status: HTTP_CODES.BAD_REQUEST, message: "'mode' must be 'stack' or 'file'." });
  }
  if (mode === "file" && !file?.sourceId) {
    return res
      .status(HTTP_CODES.BAD_REQUEST)
      .json({ status: HTTP_CODES.BAD_REQUEST, message: "File mode requires 'file.sourceId'." });
  }
  if (mode === "stack" && !stack?.stackApiKey) {
    return res
      .status(HTTP_CODES.BAD_REQUEST)
      .json({ status: HTTP_CODES.BAD_REQUEST, message: "Stack mode requires 'stack.stackApiKey'." });
  }

  // Stack mode against a non-home region requires a completed region-login
  // (stack.regionUserId); throws RegionAuthError (401) otherwise (FR — cross-
  // region source auth). File mode has no CS credential to resolve.
  const effectiveTokenPayload: TokenPayload =
    mode === "stack"
      ? resolveRegionCredential(token_payload, stack?.region, stack?.regionUserId)
      : token_payload;

  const source: V3Source = { mode, stack, file };
  await upsertV3Source(projectId, source, new Date().toISOString());
  const jobId = startExportJob({ projectId, source, tokenPayload: effectiveTokenPayload });
  return res.status(HTTP_CODES.ACCEPTED).json({ jobId });
};

const getExportStatus = (req: Request, res: Response) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res
      .status(HTTP_CODES.NOT_FOUND)
      .json({ status: HTTP_CODES.NOT_FOUND, message: "Unknown jobId." });
  }
  return res.status(HTTP_CODES.OK).json({
    jobId: job.jobId,
    status: job.status,
    progress: job.progress,
    logs: job.logs,
    liveCounts: job.liveCounts,
    /*
      The stage caption comes from the SERVER because only the job knows which
      module the CLI is on. The client used to derive it from the progress
      percentage against a table of the old pipeline's phase boundaries, which no
      longer exist — leaving captions that named modules the run wasn't touching.
      Omitted when absent (file mode) rather than defaulted, so the client can fall
      back instead of showing a fabricated caption.
    */
    ...(job.stage ? { stage: job.stage } : {}),
    // Always sent, including 0: the client needs to distinguish "nothing dropped"
    // from "this server is too old to tell me", and only an explicit 0 does that.
    droppedLogs: job.droppedLogs,
    ...(job.error ? { error: job.error } : {}),
  });
};

// ---- Content graph (API-6 / FR-5.6) ----
const getGraph = async (req: Request, res: Response) => {
  // Fully scoped, like every other project read. The asymmetry this handler used
  // to carry — it could not apply the organization dimension because its path had
  // no `:orgId` — disappeared when organization stopped being a scope dimension.
  const tp = (req.body?.token_payload ?? {}) as { region?: string; user_id?: string };
  const project = await getV3Project(req.params.projectId, {
    region: tp.region ?? "",
    owner: tp.user_id ?? "",
  });
  const graph = project?.source?.graph;
  if (!graph) {
    return res
      .status(HTTP_CODES.NOT_FOUND)
      .json({ status: HTTP_CODES.NOT_FOUND, message: "No content graph yet — run an export first." });
  }
  return res.status(HTTP_CODES.OK).json(graph);
};

// ---- Persist / read source selection (API-7 / FR-5.2) ----
const persistSource = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const { token_payload, ...rest } = (req.body ?? {}) as Record<string, any>;
  const source = rest as V3Source;

  if (!source.mode || !VALID_MODES.includes(source.mode)) {
    return res
      .status(HTTP_CODES.BAD_REQUEST)
      .json({ status: HTTP_CODES.BAD_REQUEST, message: "Invalid source: 'mode' must be 'stack' or 'file'." });
  }
  const saved = await upsertV3Source(projectId, source, new Date().toISOString());
  return res.status(HTTP_CODES.OK).json({ source: saved });
};

const getSource = async (req: Request, res: Response) => {
  const { projectId } = req.params as { projectId: string };
  const tp = (req.body?.token_payload ?? {}) as { region?: string; user_id?: string };
  const project = await getV3Project(projectId, {
    region: tp.region ?? "",
    owner: tp.user_id ?? "",
  });
  if (!project || !project.source) {
    return res
      .status(HTTP_CODES.NOT_FOUND)
      .json({ status: HTTP_CODES.NOT_FOUND, message: "No source selection found for this project." });
  }
  return res.status(HTTP_CODES.OK).json({ source: project.source });
};

export const sourceController = {
  listRegions,
  regionLogin,
  listOrgs,
  listStacks,
  listBranches,
  listModules,
  startExport,
  getExportStatus,
  uploadBundle,
  getGraph,
  persistSource,
  getSource,
};
