import fs from "fs";
import path from "path";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";

import { V3GraphSummary, V3LastExport, V3Project, V3Source } from "./types.js";

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

/** Returns the v3 project by id, or undefined if it does not exist. */
export const getV3Project = async (
  projectId: string
): Promise<V3Project | undefined> => {
  await db.read();
  return db.data.projects.find((p) => p.id === projectId);
};

/**
 * Upserts the source SELECTION onto a v3 project. Server-owned fields
 * (`graph`, `lastExport`) are preserved unless the caller explicitly supplies
 * them. Creates a minimal record if the project doesn't exist yet.
 */
export const upsertV3Source = async (
  orgId: string,
  projectId: string,
  incoming: V3Source,
  nowIso: string
): Promise<V3Source> => {
  await db.read();
  const existing = db.data.projects.find((p) => p.id === projectId);

  const merged: V3Source = {
    ...incoming,
    graph: incoming.graph ?? existing?.source?.graph,
    lastExport: incoming.lastExport ?? existing?.source?.lastExport,
  };

  if (existing) {
    existing.source = merged;
    existing.updated_at = nowIso;
    if (!existing.org_id) existing.org_id = orgId;
  } else {
    db.data.projects.push({
      id: projectId,
      org_id: orgId,
      source: merged,
      created_at: nowIso,
      updated_at: nowIso,
    });
  }

  await db.write();
  return merged;
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
