import fs from 'fs';
import path from 'path';
import auditDb from '../models/audit-lowdb.js';
import { assertExportPathInAllowedRoot } from '../utils/sanitize-path.utils.js';

// Helper function to build Contentstack management URLs
const buildContentstackUrl = (region: string, stackId: string, type: 'asset' | 'entry' | 'content-type' | 'global-field', uid: string, contentType?: string, locale?: string) => {
  const baseUrl = region === 'EU' ? 'https://eu-app.contentstack.com' : 'https://app.contentstack.com';

  switch (type) {
    case 'asset':
      return `${baseUrl}/#!/stack/${stackId}/assets/${uid}`;
    case 'entry':
      return `${baseUrl}/#!/stack/${stackId}/content-type/${contentType}${locale ? `/${locale}` : ''}/entry/${uid}/edit`;
    case 'content-type':
      return `${baseUrl}/#!/stack/${stackId}/content-type/${uid}/content-type-builder`;
    case 'global-field':
      return `${baseUrl}/#!/stack/${stackId}/global-field/${uid}/global-field-builder`;
    default:
      return null;
  }
};

const readJson = async (filePath: string) => {
  const raw = await fs.promises.readFile(filePath, 'utf8');
  return JSON.parse(raw || '{}');
};

const collectEntryFiles = async (entriesDir: string) => {
  const files: string[] = [];
  const contentTypes = await fs.promises.readdir(entriesDir, { withFileTypes: true });
  for (const ct of contentTypes) {
    if (!ct.isDirectory()) continue;
    const ctPath = path.join(entriesDir, ct.name);
    const locales = await fs.promises.readdir(ctPath, { withFileTypes: true });
    for (const locale of locales) {
      if (!locale.isDirectory()) continue;
      const localePath = path.join(ctPath, locale?.name);
      const localeFiles = await fs.promises.readdir(localePath);
      for (const file of localeFiles) {
        if (!file.endsWith('.json') || file === 'index.json') continue;
        files.push(path.join(localePath, file));
      }
    }
  }
  return files;
};

const flattenAssetRecords = (assetContainer: any): any[] => {
  if (Array.isArray(assetContainer)) return assetContainer;
  if (!assetContainer || typeof assetContainer !== 'object') return [];
  return Object.values(assetContainer).flatMap((entry) =>
    Array.isArray(entry) ? entry : [entry]
  );
};

export const generateAuditData = async ({
  projectId,
  orgId,
  stackId,
  exportPath,
  region = 'US',
}: {
  projectId: string;
  orgId: string;
  stackId: string;
  exportPath: string;
  region?: string;
}) => {
  // Re-validate against the allowlist of export roots and rebuild a fresh
  // path string. Breaks the taint chain from HTTP params → fs.readFile.
  const safeExportPath = assertExportPathInAllowedRoot(exportPath);
  const assetsPath = path.join(safeExportPath, 'assets', 'assets.json');
  const entriesDir = path.join(safeExportPath, 'entries');
  const contentTypesDir = path.join(safeExportPath, 'content_types');
  const globalFieldsDir = path.join(safeExportPath, 'global_fields');

  const assetIndex = await readJson(assetsPath);
  const assets: any[] = [];
  for (const value of Object.values(assetIndex as Record<string, string>)) {
    const shardPath = path.join(safeExportPath, 'assets', String(value));
    if (!fs.existsSync(shardPath)) continue;
    const shardData = await readJson(shardPath);
    const normalized = flattenAssetRecords(shardData);
    for (const item of normalized) {
      assets.push({
        uid: item?.uid,
        filename: item?.filename,
        isPublished: Array.isArray(item?.publish_details) && item?.publish_details?.length > 0,
        isReferred: false,
        url: buildContentstackUrl(region, stackId, 'asset', item?.uid),
      });
    }
  }

  const assetUidSet = new Set(assets.map((a) => a.uid).filter(Boolean));
  const entryFiles = await collectEntryFiles(entriesDir);
  const entryAudit: any[] = [];
  const contentTypeEntryCount: Record<string, number> = {};
  const globalFieldUsage = new Set<string>();

  for (const entryFile of entryFiles) {
    const locale = path.basename(path.dirname(entryFile));
    const contentType = path.basename(path.dirname(path.dirname(entryFile)));
    const parsed = await readJson(entryFile);
    for (const [entryUid, entryData] of Object.entries<any>(parsed)) {
      contentTypeEntryCount[contentType] = (contentTypeEntryCount[contentType] || 0) + 1;
      const payload = JSON.stringify(entryData);
      for (const asset of assets) {
        if (asset.uid && payload.includes(asset.uid)) {
          asset.isReferred = true;
        }
      }

      entryAudit.push({
        contentType,
        entryUid,
        locale,
        title: entryData?.title || entryData?.name || entryData?.label || `${contentType}_${entryUid.slice(-8)}`,
        isPublished:
          Array.isArray(entryData?.publish_details) &&
          entryData?.publish_details?.length > 0,
        isEmpty: !entryData || Object.keys(entryData)?.length === 0,
        url: buildContentstackUrl(region, stackId, 'entry', entryUid, contentType, locale),
      });

      const match = payload.match(/"reference_to":"([^"]+)"/g);
      if (match) {
        for (const m of match) {
          const uid = m.split(':')[1]?.replace(/"/g, '');
          if (uid) globalFieldUsage.add(uid);
        }
      }
    }
  }

  const contentTypeFiles = (await fs.promises.readdir(contentTypesDir)).filter(
    (file) => file.endsWith('.json') && file !== 'schema.json'
  );
  const contentTypeAudit = [];
  for (const file of contentTypeFiles) {
    const ct = await readJson(path.join(contentTypesDir, file));
    const uid = ct?.uid || file.replace('.json', '');
    const count = contentTypeEntryCount[uid] || 0;
    contentTypeAudit.push({
      uid,
      title: ct?.title || uid,
      isEmpty: count === 0,
      isUnused: count === 0,
      url: buildContentstackUrl(region, stackId, 'content-type', uid),
    });
  }

  const globalFieldAudit = [];
  if (fs.existsSync(globalFieldsDir)) {
    const gfFiles = (await fs.promises.readdir(globalFieldsDir)).filter((f) =>
      f.endsWith('.json')
    );
    for (const file of gfFiles) {
      const gfData = await readJson(path.join(globalFieldsDir, file));
      
      // Check if it's an array of global fields (standard Contentstack export format)
      if (Array.isArray(gfData)) {
        for (const gf of gfData) {
          const uid = gf?.uid;
          if (uid) {
            globalFieldAudit.push({
              uid,
              title: gf?.title || uid,
              isUnused: !globalFieldUsage.has(uid),
              isEmpty: !gf?.schema || gf?.schema?.length === 0,
              url: buildContentstackUrl(region, stackId, 'global-field', uid),
            });
          }
        }
      } else if (gfData?.uid) {
        // Handle single global field object (fallback)
        const uid = gfData.uid;
        globalFieldAudit.push({
          uid,
          title: gfData?.title || uid,
          isUnused: !globalFieldUsage.has(uid),
          isEmpty: !gfData?.schema || gfData.schema.length === 0,
          url: buildContentstackUrl(region, stackId, 'global-field', uid),
        });
      }
    }
  }

  const unusedAssets = assets.filter((asset) => !asset.isReferred);
  const unpublishedEntries = entryAudit.filter((entry) => !entry.isPublished);
  const emptyContentTypes = contentTypeAudit.filter((ct) => ct.isEmpty);
  const unusedGlobalFields = globalFieldAudit.filter((gf) => gf.isUnused);

  await auditDb.upsertAudit({
    project_id: projectId,
    org_id: orgId,
    stack_id: stackId,
    assets: unusedAssets,
    entries: unpublishedEntries,
    content_types: emptyContentTypes,
    global_fields: unusedGlobalFields,
  });

  return {
    summary: {
      unused_assets: unusedAssets?.length,
      unpublished_entries: unpublishedEntries?.length,
      empty_content_types: emptyContentTypes?.length,
      unused_global_fields: unusedGlobalFields?.length,
    },
    assets: unusedAssets,
    entries: unpublishedEntries,
    content_types: emptyContentTypes,
    global_fields: unusedGlobalFields,
  };
};

