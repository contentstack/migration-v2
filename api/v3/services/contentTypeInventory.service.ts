import fs from "fs";
import path from "path";

import { csManagement } from "./csManagement.service.js";

/**
 * v3 content type inventory — cs-content-type-selection TR-1 … TR-5, TR-26.
 *
 * Two jobs, deliberately in one place because the panel needs both in one
 * response (API-1):
 *
 *   1. Read the source export's content types from DISK and derive the reference
 *      graph (FR-1.1 … FR-1.6). The source stack is never contacted.
 *   2. Ask the destination which of those uids it already has (FR-2.1 … FR-2.4).
 *      That read is allowed to fail without failing the whole inventory.
 *
 * The graph is stored FORWARD — `type → the types it references`. The question
 * the UI actually asks is the reverse ("who references this?"), computed on
 * demand over a few hundred entries; keeping one direction avoids a second
 * structure that could drift out of step (trd.md TC-4).
 */

export interface ContentTypeInventoryItem {
  uid: string;
  title: string;
  /** Content type uids this one references. Deduped, self-edge removed. */
  references: string[];
  existsInDestination: boolean;
}

export interface DestinationRef {
  region: string;
  stackApiKey: string;
  token: string;
  branch?: string;
}

export type DestinationReadFailure =
  | "unauthorized"
  | "not_found"
  | "network"
  | "unexpected";

export interface ContentTypeInventory {
  contentTypes: ContentTypeInventoryItem[];
  destinationRead: boolean;
  destinationReadFailure?: DestinationReadFailure;
}

/** Thrown when the export cannot be read at all — EC-1 / EC-2 (one state). */
export class ExportUnreadableError extends Error {
  readonly code = "export_unreadable";
  constructor(message = "The exported content types could not be read.") {
    super(message);
    this.name = "ExportUnreadableError";
  }
}

const asArray = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/**
 * Locates `content_types/schema.json`, tolerating the branch-folder layout the
 * Contentstack CLI produces as well as this repository's flat exporter output —
 * the same two shapes the audit reader already accommodates.
 */
const findSchemaFile = (exportDir: string): string | undefined => {
  const direct = path.join(exportDir, "content_types", "schema.json");
  if (fs.existsSync(direct)) return direct;

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(exportDir, { withFileTypes: true });
  } catch {
    return undefined;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nested = path.join(exportDir, entry.name, "content_types", "schema.json");
    if (fs.existsSync(nested)) return nested;
  }
  return undefined;
};

/**
 * Every content type uid a field tree references.
 *
 * Walks groups, modular block types and inlined global field schemas, because a
 * reference nested in any of them is still a dependency (FR-1.4). Unknown
 * container types are walked too rather than skipped: a `data_type` this code
 * has never seen is far more likely to be a container it should descend into
 * than a reason to stop (FR-1.6 / TC_CTS_012).
 */
const collectReferences = (fields: unknown, into: Set<string>): void => {
  for (const field of asArray<Record<string, any>>(fields)) {
    if (!field || typeof field !== "object") continue;

    if (field.data_type === "reference") {
      // `reference_to` appears as an array and, in older exports, a bare string.
      const targets =
        typeof field.reference_to === "string"
          ? [field.reference_to]
          : asArray<string>(field.reference_to);
      for (const t of targets) if (typeof t === "string" && t) into.add(t);
    }

    if (Array.isArray(field.schema)) collectReferences(field.schema, into);

    for (const block of asArray<Record<string, any>>(field.blocks)) {
      if (block && Array.isArray(block.schema)) collectReferences(block.schema, into);
    }
  }
};

/** Maps a rejected destination read onto the fixed vocabulary NFR-9 requires. */
const classifyDestinationFailure = (err: unknown): DestinationReadFailure => {
  const status = (err as { status?: number; statusCode?: number })?.status ??
    (err as { statusCode?: number })?.statusCode;
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";

  const message = String((err as Error)?.message ?? "");
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|network|fetch failed/i.test(message)) {
    return "network";
  }
  return "unexpected";
};

export const buildContentTypeInventory = async (opts: {
  exportDir: string;
  destination?: DestinationRef;
}): Promise<ContentTypeInventory> => {
  const schemaFile = findSchemaFile(opts.exportDir);
  if (!schemaFile) throw new ExportUnreadableError();

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(schemaFile, "utf8"));
  } catch {
    throw new ExportUnreadableError();
  }

  const sourceTypes = asArray<Record<string, any>>(raw).filter(
    (ct) => ct && typeof ct === "object" && typeof ct.uid === "string"
  );
  const presentUids = new Set(sourceTypes.map((ct) => ct.uid as string));

  const contentTypes: ContentTypeInventoryItem[] = sourceTypes.map((ct) => {
    const found = new Set<string>();
    collectReferences(ct.schema, found);

    return {
      uid: ct.uid,
      // A content type with no title is still selectable; the uid is the only
      // thing that identifies it either way (FR-1.2, feature.md A-2).
      title: typeof ct.title === "string" && ct.title ? ct.title : ct.uid,
      references: [...found].filter(
        // A dangling target cannot be selected, so it can never be the subject of
        // an untick confirmation (EC-10). A self-edge is excluded because
        // removing a content type cannot break its own reference (FR-1.6).
        (target) => target !== ct.uid && presentUids.has(target)
      ),
      existsInDestination: false,
    };
  });

  // ── the destination half, which is allowed to fail ──────────────────────────

  const dest = opts.destination;
  if (!dest || !dest.token) {
    // Not a failure: no destination configured yet is a state, not an error, and
    // attempting the call would produce a 401 misreported as "unauthorized"
    // (EC-5, TC_CTS_022).
    return { contentTypes, destinationRead: false };
  }

  try {
    const destinationTypes = await csManagement.getDestinationContentTypes({
      region: dest.region,
      stackApiKey: dest.stackApiKey,
      token: dest.token,
      branch: dest.branch,
    });

    const destUids = new Set(
      asArray<Record<string, any>>(destinationTypes)
        .map((ct) => ct?.uid)
        .filter((uid): uid is string => typeof uid === "string")
    );

    for (const item of contentTypes) {
      // Exact, case-sensitive (FR-2.3). Title is deliberately not consulted —
      // feature.md Q-2 keeps a title fallback open, and guessing here would
      // silently change which content types offer a conflict choice.
      item.existsInDestination = destUids.has(item.uid);
    }

    return { contentTypes, destinationRead: true };
  } catch (err) {
    return {
      contentTypes,
      destinationRead: false,
      destinationReadFailure: classifyDestinationFailure(err),
    };
  }
};
