import fs from "fs";
import path from "path";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

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
  const existing = requireProject(projectId);

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
  const existing = requireProject(projectId);

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
  const existing = requireProject(projectId);

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
  const existing = requireProject(projectId);

  // A soft-deleted project is not a migration target; recording a selection
  // against one would quietly resurrect it (FR-9.9).
  if (existing.isDeleted) {
    const err = new Error(`Project ${projectId} does not exist`) as Error & {
      status?: number;
    };
    err.status = 404;
    throw err;
  }

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
  if (!proj || !proj.source) {
    throw new Error(`No v3 project/source found for '${projectId}'.`);
  }
  proj.source.graph = graph;
  proj.source.lastExport = lastExport;
  proj.updated_at = nowIso;
  await db.write();
};
