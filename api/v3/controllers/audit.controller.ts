import { Request, Response } from "express";

import { HTTP_CODES } from "../constants/http.js";
import { getV3AuditDecisions, getV3Project, setV3AuditDecisions } from "../models/project.store.js";
import { V3AuditDecisions, V3Project, V3ProjectScope } from "../models/types.js";
import {
  getAuditJob,
  readCachedFindings,
  startAuditScan,
  AuditFindingsDocument,
} from "../services/auditScan.service.js";
import {
  deriveImpact,
  EXCLUDABLE_CATEGORIES,
} from "../services/auditDecisions.service.js";
import { stackDataDir } from "../utils/migrationData.util.js";

/**
 * v3 Audit controller (cs-audit-report trd.md API-1 … API-5).
 *
 * ⚠️ **Ordering that every handler must follow** (trd.md §12, TRR-4). `:projectId` is
 * used ONLY as a key into the scoped project read; the export directory is then derived
 * from the project's own stored source. No URL segment is ever concatenated into a
 * filesystem path, so a traversal-shaped id fails as project-not-found before anything
 * touches the disk. Inverting this ordering would let a caller read arbitrary
 * directories on the api host.
 */
const DEFAULT_PAGE_SIZE = 50;
/** Caps a client-supplied page size — an uncapped one defeats pagination (TQ-6). */
const MAX_PAGE_SIZE = 50;

const FILTER_TO_CATEGORY: Record<string, string | null> = {
  all: null,
  entries: "unpublishedEntries",
  assets: "unusedAssets",
  contentTypes: "emptyContentTypes",
  globalFields: "unusedGlobalFields",
};

const scopeOf = (req: Request): V3ProjectScope => {
  const payload = (req.body?.token_payload ?? {}) as {
    region?: string;
    user_id?: string;
  };
  return { region: payload.region ?? "", owner: payload.user_id ?? "" };
};

const notFound = (res: Response) =>
  res.status(HTTP_CODES.NOT_FOUND).json({
    error: { code: HTTP_CODES.NOT_FOUND, message: "Not found." },
  });

const badRequest = (res: Response, message: string) =>
  res.status(HTTP_CODES.BAD_REQUEST).json({
    error: { code: HTTP_CODES.BAD_REQUEST, message },
  });

/**
 * Resolves the project, then its export directory — in that order, always.
 * Returns `undefined` when the project is out of scope or does not exist; the two are
 * deliberately indistinguishable (NFR-6, EC-16).
 */
const resolveProject = async (
  req: Request
): Promise<V3Project | undefined> => {
  const { projectId } = req.params as { projectId: string };
  return getV3Project(projectId, scopeOf(req));
};

/**
 * The export directory for a project, derived from its STORED source. Returns
 * `undefined` when the project has no source stack recorded, which means there is no
 * export to audit (EC-17).
 */
const exportDirFor = (project: V3Project): string | undefined => {
  const apiKey = project.source?.stack?.stackApiKey;
  if (!apiKey) return undefined;
  // Nested under the project as of 2026-08-12, so two projects on one stack no
  // longer read (and overwrite) the same export folder.
  return stackDataDir(project.id, apiKey);
};

/** Strips `items` — API-3 is the summary; rows come from API-4 one page at a time. */
const summaryOf = (findings: AuditFindingsDocument) => ({
  checks: findings.checks.map((c) => {
    const out: Record<string, unknown> = { id: c.id, label: c.label, state: c.state };
    // Only for `done`, and by omission rather than `undefined`, so the wire format
    // itself cannot carry a zero for a check that did not run (FR-2.11).
    if (c.state === "done" && typeof c.count === "number") out.count = c.count;
    return out;
  }),
  modules: findings.modules,
  totals: findings.totals,
  variantsInspected: findings.variantsInspected,
});

/**
 * The project's decisions, read through the store's scoped accessor rather than off the
 * record. Both would work here — the project has already been scope-resolved — but
 * going through the accessor keeps every read of this field behind one predicate, so
 * there is a single place for the scope rule to live.
 */
const decisionsOf = async (
  req: Request,
  project: V3Project
): Promise<V3AuditDecisions> =>
  (await getV3AuditDecisions(project.id, scopeOf(req))) ?? {
    categories: {},
    itemOverrides: {},
  };

// ---- API-1: start a scan ----
const startScan = async (req: Request, res: Response) => {
  const project = await resolveProject(req);
  if (!project) return notFound(res);

  const exportDir = exportDirFor(project);
  if (!exportDir) {
    // No export exists to audit. 409 rather than 404 or 500, so the client can render
    // the EC-1 error state rather than a generic failure.
    return res.status(HTTP_CODES.CONFLICT).json({
      error: {
        code: HTTP_CODES.CONFLICT,
        message: "This project has no exported source data to audit.",
      },
    });
  }

  const jobId = startAuditScan({
    projectId: project.id,
    exportDir,
    force: req.body?.force === true,
  });
  return res.status(HTTP_CODES.ACCEPTED).json({ jobId });
};

// ---- API-2: poll a scan ----
const getJob = async (req: Request, res: Response) => {
  const project = await resolveProject(req);
  if (!project) return notFound(res);

  const { jobId } = req.params as { jobId: string };
  const job = getAuditJob(jobId);
  // Unknown after a restart, because the registry is in-memory (TRR-1). 404 tells the
  // client to start a new scan; a 500 would strand the panel.
  if (!job || job.projectId !== project.id) return notFound(res);

  return res.status(HTTP_CODES.OK).json({
    status: job.status,
    checks: job.checks,
    resolvedCount: job.resolvedCount,
    ...(job.error ? { error: job.error } : {}),
  });
};

// ---- API-3: the findings summary, decisions and impact ----
const getFindings = async (req: Request, res: Response) => {
  const project = await resolveProject(req);
  if (!project) return notFound(res);

  const exportDir = exportDirFor(project);
  if (!exportDir) return notFound(res);

  const findings = readCachedFindings(exportDir);
  // A normal part of the flow, not an error: it is what tells the client to scan.
  if (!findings) return notFound(res);

  const decisions = await decisionsOf(req, project);
  return res.status(HTTP_CODES.OK).json({
    findings: summaryOf(findings),
    decisions,
    impact: deriveImpact(findings.totals, findings.checks, decisions as never),
  });
};

// ---- API-4: one page of flagged items ----
const getItems = async (req: Request, res: Response) => {
  const project = await resolveProject(req);
  if (!project) return notFound(res);

  const exportDir = exportDirFor(project);
  if (!exportDir) return notFound(res);

  const findings = readCachedFindings(exportDir);
  if (!findings) return notFound(res);

  const filter = String(req.query.filter ?? "all");
  if (!(filter in FILTER_TO_CATEGORY)) return badRequest(res, "Unknown 'filter'.");

  const q = String(req.query.q ?? "").trim().toLowerCase();
  const page = Number(req.query.page ?? 1);
  if (!Number.isInteger(page) || page < 1) return badRequest(res, "Invalid 'page'.");

  const requested = Number(req.query.pageSize ?? DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(
    Number.isInteger(requested) && requested > 0 ? requested : DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE
  );

  const all = findings.checks.flatMap((c) => c.items ?? []);

  // Per-filter counts over the WHOLE set, returned on every page, so a pill never shows
  // a count that describes only what is on screen (FR-6.5).
  const counts = {
    all: all.length,
    entries: all.filter((i) => i.category === "unpublishedEntries").length,
    assets: all.filter((i) => i.category === "unusedAssets").length,
    contentTypes: all.filter((i) => i.category === "emptyContentTypes").length,
    globalFields: all.filter((i) => i.category === "unusedGlobalFields").length,
  };

  const category = FILTER_TO_CATEGORY[filter];
  let selected = category ? all.filter((i) => i.category === category) : all;
  if (q) {
    // The four fields FR-6.6 names, case-insensitively. No others — matching `status`
    // would make "Never published" return every unpublished row.
    selected = selected.filter((i) =>
      [i.title, i.uid, i.type, i.contentType ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  const total = selected.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (page > pageCount) return badRequest(res, "'page' is beyond the last page.");

  const start = (page - 1) * pageSize;
  return res.status(HTTP_CODES.OK).json({
    items: selected.slice(start, start + pageSize),
    page,
    pageCount,
    total,
    counts,
  });
};

// ---- API-5: persist the decisions ----
const putDecisions = async (req: Request, res: Response) => {
  const project = await resolveProject(req);
  if (!project) return notFound(res);

  const body = (req.body ?? {}) as Record<string, any>;
  const categories = body.categories ?? {};
  const itemOverrides = body.itemOverrides ?? {};

  if (typeof categories !== "object" || Array.isArray(categories)) {
    return badRequest(res, "'categories' must be an object.");
  }
  if (typeof itemOverrides !== "object" || Array.isArray(itemOverrides)) {
    return badRequest(res, "'itemOverrides' must be an object.");
  }

  // A state for a non-excludable category is rejected at the boundary. Accepting it
  // would store an instruction the resolver is required to ignore — a lie in the
  // record (A-4, FR-5.2).
  for (const key of Object.keys(categories)) {
    if (!EXCLUDABLE_CATEGORIES.includes(key as never)) {
      return badRequest(res, `'${key}' is not an excludable category.`);
    }
    if (categories[key] !== "include" && categories[key] !== "exclude") {
      return badRequest(res, `Invalid state for '${key}'.`);
    }
  }

  // Keys are the contract Content mapping will read (FR-7.3, INT-4), so malformed ones
  // are kept out of the store rather than normalised into something plausible.
  const keyShape = /^(entry:[^:]+:[^:]+:[^:]+|asset:.+)$/;
  for (const key of Object.keys(itemOverrides)) {
    if (!keyShape.test(key)) return badRequest(res, `Malformed override key '${key}'.`);
    if (itemOverrides[key] !== "include" && itemOverrides[key] !== "exclude") {
      return badRequest(res, `Invalid state for '${key}'.`);
    }
  }

  // Built field by field, so the session payload the auth middleware puts on the body
  // cannot ride along into the record.
  const decisions: V3AuditDecisions = {
    categories,
    itemOverrides,
    updatedAt: new Date().toISOString(),
  };
  await setV3AuditDecisions(project.id, decisions, decisions.updatedAt!);

  return res.status(HTTP_CODES.OK).json({ decisions });
};

export const auditController = {
  startScan,
  getJob,
  getFindings,
  getItems,
  putDecisions,
};
