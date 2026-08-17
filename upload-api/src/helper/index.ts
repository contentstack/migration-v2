import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';
import xml2js from 'xml2js';
import { HTTP_TEXTS, HTTP_CODES, MACOSX_FOLDER } from '../constants';
import logger from '../utils/logger';
import { getConfigFilePaths } from '../utils/hydrate-config';

const getFileName = (params: { Key: string }) => {
  const obj: { fileName?: string; fileExt?: string } = {};
  //fine Name
  obj.fileName = params?.Key?.split?.('/')?.pop?.();
  //file ext from fileName
  obj.fileExt = obj?.fileName?.split?.('.')?.pop?.();
  return obj;
};

/**
 * Splits a file path and returns the first folder or file name.
 * Example: "umesh/items/master/sitecore/content" => "umesh"
 */
function getFirstNameFromFilename(filename: string): string {
  if (!filename) return '';
  // Split by both Unix and Windows separators
  const parts = filename.split(/[\\/]/);
  return parts[0] || '';
}

const saveZip = async (zip: any, name: string) => {
  try {
    const JSZip = require('jszip');
    const newMainFolderName = name;
    const keys = Object.keys(zip.files);
    let filePathSaved = undefined;
    const sitecoreFolders = ['blob', 'installer', 'items', 'metadata', 'properties'];

    for await (const filename of keys) {
      const file = zip.files[filename];
      if (!file.dir) {
        // Check if this is a nested zip file that might contain Sitecore structure
        if (filename.toLowerCase().endsWith('.zip')) {
          try {
            const nestedZipBuffer = await file.async('nodebuffer');
            const nestedZip = new JSZip();
            await nestedZip.loadAsync(nestedZipBuffer);

            // Check if nested zip contains Sitecore folders
            const nestedKeys = Object.keys(nestedZip.files);
            const hasSitecoreFolders = sitecoreFolders.some((folder) =>
              nestedKeys.some((key) => key.includes(`/${folder}/`) || key.startsWith(`${folder}/`))
            );

            if (hasSitecoreFolders) {
              // Extract the nested zip contents
              for await (const nestedFilename of nestedKeys) {
                const nestedFile = nestedZip.files[nestedFilename];
                if (!nestedFile.dir) {
                  const nestedFilePath = path.join(
                    newMainFolderName,
                    'nested-extracted',
                    nestedFilename
                  );
                  const fullNestedPath = path.join(
                    __dirname,
                    '..',
                    '..',
                    'extracted_files',
                    nestedFilePath
                  );

                  if (!fullNestedPath.includes(MACOSX_FOLDER)) {
                    await fs.promises.mkdir(path.dirname(fullNestedPath), { recursive: true });
                    const nestedContent = await nestedFile.async('nodebuffer');
                    await fs.promises.writeFile(fullNestedPath, nestedContent);
                  }
                }
              }
              // Set the filePathSaved to indicate we found nested Sitecore content
              if (!filePathSaved) {
                filePathSaved = 'nested-extracted';
              }
            } else {
              // Save the zip file itself if it doesn't contain Sitecore structure
              const zipFilePath = path.join(newMainFolderName, filename);
              const fullZipPath = path.join(__dirname, '..', '..', 'extracted_files', zipFilePath);
              await fs.promises.mkdir(path.dirname(fullZipPath), { recursive: true });
              const zipContent = await file.async('nodebuffer');
              await fs.promises.writeFile(fullZipPath, zipContent);
            }
          } catch (nestedError: any) {
            // Save the zip file as-is if we can't process it
            const zipFilePath = path.join(newMainFolderName, filename);
            const fullZipPath = path.join(__dirname, '..', '..', 'extracted_files', zipFilePath);
            await fs.promises.mkdir(path.dirname(fullZipPath), { recursive: true });
            const zipContent = await file.async('nodebuffer');
            await fs.promises.writeFile(fullZipPath, zipContent);
          }
        } else {
          // Handle regular files
          let newFilePath = filename;
          if (
            !filename.startsWith(newMainFolderName + path.sep) &&
            !filename.startsWith(newMainFolderName + '/')
          ) {
            newFilePath = path.join(newMainFolderName, filename);
            if (
              !filename?.includes?.(MACOSX_FOLDER) &&
              sitecoreFolders?.includes?.(getFirstNameFromFilename(filename)) === false
            ) {
              filePathSaved = getFirstNameFromFilename(filename);
            }
          }
          const filePath = path.join(__dirname, '..', '..', 'extracted_files', newFilePath);
          if (!filePath.includes(MACOSX_FOLDER)) {
            await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
            const content = await file.async('nodebuffer');
            await fs.promises.writeFile(filePath, content);
          }
        }
      }
    }
    return { isSaved: true, filePath: filePathSaved };
  } catch (err: any) {
    console.error(err);
    logger.info('Zipfile error:', {
      status: HTTP_CODES?.SERVER_ERROR,
      message: HTTP_TEXTS?.ZIP_FILE_SAVE
    });
    return { isSaved: false, filePath: undefined };
  }
};

const saveJson = async (jsonContent: string, fileName: string) => {
  try {
    const filePath = path.join(__dirname, '..', '..', 'extracted_files', fileName);
    // Ensure the directory exists asynchronously /extracted_files
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

    const data =
      typeof jsonContent == 'object' ? JSON.stringify(jsonContent, null, 4) : jsonContent || '{}';
    // Write the XML content to the file asynchronously
    await fs.promises.writeFile(filePath, data, 'utf8');

    return true;
  } catch (err: any) {
    console.error(err);
    logger.info('JSON file error while saving:', {
      status: HTTP_CODES?.SERVER_ERROR,
      message: HTTP_TEXTS?.XML_FILE_SAVE
    });
    return false;
  }
};

const cleanXml = (xml: string): string => {
  return xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!DOCTYPE[^>]*>/g, '')
    .trim();
};

// parse xml to json
const parseXmlToJson = async (xml: any) => {
  try {
    const xmldata = cleanXml(xml);

    const parser = new xml2js.Parser({
      attrkey: 'attributes',
      charkey: 'text',
      explicitArray: false,
      trim: true,
      normalize: true,
      normalizeTags: true
    });
    const data = await parser.parseStringPromise(xmldata);
    return data;
  } catch (err) {
    console.error(err);
    logger.info('XML file error:', {
      status: HTTP_CODES?.SERVER_ERROR,
      message: HTTP_TEXTS?.XML_FILE_SAVE
    });
    return false;
  }
};

const toArray = (v: any): any[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

/**
 * Merge several parsed WXR documents (parseXmlToJson output) into one channel, so a folder of
 * per-post-type exports (e.g. blog + case study + videos) imports as a single stack. Items are
 * concatenated; authors, categories and terms are de-duplicated (same-site exports repeat these).
 * The first document seeds the channel header. Returns one parsed doc shaped exactly like a single
 * upload, so the entire downstream pipeline (extractors + API entry generation) runs unchanged.
 */
const mergeWordpressJson = (parsedDocs: any[]): any => {
  const docs = (parsedDocs || []).filter((d) => d?.rss?.channel);
  if (docs.length === 0) return parsedDocs?.[0];
  const base = docs[0];
  const channel = base.rss.channel;
  const items: any[] = [];
  const authors = new Map<string, any>();
  const categories = new Map<string, any>();
  const terms = new Map<string, any>();
  for (const d of docs) {
    const ch = d.rss.channel;
    for (const it of toArray(ch.item)) items.push(it);
    for (const a of toArray(ch['wp:author'])) {
      const key = String(a?.['wp:author_login'] ?? a?.['wp:author_id'] ?? JSON.stringify(a));
      if (!authors.has(key)) authors.set(key, a);
    }
    for (const c of toArray(ch['wp:category'])) {
      const key = String(c?.['wp:category_nicename'] ?? c?.['wp:cat_name'] ?? JSON.stringify(c));
      if (!categories.has(key)) categories.set(key, c);
    }
    for (const t of toArray(ch['wp:term'])) {
      const key = `${t?.['wp:term_taxonomy'] ?? ''}:${t?.['wp:term_slug'] ?? t?.['wp:term_name'] ?? JSON.stringify(t)}`;
      if (!terms.has(key)) terms.set(key, t);
    }
  }
  channel.item = items;
  if (authors.size) channel['wp:author'] = [...authors.values()];
  if (categories.size) channel['wp:category'] = [...categories.values()];
  if (terms.size) channel['wp:term'] = [...terms.values()];
  return base;
};

// Postmeta keys that hold an attachment-id reference to a media asset (customer_logo, _thumbnail_id,
// ACF image/file fields, …). Scanning only these keys avoids mistaking numeric counters/flags (e.g.
// case_study_content=5) for asset ids.
const REFERENCE_META_KEY_RE = /(logo|image|thumb|thumbnail|photo|icon|media|badge|avatar|gallery|banner|file|_id)$|(logo|image|thumb|photo|icon|media|badge|avatar|gallery|banner)/i;

// WordPress stamps the attachment id of an inline image straight onto the <img> tag as a
// `wp-image-{id}` CSS class (added by the classic/block editor whenever media-library media is
// inserted into post body content). Postmeta scanning alone misses these — the id never lands on
// a postmeta row when the image was dropped into the body instead of a featured-image/ACF field.
const WP_IMAGE_CLASS_RE = /wp-image-(\d+)/g;

/**
 * Collect the attachment ids referenced by structured fields (postmeta) across the given WXR docs —
 * e.g. `customer_logo`, `_thumbnail_id` (featured image), ACF image fields — plus any attachment ids
 * embedded inline in post body content via the `wp-image-{id}` class WordPress adds to `<img>` tags.
 * Used to pull just the referenced assets out of an otherwise-excluded media-library export.
 */
const collectReferencedAttachmentIds = (docs: any[]): Set<string> => {
  const ids = new Set<string>();
  for (const d of docs || []) {
    const ch = d?.rss?.channel;
    if (!ch) continue;
    for (const it of toArray(ch.item)) {
      for (const m of toArray(it?.['wp:postmeta'])) {
        const key = m?.['wp:meta_key'];
        if (typeof key !== 'string' || !REFERENCE_META_KEY_RE.test(key)) continue;
        const s = String(m?.['wp:meta_value'] ?? '').trim();
        if (/^\d+$/.test(s)) ids.add(s);
      }
      const content = it?.['content:encoded'];
      if (typeof content === 'string') {
        for (const match of content.matchAll(WP_IMAGE_CLASS_RE)) ids.add(match[1]);
      }
    }
  }
  return ids;
};

/**
 * Trim media-library docs (pure-attachment WXR exports) down to ONLY the attachments referenced by the
 * content docs. Keeps referenced logos/featured images while dropping the thousands of unreferenced
 * library assets. Returns the trimmed docs plus counts for logging.
 */
const filterMediaDocsToReferenced = (
  contentDocs: any[],
  mediaDocs: any[]
): { docs: any[]; kept: number; dropped: number } => {
  const referenced = collectReferencedAttachmentIds(contentDocs);
  let kept = 0;
  let dropped = 0;
  const out: any[] = [];
  for (const d of mediaDocs || []) {
    const ch = d?.rss?.channel;
    if (!ch) continue;
    const keepItems = toArray(ch.item).filter((it: any) => {
      const isRef =
        it?.['wp:post_type'] === 'attachment' &&
        referenced.has(String(it?.['wp:post_id'] ?? ''));
      if (isRef) kept++;
      else dropped++;
      return isRef;
    });
    if (keepItems.length) {
      out.push({ ...d, rss: { ...d.rss, channel: { ...ch, item: keepItems } } });
    }
  }
  return { docs: out, kept, dropped };
};

const fileOperationLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 2, // Limit each IP to 2 requests per windowMs for this endpoint
  message: {
    status: 'rate limit',
    message: 'Rate limit exceeded. Only 2 calls allowed every 2 minutes.'
  }
});

function deleteFolderSync(folderPath: string): void {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file: string) => {
      const currentPath: string = path.join(folderPath, file);
      if (fs.lstatSync(currentPath).isDirectory()) {
        // Recurse
        deleteFolderSync(currentPath);
      } else {
        // Delete file
        fs.unlinkSync(currentPath);
      }
    });
    // Delete now-empty folder
    fs.rmdirSync(folderPath);
  }
}

interface MySQLDetails {
  host?: string;
  database?: string;
  user?: string;
}

async function updateConfigFile(
  filePath?: string,
  mysqlDetails?: MySQLDetails
): Promise<any | undefined> {
  try {
    const { src: configFilePath } = getConfigFilePaths();
    const config: any = JSON.parse(await fs.promises.readFile(configFilePath, 'utf8'));

    const isDrupal = String(config?.cmsType).toLowerCase() === 'drupal';

    // Only treat mysqlDetails as meaningful when at least one field is a non-empty string,
    // so empty/undefined payloads don't trigger an unnecessary config write below.
    const { host, database, user } = mysqlDetails ?? {};
    const hasMysqlDetails =
      isDrupal && !!(host?.trim() || database?.trim() || user?.trim());

    // For drupal the source is a MySQL DB. Persist the host/database/user the user
    // entered in the UI ("Check Connection") into config.mysql, preserving the other
    // mysql fields (e.g. port, password).
    if (hasMysqlDetails) {
      config.mysql = {
        ...config.mysql,
        ...(host?.trim() ? { host: host.trim() } : {}),
        ...(database?.trim() ? { database: database.trim() } : {}),
        ...(user?.trim() ? { user: user.trim() } : {})
      };
    }

    // If filePath is provided and not empty, update the config file
    if (filePath && typeof filePath === 'string' && filePath.trim() !== '') {
      const trimmed = filePath.trim();
      // "sql" is a sentinel for MySQL validation (routes/index.ts), not a filesystem path.
      // For drupal the source is a MySQL DB, so localPath must stay "sql" rather than a
      // resolved path. path.resolve("sql") would incorrectly become <cwd>/sql and break SQL mode.
      const resolvedFilePath =
        isDrupal || trimmed.toLowerCase() === 'sql' ? 'sql' : path.resolve(trimmed);

      const updatedConfig = {
        ...config,
        localPath: resolvedFilePath
      };

      const configContent = JSON.stringify(updatedConfig, null, 2);
      await fs.promises.writeFile(configFilePath, configContent, 'utf8');

      return updatedConfig;
    }

    // No filePath, but drupal mysql details changed — persist them and return updated config.
    if (hasMysqlDetails) {
      const configContent = JSON.stringify(config, null, 2);
      await fs.promises.writeFile(configFilePath, configContent, 'utf8');
    }

    return config;
  } catch (error) {
    logger.error('Error updating config file', { err: error });
    return undefined;
  }
}

export { getFileName, saveZip, saveJson, fileOperationLimiter, deleteFolderSync, parseXmlToJson, mergeWordpressJson, filterMediaDocsToReferenced, updateConfigFile };
