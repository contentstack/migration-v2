import fs from "fs";
import path from "path";
import ProjectModelLowdb from "../models/project-lowdb.js";
import getContentTypesMapperDb from "../models/contentTypesMapper-lowdb.js";
import getFieldMapperDb from "../models/FieldMapper.js";
import { contenTypeMaker } from "./content-type-creator.utils.js";
import { shouldSkipContentTypeCreation } from "./content-type-checker.utils.js";
import { sanitizeProjectId, sanitizeStackId } from "./sanitize-path.utils.js";
import customLogger from "./custom-logger.utils.js";

/** Normalize a content-type uid for loose comparison (case- and separator-insensitive). */
const normCtUid = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const singularCtUid = (s: string) => s.replace(/s$/, "");

/**
 * Read the uids of the authored content types in the export-data model folder (both the split
 * `content-types/` layout and a flat model dir). Returns an empty set when none are found, so callers
 * fall back to creating everything.
 */
const loadAuthoredContentTypeUids = (projectData: any): Set<string> => {
  const base =
    projectData?.articleModelDir ||
    process.env.CONTENT_MODEL_DIR ||
    path.resolve(process.cwd(), "..", "export-data");
  const dirs = [path.join(base, "content-types"), base];
  const uids = new Set<string>();
  for (const dir of dirs) {
    let names: string[] = [];
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith(".json")) continue;
      try {
        const def = JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
        const ct = def?.content_type || def;
        // Skip global fields (no `options`) — we only want content types here.
        if (ct?.uid && ct?.options) uids.add(String(ct.uid));
      } catch {
        /* ignore unreadable/oddly-shaped files */
      }
    }
  }
  return uids;
};

export const fieldAttacher = async ({ projectId, orgId, destinationStackId, region, user_id, is_sso }: any) => {
  const safeProjectId = sanitizeProjectId(projectId);
  if (!safeProjectId) {
    throw new Error("Invalid project identifier");
  }
  // Re-sanitize the destination stack id here as well: it is used as a path segment
  // downstream (contenTypeMaker -> writeFile), so it must be validated at the sink's
  // entry point to break any path-traversal taint chain regardless of the caller.
  const safeDestinationStackId = sanitizeStackId(destinationStackId);
  if (!safeDestinationStackId) {
    throw new Error("Invalid destination stack identifier");
  }
  await ProjectModelLowdb.read();
  const projectData: any = ProjectModelLowdb.chain.get("projects").find({
    id: safeProjectId,
    org_id: orgId,
  }).value()
  const iteration = projectData?.iteration || 1;
  const ContentTypesMapperModelLowdb = getContentTypesMapperDb(safeProjectId, iteration);
  const FieldMapperModel = getFieldMapperDb(safeProjectId, iteration);
  await ContentTypesMapperModelLowdb.read();
  await FieldMapperModel.read();
  // Content types the user authored in the export-data model. A mapper row that is a tool-generated
  // near-duplicate of one of these (e.g. `external-links` when `external_link` is authored) is skipped,
  // so only the authored content type is created — avoiding duplicate/conflicting content types.
  const authoredCtUids = loadAuthoredContentTypeUids(projectData);
  const authoredNorm = new Set(Array.from(authoredCtUids, normCtUid));
  const isToolDuplicateOfAuthored = (row: any): boolean => {
    if (!authoredNorm.size) return false;
    const candidates = [row?.contentstackUid, row?.contentstackTitle, row?.otherCmsUid]
      .map(normCtUid)
      .filter(Boolean);
    for (const nu of candidates) {
      if (authoredNorm.has(nu)) return false; // this row IS an authored content type → keep it
    }
    // Not an exact authored match: skip only when it collapses to the same singular as an authored uid
    // (a plural/separator variant like external-links ↔ external_link), never an unrelated new type.
    return candidates.some((nu) =>
      Array.from(authoredNorm).some((a) => a !== nu && singularCtUid(a) === singularCtUid(nu)),
    );
  };

  const contentTypes = [];
  if (projectData?.content_mapper?.length) {
    for await (const contentId of projectData?.content_mapper ?? []) {
      const contentType: any = ContentTypesMapperModelLowdb.chain
        .get("ContentTypesMappers")
        .find({ id: contentId, projectId: safeProjectId })
        .value();
      // A tool-generated near-duplicate of an authored content type must not be CREATED (the authored
      // one already covers it), but the row is still needed downstream: createEntry iterates the
      // returned list to generate entries, so dropping it here would silently produce no entries for
      // that post type. Skip only the creation, then keep the row.
      if (isToolDuplicateOfAuthored(contentType)) {
        await customLogger(
          safeProjectId,
          safeDestinationStackId,
          "info",
          `Skipping creation of tool-generated content type '${contentType?.contentstackUid}' — already provided by export-data model (entries still generated)`,
        );
        contentTypes?.push?.(contentType);
        continue;
      }
      if (contentType?.fieldMapping?.length) {
        contentType.fieldMapping = contentType?.fieldMapping?.map((fieldUid: any) => {
          const field = FieldMapperModel.chain
            .get("field_mapper")
            .find({ id: fieldUid, contentTypeId: contentId, projectId: safeProjectId })
            .value()
          return field;
        })
      }

      if (iteration === 1) {
        await contenTypeMaker({ contentType, destinationStackId: safeDestinationStackId, projectId: safeProjectId, newStack: projectData?.stackDetails?.isNewStack, keyMapper: projectData?.mapperKeys, region, user_id, is_sso })

      }
      else {
        const shouldSkip = await shouldSkipContentTypeCreation(safeProjectId, contentType?.otherCmsUid, iteration);
        if (!shouldSkip) {
          await customLogger(safeProjectId, safeDestinationStackId, 'info', `Creating new content type: ${contentType.otherCmsUid}`);
          await contenTypeMaker({ contentType, destinationStackId: safeDestinationStackId, projectId: safeProjectId, newStack: projectData?.stackDetails?.isNewStack, keyMapper: projectData?.mapperKeys, region, user_id, is_sso })
        } else {
          await customLogger(safeProjectId, safeDestinationStackId, 'info', `Skipping content type creation: ${contentType.otherCmsUid} (already exists from previous iteration)`);
        }
      }
      contentTypes?.push?.(contentType);
    }
  }
  return contentTypes;
}