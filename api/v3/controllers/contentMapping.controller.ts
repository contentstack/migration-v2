import { Request, Response } from "express";

import { HTTP_CODES } from "../constants/http.js";
import {
  getV3ContentTypeSelection,
  getV3DestinationToken,
  getV3Project,
  setV3ContentTypeSelection,
} from "../models/project.store.js";
import { V3ContentTypeSelection, V3Project, V3ProjectScope } from "../models/types.js";
import {
  buildContentTypeInventory,
  ContentTypeInventory,
} from "../services/contentTypeInventory.service.js";
import { decryptSecret } from "../utils/secret.util.js";
import { stackDataDir } from "../utils/migrationData.util.js";

/**
 * v3 Content mapping controller — cs-content-type-selection trd.md API-1, API-2.
 *
 * ⚠️ **Ordering every handler follows** (trd.md §12): `:projectId` is used ONLY as a
 * key into the scoped project read; the export directory is then derived from the
 * project's own stored source api key. No URL segment or query parameter is ever
 * concatenated into a filesystem path, so a traversal-shaped id fails as
 * project-not-found before anything touches the disk.
 */

const CONFLICT_MODES = new Set(["source", "dest", "merge"]);

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

/** Resolves the project in scope, or ends the response. */
const resolveProject = async (
  req: Request,
  res: Response
): Promise<V3Project | undefined> => {
  const project = await getV3Project(String(req.params.projectId), scopeOf(req));
  if (!project) {
    notFound(res);
    return undefined;
  }
  return project;
};

/**
 * The destination reference for the conflict check, or undefined when this
 * project has no usable destination credential yet (EC-5).
 */
const destinationRefFor = async (project: V3Project) => {
  const dest = (project as any).destination;
  if (!dest?.stackApiKey) return undefined;

  const stored = await getV3DestinationToken(project.id);
  if (!stored?.secretEncrypted) return undefined;

  let token = "";
  try {
    token = decryptSecret(stored.secretEncrypted);
  } catch {
    // An undecryptable secret is treated as no credential rather than as a
    // failure: the operator's remedy is the same, and surfacing the cipher
    // problem would put key material into an error path (NFR-3).
    return undefined;
  }
  if (!token) return undefined;

  return {
    region: dest.region ?? project.region,
    stackApiKey: dest.stackApiKey,
    token,
    branch: dest.branch,
  };
};

/** One structured line per inventory read (NFR-9). Never the titles, never the path. */
const logInventory = (
  projectId: string,
  inventory: ContentTypeInventory,
  ms: number
): void => {
  const edges = inventory.contentTypes.reduce((n, c) => n + c.references.length, 0);
  // Content type NAMES are customer content; a count answers the operational
  // question without putting a stack's model names into log storage.
  console.log(
    `[v3][content-mapping] inventory project=${projectId} contentTypes=${inventory.contentTypes.length} ` +
      `references=${edges} destinationRead=${inventory.destinationRead}` +
      (inventory.destinationReadFailure
        ? ` destinationFailure=${inventory.destinationReadFailure}`
        : "") +
      ` ms=${ms}`
  );
};

export const contentMappingController = {
  /**
   * API-1 — the whole inventory, the reference graph, the destination indicator
   * and the persisted selection, in one response.
   *
   * Deliberately unpaged: FR-3.5's search and FR-4.3's select-all both operate on
   * the complete set, and the reference graph has to be in the browser for the
   * untick confirmation to resolve synchronously (trd.md TC-1). Any `limit`,
   * `skip` or `q` parameter is ignored rather than honoured, because a silently
   * truncated inventory would make select-all act on a subset.
   */
  getInventory: async (req: Request, res: Response) => {
    const project = await resolveProject(req, res);
    if (!project) return;

    const sourceApiKey = project.source?.stack?.stackApiKey;
    if (!sourceApiKey) {
      return res.status(HTTP_CODES.CONFLICT).json({ error: "export_unreadable" });
    }

    const started = Date.now();
    let inventory: ContentTypeInventory;
    try {
      inventory = await buildContentTypeInventory({
        exportDir: stackDataDir(project.id, sourceApiKey),
        destination: await destinationRefFor(project),
      });
    } catch (err) {
      // The raw parser message carries a byte offset into a customer's export and
      // helps nobody; only the classification is returned (NFR-9).
      const code = (err as { code?: string })?.code;
      if (code === "export_unreadable") {
        console.log(
          `[v3][content-mapping] inventory project=${project.id} failure=export_unreadable`
        );
        return res.status(HTTP_CODES.CONFLICT).json({ error: "export_unreadable" });
      }
      throw err;
    }

    logInventory(project.id, inventory, Date.now() - started);

    const selection = await getV3ContentTypeSelection(project.id, scopeOf(req));

    return res.status(HTTP_CODES.OK).json({
      contentTypes: inventory.contentTypes,
      destinationRead: inventory.destinationRead,
      ...(inventory.destinationReadFailure
        ? { destinationReadFailure: inventory.destinationReadFailure }
        : {}),
      // Omitted entirely when nothing was ever saved, so the client can tell
      // "never chosen" from "everything deselected" (FR-9.5).
      ...(selection ? { selection } : {}),
    });
  },

  /**
   * API-2 — replace the stored selection.
   *
   * Validation is all-or-nothing: a payload mixing valid and invalid entries
   * stores none of it, because a partial write would leave the operator with a
   * selection they never chose and no error explaining the difference.
   */
  putSelection: async (req: Request, res: Response) => {
    const project = await resolveProject(req, res);
    if (!project) return;

    const submitted = req.body?.contentTypes;
    if (!submitted || typeof submitted !== "object" || Array.isArray(submitted)) {
      return badRequest(res, "A contentTypes map is required.");
    }

    const sourceApiKey = project.source?.stack?.stackApiKey;
    if (!sourceApiKey) {
      return res.status(HTTP_CODES.CONFLICT).json({ error: "export_unreadable" });
    }

    let inventory: ContentTypeInventory;
    try {
      inventory = await buildContentTypeInventory({
        exportDir: stackDataDir(project.id, sourceApiKey),
        destination: await destinationRefFor(project),
      });
    } catch {
      return res.status(HTTP_CODES.CONFLICT).json({ error: "export_unreadable" });
    }

    const known = new Map(inventory.contentTypes.map((c) => [c.uid, c]));
    const clean: V3ContentTypeSelection["contentTypes"] = {};

    for (const [uid, raw] of Object.entries(submitted as Record<string, any>)) {
      const item = known.get(uid);
      if (!item) return badRequest(res, `Unknown content type: ${uid}`);

      const mode = raw?.conflictMode;
      if (mode === undefined) {
        clean[uid] = {};
        continue;
      }
      if (typeof mode !== "string" || !CONFLICT_MODES.has(mode)) {
        return badRequest(res, `Unsupported conflict mode for ${uid}.`);
      }
      // A mode is only meaningful for a content type the server confirmed exists
      // in the destination. When the destination could not be read, nothing is
      // confirmed, so a submitted mode is refused rather than trusted (TRR-3).
      if (!item.existsInDestination) {
        return badRequest(res, `${uid} does not exist in the destination.`);
      }
      clean[uid] = { conflictMode: mode as "source" | "dest" | "merge" };
    }

    const nowIso = new Date().toISOString();
    await setV3ContentTypeSelection(project.id, { contentTypes: clean }, nowIso);

    const conflicting = Object.values(clean).filter((v) => v.conflictMode).length;
    // The chosen MODES are deliberately not logged — whether to record them is an
    // open product decision (prd.md PQ-2 / trd.md TQ-6), and a log added by
    // accident is harder to remove than one added on purpose.
    console.log(
      `[v3][content-mapping] selection project=${project.id} ` +
        `selected=${Object.keys(clean).length} conflicting=${conflicting}`
    );

    const stored = await getV3ContentTypeSelection(project.id, scopeOf(req));
    return res.status(HTTP_CODES.OK).json({
      selection: stored ?? { contentTypes: clean, updatedAt: nowIso },
    });
  },
};
