import AdmZip from "adm-zip";

/**
 * Writes a REAL Contentstack export bundle zip — the same folder shape
 * bundle.service.ts already knows how to read back (chunk-pointer files +
 * the real per-module data), so a bundle we write here round-trips through
 * our own file-mode upload/parse path. Pure: no network, no filesystem.
 */
export interface BundleWriterInput {
  contentTypes: any[];
  globalFields: any[];
  assets: any[];
  entriesByContentType: { ctUid: string; entries: any[] }[];
  /** Defaults to "en-us" — the entries folder is per-locale in a real CS bundle. */
  locale?: string;
}

const toUidMap = (items: any[]): Record<string, any> => {
  const map: Record<string, any> = {};
  for (const item of items) {
    if (item?.uid) map[item.uid] = item;
  }
  return map;
};

const addJson = (zip: AdmZip, path: string, data: unknown): void => {
  zip.addFile(path, Buffer.from(JSON.stringify(data, null, 2)));
};

export const buildStackBundleZip = (input: BundleWriterInput): Buffer => {
  const zip = new AdmZip();
  const locale = input.locale ?? "en-us";

  addJson(zip, "content_types/schema.json", input.contentTypes);
  addJson(zip, "global_fields/globalfields.json", input.globalFields);

  // assets/assets.json is always just a chunk pointer in a real CS bundle;
  // the real per-asset data lives in assets/index.json.
  addJson(zip, "assets/assets.json", { "1": "index.json" });
  addJson(zip, "assets/index.json", toUidMap(input.assets));

  for (const { ctUid, entries } of input.entriesByContentType) {
    addJson(zip, `entries/${ctUid}/${locale}/index.json`, { "1": `${locale}.json` });
    addJson(zip, `entries/${ctUid}/${locale}/${locale}.json`, toUidMap(entries));
  }

  addJson(zip, "export-info.json", { contentVersion: 2, exportedAt: new Date().toISOString() });

  return zip.toBuffer();
};
