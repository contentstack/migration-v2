/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require("fs");
const path = require("path");

// ─── tunables ────────────────────────────────────────────────────────────────
const HEAD_BYTES = 131_072; // 128 KiB – covers item.$.language in all known exports
const CONCURRENCY = Number(process.env.SITECORE_LOCALES_CONCURRENCY) || 24;
const DEBUG = process.env.DEBUG_SITECORE_LOCALES === "1";

// Matches  "language": "en-US"  anywhere in the head window
const LANG_RE = /"language"\s*:\s*"([^"]{1,64})"/;

// Hoisted once – never recreated in the hot path
// Combines your original Sitecore system dirs + filesystem noise dirs
const SKIP_DIRS = new Set([
  "__Standard Values",
  "__Prototypes",
  "__Masters",
  "blob",
  "media library",
  "node_modules",
  ".git",
  "__MACOSX",
]);

// ─── phase 1: collect all data.json paths ────────────────────────────────────

async function collectPaths(dir, results = []) {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.error(`[extractLocales] cannot read dir ${dir}:`, err.message);
    return results;
  }

  const subdirs = [];

  for (const entry of entries) {
    // Match your original logic: skip if any skipDir is a substring of the name
    if ([...SKIP_DIRS].some((s) => entry.name.includes(s))) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      subdirs.push(full);
    } else if (entry.isFile() && entry.name === "data.json") {
      results.push(full);
    }
  }

  await Promise.all(subdirs.map((d) => collectPaths(d, results)));
  return results;
}

// ─── phase 2: extract language from one file ─────────────────────────────────

async function extractLanguage(filePath) {
  let fd;
  try {
    // Fast path — read only the first 128 KiB
    fd = await fs.promises.open(filePath, "r");
    const buf = Buffer.allocUnsafe(HEAD_BYTES);
    const { bytesRead } = await fd.read(buf, 0, HEAD_BYTES, 0);
    await fd.close();
    fd = null;

    const head = buf.toString("utf8", 0, bytesRead);
    const m = LANG_RE.exec(head);

    if (m) {
      if (DEBUG) console.debug(`[fast]     ${filePath} → ${m[1]}`);
      return m[1];
    }

    // Fallback — full parse (identical to original behaviour)
    if (DEBUG) console.debug(`[fallback] ${filePath}`);
    const raw = await fs.promises.readFile(filePath, "utf8");
    const json = JSON.parse(raw);
    return json?.item?.$?.language ?? null;

  } catch (err) {
    console.error(`[extractLocales] error reading ${filePath}:`, err.message);
    return null;
  } finally {
    if (fd) await fd.close().catch(() => { });
  }
}

// ─── phase 3: bounded-concurrency processing ─────────────────────────────────

async function processWithConcurrency(paths, concurrency) {
  const locales = new Set();
  const total = paths.length;
  let idx = 0;
  let scanned = 0;

  async function worker() {
    while (idx < paths.length) {
      const filePath = paths[idx++];
      const lang = await extractLanguage(filePath);
      if (lang) locales.add(lang);
      scanned++;
      if (scanned % 100 === 0) {
        console.info(
          `[extractLocales] progress: ${scanned}/${total} files scanned, ${locales.size} unique locale(s) found`
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, paths.length) }, worker)
  );

  return locales;
}

// ─── public API ──────────────────────────────────────────────────────────────

/**
 * Walk `dir` and return a Set of all unique locale strings found in data.json files.
 * Async drop-in replacement for the original synchronous version.
 *
 * @param   {string}           dir
 * @returns {Promise<Set<string>>}
 */
const extractLocales = async (dir) => {
  console.info("[extractLocales] starting locale extraction from:", dir);
  console.time("[extractLocales] total extraction time");

  const paths = await collectPaths(dir);
  console.info(`[extractLocales] found ${paths.length} data.json files`);

  const locales = await processWithConcurrency(paths, CONCURRENCY);

  console.timeEnd("[extractLocales] total extraction time");
  console.info(
    `[extractLocales] done — ${paths.length} files scanned, ${locales.size} unique locale(s):`,
    Array.from(locales)
  );

  return locales;
};

module.exports = extractLocales;
