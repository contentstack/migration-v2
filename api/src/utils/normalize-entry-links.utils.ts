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
    const uid = field.uid;
    const dt = field.data_type;
    if (!(uid in result)) continue;

    if (dt === 'link') {
      result[uid] = field.multiple && Array.isArray(result[uid])
        ? result[uid].map(normalizeLinkValue)
        : normalizeLinkValue(result[uid]);
    } else if (dt === 'group') {
      const subSchema: any[] = field.schema || [];
      result[uid] = field.multiple && Array.isArray(result[uid])
        ? result[uid].map((item: any) => applySchemaToData(subSchema, item))
        : applySchemaToData(subSchema, result[uid]);
    } else if (dt === 'blocks' && Array.isArray(result[uid])) {
      const blockMap: Record<string, any[]> = {};
      for (const block of field.blocks || []) {
        blockMap[block.uid] = block.schema || [];
      }
      result[uid] = result[uid].map((item: any) => {
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
 * Normalizes link field values in all entry JSON files within a Contentstack export directory.
 * Converts legacy {url: "..."} format to the expected {href: "..."} format.
 */
export const normalizeLinkFieldsInExport = (exportPath: string): void => {
  const ctDir = path.join(exportPath, 'content_types');
  const entriesDir = path.join(exportPath, 'entries');
  if (!fs.existsSync(ctDir) || !fs.existsSync(entriesDir)) return;

  // Build schema map from individual CT files (skip combined schema.json)
  const schemaMap: Record<string, any[]> = {};
  for (const ctFile of fs.readdirSync(ctDir)) {
    if (!ctFile.endsWith('.json') || ctFile === 'schema.json') continue;
    const ctUid = path.basename(ctFile, '.json');
    try {
      const ct = JSON.parse(fs.readFileSync(path.join(ctDir, ctFile), 'utf8'));
      schemaMap[ctUid] = ct.schema || [];
    } catch {
      // skip unreadable files
    }
  }

  for (const ctUid of fs.readdirSync(entriesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)) {
    const schema = schemaMap[ctUid];
    if (!schema) continue;

    const ctEntryDir = path.join(entriesDir, ctUid);
    for (const localeEntry of fs.readdirSync(ctEntryDir, { withFileTypes: true })) {
      if (!localeEntry.isDirectory()) continue;
      const localeDir = path.join(ctEntryDir, localeEntry.name);

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
