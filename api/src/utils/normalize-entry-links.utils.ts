import fs from 'fs';
import path from 'path';

const normalizeLinkValue = (val: any): any => {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return val;
  // Legacy CS link format: {url: "...", title: "..."} → {href: "...", title: "..."}
  if (typeof val.url === 'string' && !('href' in val)) {
    const { url, ...rest } = val;
    return { ...rest, href: url };
  }
  return val;
};

const applySchemaToData = (schema: any[], data: any): any => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const result = { ...data };

  for (const field of schema) {
    const uid = field?.uid;
    const dt = field?.data_type;
    if (!(uid in result)) continue;

    if (dt === 'link') {
      result[uid] = field?.multiple && Array.isArray(result[uid])
        ? result[uid]?.map(normalizeLinkValue)
        : normalizeLinkValue(result[uid]);
    } else if (dt === 'group') {
      const subSchema: any[] = field?.schema || [];
      result[uid] = field?.multiple && Array.isArray(result[uid])
        ? result[uid]?.map((item: any) => applySchemaToData(subSchema, item))
        : applySchemaToData(subSchema, result[uid]);
    } else if (dt === 'blocks' && Array.isArray(result[uid])) {
      const blockMap: Record<string, any[]> = {};
      for (const block of field?.blocks || []) {
        blockMap[block?.uid] = block?.schema || [];
      }
      result[uid] = result[uid]?.map((item: any) => {
        const blockKey = Object.keys(item).find((k) => k !== '_metadata' && blockMap[k]);
        if (blockKey) {
          return { ...item, [blockKey]: applySchemaToData(blockMap[blockKey], item[blockKey]) };
        }
        return item;
      });
    }
  }

  return result;
};

/**
 * Walks a content-type schema and rewrites the default_value of every `link`
 * field from the legacy `{title, url}` shape to the canonical `{title, href}`
 * shape. The Contentstack CLI infers a link field's value shape from this
 * default_value at import time, so leaving the legacy shape in place can
 * cause the destination CT to be created with `url` as plain text instead of
 * a Link field — which then rejects every entry that uses the proper
 * `{title, href}` shape.
 *
 * Recurses through `group` schemas and `blocks` to catch nested link fields.
 */
const normalizeSchemaLinkDefaults = (schema: any[]): boolean => {
  if (!Array.isArray(schema)) return false;
  let changed = false;
  for (const field of schema) {
    if (!field || typeof field !== 'object') continue;
    if (field.data_type === 'link') {
      const dv = field?.field_metadata?.default_value;
      if (dv && typeof dv === 'object' && typeof dv.url === 'string' && !('href' in dv)) {
        const { url, ...rest } = dv;
        field.field_metadata.default_value = { ...rest, href: url };
        changed = true;
      }
    } else if (field.data_type === 'group' && Array.isArray(field?.schema)) {
      if (normalizeSchemaLinkDefaults(field.schema)) changed = true;
    } else if (field.data_type === 'blocks' && Array.isArray(field?.blocks)) {
      for (const block of field.blocks) {
        if (Array.isArray(block?.schema) && normalizeSchemaLinkDefaults(block.schema)) {
          changed = true;
        }
      }
    }
  }
  return changed;
};

/**
 * Normalizes link field values in all entry JSON files within a Contentstack export directory.
 * Converts legacy {url: "..."} format to the expected {href: "..."} format.
 */
export const normalizeLinkFieldsInExport = (exportPath: string): void => {
  const ctDir = path.join(exportPath, 'content_types');
  const entriesDir = path.join(exportPath, 'entries');
  if (!fs.existsSync(ctDir) || !fs.existsSync(entriesDir)) return;

  // Build schema map from individual CT files (skip combined schema.json).
  // Also rewrite each CT file's link-field default_value in place so the CLI
  // creates the destination field as a Link (not Text).
  const schemaMap: Record<string, any[]> = {};
  for (const ctFile of fs.readdirSync(ctDir)) {
    if (!ctFile.endsWith('.json') || ctFile === 'schema.json') continue;
    const ctUid = path.basename(ctFile, '.json');
    try {
      const ctPath = path.join(ctDir, ctFile);
      const ct = JSON.parse(fs.readFileSync(ctPath, 'utf8'));
      const schema = ct?.schema || [];
      if (normalizeSchemaLinkDefaults(schema)) {
        fs.writeFileSync(ctPath, JSON.stringify(ct, null, 2));
      }
      schemaMap[ctUid] = schema;
    } catch {
      // skip unreadable files
    }
  }

  for (const ctUid of fs.readdirSync(entriesDir, { withFileTypes: true })
    .filter((d) => d?.isDirectory())
    .map((d) => d?.name)) {
    const schema = schemaMap[ctUid];
    if (!schema) continue;

    const ctEntryDir = path.join(entriesDir, ctUid);
    for (const localeEntry of fs.readdirSync(ctEntryDir, { withFileTypes: true })) {
      if (!localeEntry.isDirectory()) continue;
      const localeDir = path.join(ctEntryDir, localeEntry?.name);

      for (const entryFile of fs.readdirSync(localeDir)) {
        if (!entryFile.endsWith('-entries.json')) continue;
        const filePath = path.join(localeDir, entryFile);
        try {
          const entries = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const normalized: Record<string, any> = {};
          let modified = false;

          for (const [uid, entry] of Object.entries(entries)) {
            const normalizedEntry = applySchemaToData(schema, entry);
            normalized[uid] = normalizedEntry;
            if (JSON.stringify(normalizedEntry) !== JSON.stringify(entry)) {
              modified = true;
            }
          }

          if (modified) {
            fs.writeFileSync(filePath, JSON.stringify(normalized, null, 2));
          }
        } catch {
          // skip unreadable entry files
        }
      }
    }
  }
};
