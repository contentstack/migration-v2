import fs from "fs";
import path from "path";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

import { projectDataDir } from "../utils/migrationData.util.js";

import {
  PROJECT_DESCRIPTION_MAX,
  PROJECT_NAME_MAX,
} from "../constants/project.js";
import {
  V3AuditDecisions,
  V3Destination,
  V3GraphSummary,
  V3LastExport,
  V3Project,
  V3ProjectInput,
  V3ProjectPublic,
  V3ProjectScope,
  V3Source,
  V3StoredManagementToken,
  V3ContentTypeSelection,
} from "./types.js";

/**
 * v3 project store — a standalone lowdb JSON store, separate from v2's
 * `database/project.json`. The data directory is `V3_DATA_DIR` if set (used by
 * tests to isolate to a temp dir), else `database-v3/` under cwd.
 */
const V3_DB_FILE = "projects.json";

interface V3ProjectDocument {
  projects: V3Project[];
}

const defaultData: V3ProjectDocument = { projects: [] };

const dir = process.env.V3_DATA_DIR
  ? path.resolve(process.env.V3_DATA_DIR)
  : path.join(process.cwd(), "database-v3");

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const db = new Low<V3ProjectDocument>(
  new JSONFile<V3ProjectDocument>(path.join(dir, V3_DB_FILE)),
  defaultData
);



/**
 * The single scope predicate, used by BOTH the list and the single read.
 *
 * Written as one conjunction on purpose. Three chained optional checks would let a
 * record with a missing field slip through, which is exactly how a project
 * predating this feature — one with no `region` and no `owner` — would become
 * visible to everyone (FR-9.6, FR-9.13).
 */
const inScope = (p: V3Project, scope: V3ProjectScope): boolean =>
  p.region === scope.region &&
  p.owner === scope.owner &&
  p.isDeleted !== true;

/**
 * Returns the project by id, or undefined when it does not exist OR fails the
 * caller's scope.
 *
 * The two cases are deliberately indistinguishable: answering "forbidden" for a
 * scope miss would confirm that a project with that id exists, which the caller
 * is not entitled to know (FR-9.10, FR-9.11). Scoping this read is what stops a
 * kept URL bypassing the list filter.
 */
export const getV3Project = async (
  projectId: string,
  scope: V3ProjectScope
): Promise<V3Project | undefined> => {
  await db.read();
  const found = db.data.projects.find((p) => p.id === projectId);
  return found && inScope(found, scope) ? found : undefined;
};

/**
 * Strips the stored credential from a record on its way to a client.
 *
 * Returns a COPY. lowdb hands back live references into the parsed document, so a
 * sanitiser that deleted the field would erase the credential from disk on the
 * next `db.write()`.
 */
const withoutSecret = ({
  destinationToken: _omitted,
  ...rest
}: V3Project): V3ProjectPublic => rest;

/**
 * Every project the caller may see (FR-9.6), minus the stored token secret.
 *
 * This is the one read that ships whole project records to the browser, so the
 * encrypted secret is withheld here: encryption is protection at rest, not a
 * licence to hand ciphertext to a client that has no use for it. The token's name
 * and uid — which the dashboard may legitimately show — live on `destination` and
 * are untouched.
 */
export const listV3Projects = async (
  scope: V3ProjectScope
): Promise<V3ProjectPublic[]> => {
  await db.read();
  return db.data.projects.filter((p) => inScope(p, scope)).map(withoutSecret);
};

/**
 * Creates a project. Every field other than the name and the description is
 * assigned here from the caller's verified scope — the client supplies neither an
 * id, an owner, a region nor a timestamp (FR-7.8). Any organization a caller
 * passes is ignored: there is no such field (FR-9.7).
 *
 * `id` and `nowIso` are arguments rather than generated inside so that the store
 * stays deterministic under test; the controller supplies the real values.
 */
export const createV3Project = async (
  scope: V3ProjectScope,
  input: V3ProjectInput,
  meta: { id: string; nowIso: string }
): Promise<V3Project> => {
  const name = (input?.name ?? "").trim();
  if (!name) throw new Error("Project name is required");
  if (name.length > PROJECT_NAME_MAX) {
    throw new Error(`Project name must be ${PROJECT_NAME_MAX} characters or fewer`);
  }
  const description = input?.description?.trim() || undefined;
  if (description && description.length > PROJECT_DESCRIPTION_MAX) {
    throw new Error(`Description must be ${PROJECT_DESCRIPTION_MAX} characters or fewer`);
  }

  await db.read();

  /*
    Name uniqueness (FR-3.1–FR-3.7). Evaluated here rather than in the controller
    because the store is the only layer no client can bypass, and because the scope
    predicate this reuses already lives here.

    Compared case-folded and trimmed, against LIVE projects in the caller's scope only —
    so deleting a project releases its name immediately (FR-3.3) and two operators may
    each hold a "Migration Test" (FR-3.6).

    `p.name` is read defensively: one record in the live store carries only `id` and
    `created_at`, and an unguarded `.trim()` on its absent name would throw and break
    creation for everyone (EC-15).
  */
  const requested = normaliseName(name);
  const clash = db.data.projects.some(
    (p) => inScope(p, scope) && normaliseName(p.name) === requested
  );
  if (clash) {
    const err = new Error(`A project named "${name}" already exists.`) as Error & {
      status?: number;
    };
    // 409, distinct from the 400s above: "you must provide a name" and "that name is
    // taken" are different problems and must not be conflated (EC-10).
    err.status = 409;
    throw err;
  }

  const project: V3Project = {
    id: meta.id,
    name,
    ...(description ? { description } : {}),
    region: scope.region,
    owner: scope.owner,
    isDeleted: false,
    created_at: meta.nowIso,
    updated_at: meta.nowIso,
  };
  db.data.projects.push(project);
  await db.write();
  return project;
};

/**
 * A project name reduced to its comparison form: trimmed, case-folded.
 *
 * `toLowerCase` rather than any character stripping — removing diacritics would make
 * "Unique Name" collide with "Ünïqué Nâme" and refuse a genuinely different name
 * (feature.md R-5). Only the ENDS are trimmed, so inner whitespace stays significant
 * and "Migration  Test" remains distinct from "Migration Test".
 *
 * Tolerates a missing or non-string name, which a malformed legacy record has (EC-15).
 */
const normaliseName = (name: unknown): string =>
  typeof name === "string" ? name.trim().toLowerCase() : "";

/** Total bytes under `dir`, or 0 when it does not exist. Read before removal. */
const directorySize = (dir: string): number => {
  let total = 0;
  const walk = (current: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        try {
          total += fs.statSync(full).size;
        } catch {
          /* a file that vanished mid-walk contributes nothing */
        }
      }
    }
  };
  walk(dir);
  return total;
};

export interface V3DeleteResult {
  /** Whether an export folder was found and removed. */
  folderRemoved: boolean;
  /** Bytes reclaimed from disk; 0 when there was no folder. */
  bytesReclaimed: number;
}

/**
 * Deletes one project: flags the record, then removes everything it exported.
 *
 * ⚠️ ORDER IS THE SAFETY PROPERTY (FR-1.3). The record is flagged FIRST, so the worst
 * outcome of a filesystem failure is a hidden project with an orphaned folder — which
 * costs disk and nothing else. The reverse order has no acceptable failure mode: a
 * project still listed whose export has been removed looks usable and is not, and
 * every later step would read an empty folder with nothing to explain why (NFR-4).
 *
 * A folder-removal failure is REPORTED, not thrown. By that point the deletion has
 * succeeded from the operator's point of view; only the disk reclaim did not, and the
 * caller logs that rather than failing a delete that did happen.
 *
 * ⚠️ FIELD-LEVEL assignment, never a spread over the record. `{...project, isDeleted:
 * true}` is the natural way to write this and is exactly the bug: it would drop
 * `destinationToken.secretEncrypted`, which is write-only and unrecoverable once lost.
 * `setV3AuditDecisions` and `setV3ContentTypeSelection` document the same hazard.
 */
export const deleteV3Project = async (
  projectId: string,
  nowIso: string = new Date().toISOString()
): Promise<V3DeleteResult> => {
  await db.read();
  const existing = requireProject(projectId);

  // An already-deleted project is gone as far as every scoped read is concerned, so a
  // second delete reports "no such project" rather than succeeding for a project this
  // call did not delete.
  if (existing.isDeleted) {
    const err = new Error(`Project ${projectId} does not exist`) as Error & {
      status?: number;
    };
    err.status = 404;
    throw err;
  }

  existing.isDeleted = true;
  existing.updated_at = nowIso;
  await db.write();

  /*
    Only now is the filesystem touched. The path comes from `projectDataDir`, never from
    a join here, so the `safeSegment` sanitisation confines this recursive removal to
    the intended directory (FR-1.7).
  */
  const dir = projectDataDir(projectId);
  const bytesReclaimed = directorySize(dir);
  const existed = fs.existsSync(dir);
  try {
    // One recursive call, not a per-file walk: the walk is what turns a large export
    // from seconds into minutes (NFR-1).
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    return { folderRemoved: false, bytesReclaimed: 0 };
  }
  return { folderRemoved: existed, bytesReclaimed: existed ? bytesReclaimed : 0 };
};

/**
 * Whether a project still exists and has not been deleted.
 *
 * Unscoped and deliberately minimal: its caller is the export job (FR-1.11), which
 * holds a project id captured when the job started and must re-check liveness before
 * its final writes. Without that check the job's atomic rename would recreate the
 * export folder a deletion had just removed.
 */
export const isV3ProjectLive = async (projectId: string): Promise<boolean> => {
  await db.read();
  const project = db.data.projects.find((p) => p.id === projectId);
  return !!project && project.isDeleted !== true;
};

/**
 * Both upserts below require the project to already exist. Previously they
 * created a minimal record on demand, which is how the store acquired a project
 * with no name, region or owner — see FR-9.9. Creation now has exactly one entry
 * point: createV3Project.
 */
const requireProject = (projectId: string): V3Project => {
  const existing = db.data.projects.find((p) => p.id === projectId);
  if (!existing) {
    const err = new Error(`Project ${projectId} does not exist`) as Error & {
      status?: number;
    };
    err.status = 404;
    throw err;
  }
  return existing;
};

/**
 * The project, or a 404 if it does not exist OR has been deleted.
 *
 * Used by every writer that records migration state (FR-1.10). A soft-deleted project
 * is not a migration target, and a later write against one would silently attach state
 * to a project the operator removed. `setV3ContentTypeSelection` carried this guard
 * alone before deletion existed; the other four now share it, which is also why the
 * check lives in one function rather than being repeated per writer.
 *
 * Deliberately NOT folded into `requireProject` itself: that would change the
 * behaviour of every current and future caller at once, including `deleteV3Project`,
 * which must be able to find a live project in order to delete it.
 */
const requireLiveProject = (projectId: string): V3Project => {
  const existing = requireProject(projectId);
  if (existing.isDeleted) {
    const err = new Error(`Project ${projectId} does not exist`) as Error & {
      status?: number;
    };
    err.status = 404;
    throw err;
  }
  return existing;
};

/**
 * Upserts the source SELECTION onto an EXISTING v3 project. Server-owned fields
 * (`graph`, `lastExport`) are preserved unless the caller explicitly supplies
 * them. Throws 404 if the project does not exist — it no longer creates one
 * (FR-9.10).
 */
export const upsertV3Source = async (
  projectId: string,
  incoming: V3Source,
  nowIso: string
): Promise<V3Source> => {
  await db.read();
  // Refuses a soft-deleted project (FR-1.10) — recording a source against one would
  // attach migration state to a project the operator removed.
  const existing = requireLiveProject(projectId);

  const merged: V3Source = {
    ...incoming,
    graph: incoming.graph ?? existing.source?.graph,
    lastExport: incoming.lastExport ?? existing.source?.lastExport,
  };

  existing.source = merged;
  existing.updated_at = nowIso;

  await db.write();
  return merged;
};

/**
 * Upserts the destination SELECTION onto an EXISTING v3 project (trd.md API-1 /
 * DM-1). Additive and independent of `source`: writing a destination never
 * touches the source sub-document, so this feature can never corrupt Source's
 * data. Throws 404 if the project does not exist — it no longer creates one
 * (FR-9.10).
 */
export const upsertV3Destination = async (
  projectId: string,
  incoming: V3Destination,
  nowIso: string
): Promise<V3Destination> => {
  await db.read();
  const existing = requireProject(projectId);

  existing.destination = incoming;
  existing.updated_at = nowIso;

  await db.write();
  return incoming;
};

/**
 * Stores the destination stack's management-token secret against a project
 * (2026-08-06). The value handed in is already encrypted — this store never sees
 * a plaintext credential, which keeps the encryption boundary in one place
 * (`utils/secret.util.ts`) rather than spread across the layers that touch it.
 *
 * Written to a top-level field, NOT into `destination`, because the client's
 * `upsertV3Destination` call replaces that sub-document wholesale a moment later
 * and would otherwise wipe the secret. See the note on `V3StoredManagementToken`.
 *
 * Throws 404 for an unknown project rather than creating one. Storing a secret is
 * the last operation that should be able to conjure a nameless, ownerless project
 * into existence (FR-9.9, FR-9.10).
 */
export const setV3DestinationToken = async (
  projectId: string,
  token: V3StoredManagementToken,
  nowIso: string
): Promise<void> => {
  await db.read();
  const existing = requireLiveProject(projectId);  // FR-1.10

  existing.destinationToken = token;
  existing.updated_at = nowIso;

  await db.write();
};

/**
 * Reads the stored token for a caller in scope — the server-internal counterpart
 * of the write above, for the later Migrate step.
 *
 * Implemented in terms of `getV3Project` on purpose: a stored credential is the
 * single most important record in this store to keep behind the same scope
 * predicate as everything else, and re-deriving the predicate here would be a
 * second place for it to drift.
 */
export const getV3DestinationToken = async (
  projectId: string,
  scope: V3ProjectScope
): Promise<V3StoredManagementToken | undefined> => {
  const project = await getV3Project(projectId, scope);
  return project?.destinationToken;
};

/**
 * Stores the Audit step's include/exclude decisions on a project (cs-audit-report
 * TR-10, DM-2).
 *
 * ⚠️ A **field-level** assignment, and that is a requirement rather than a style
 * choice (trd.md TRR-7). This record also holds `destinationToken.secretEncrypted` —
 * a permanent Contentstack write credential that cannot be re-read once lost — so the
 * convenient `{...project, audit}` spread would destroy it. It would also silently
 * overwrite `source.lastExport`, which the wizard's step gate reads to decide whether
 * this step is reachable at all.
 *
 * Throws 404 for an unknown project rather than creating one: recording an audit
 * decision must not become a second creation path (FR-9.9, FR-9.10).
 */
export const setV3AuditDecisions = async (
  projectId: string,
  decisions: V3AuditDecisions,
  nowIso: string
): Promise<void> => {
  await db.read();
  const existing = requireLiveProject(projectId);  // FR-1.10

  existing.audit = decisions;
  existing.updated_at = nowIso;

  await db.write();
};

/**
 * Reads a project's audit decisions for a caller in scope, or `undefined` when the
 * project is out of scope OR has never been audited.
 *
 * Those two cases are deliberately indistinguishable, matching every other scoped read
 * in this store (NFR-6, EC-16). `undefined` for a never-audited project is also
 * meaningful in its own right: it lets the panel tell "showing defaults" from "showing
 * the user's choices", which an empty decision set could not.
 */
export const getV3AuditDecisions = async (
  projectId: string,
  scope: V3ProjectScope
): Promise<V3AuditDecisions | undefined> => {
  const project = await getV3Project(projectId, scope);
  return project?.audit;
};

/**
 * Persists the operator's content type selection — cs-content-type-selection
 * FR-9.3, FR-9.4, FR-9.9; trd.md DM-2, TR-21.
 *
 * ⚠️ A **field-level** assignment, for exactly the reason `setV3AuditDecisions`
 * above spells out (trd.md TRR-1): this record holds
 * `destinationToken.secretEncrypted`, a Contentstack write credential that cannot
 * be re-read once lost, so the convenient `{...project, contentTypeSelection}`
 * spread would destroy it. It would also wipe `audit`, whose decisions this very
 * step consumes downstream.
 *
 * `updatedAt` is stamped from the caller's clock rather than taken from the
 * payload, so a client cannot backdate a selection and decide a later
 * "which is newer" comparison for itself (EC-9).
 */
export const setV3ContentTypeSelection = async (
  projectId: string,
  selection: V3ContentTypeSelection,
  nowIso: string
): Promise<void> => {
  await db.read();
  /*
    This writer carried the deleted-project guard on its own before deletion existed
    (FR-9.9). It now shares `requireLiveProject` with the other four, so there is one
    place the rule lives rather than five copies that can drift.
  */
  const existing = requireLiveProject(projectId);

  existing.contentTypeSelection = {
    contentTypes: selection?.contentTypes ?? {},
    updatedAt: nowIso,
  };
  existing.updated_at = nowIso;

  await db.write();
};

/**
 * Reads a project's content type selection for a caller in scope, or `undefined`
 * when the project is out of scope OR has never had one saved.
 *
 * Those two cases are deliberately indistinguishable, matching every other scoped
 * read in this store (NFR-4). `undefined` for a never-saved project is also
 * meaningful in itself: it lets the panel tell "nothing was ever chosen" from
 * "everything was deselected", which an empty map could not.
 */
export const getV3ContentTypeSelection = async (
  projectId: string,
  scope: V3ProjectScope
): Promise<V3ContentTypeSelection | undefined> => {
  const project = await getV3Project(projectId, scope);
  return project?.contentTypeSelection;
};

/**
 * Persists the server-owned graph + lastExport onto a project's source (called
 * by the export job on success). Requires the project + source to exist.
 */
export const setV3Graph = async (
  projectId: string,
  graph: V3GraphSummary,
  lastExport: V3LastExport,
  nowIso: string
): Promise<void> => {
  await db.read();
  const proj = db.data.projects.find((p) => p.id === projectId);
  /*
    The pre-existing error for a MISSING project or one with no source, unchanged.
    TC_SRC_047 pins this message, and nothing in cs-project-lifecycle's feature.md
    states it changed — so the deleted-project guard is added ALONGSIDE it rather than
    replacing it. Routing both cases through `requireLiveProject` would have been
    tidier and would have silently altered a contract this feature never touched.
  */
  if (!proj || !proj.source) {
    throw new Error(`No v3 project/source found for '${projectId}'.`);
  }
  // FR-1.10: a deleted project is not a migration target.
  if (proj.isDeleted) {
    const err = new Error(`Project ${projectId} does not exist`) as Error & { status?: number };
    err.status = 404;
    throw err;
  }
  proj.source.graph = graph;
  proj.source.lastExport = lastExport;
  proj.updated_at = nowIso;
  await db.write();
};
