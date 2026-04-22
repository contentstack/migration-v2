// upload-api/migration-drupal/libs/extractEntries.js

'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Builds per-bundle entry lists for the content mapper (entryMapping).
 * (uidCorrector + `content_type_entries_title_${nid}`) so iteration > 1
 * updates (removeEntriesFromDatabase + entry-update-script) line up with locale JSON keys.
 */

const DEFAULT_PREFIX = 'cs';

function startsWithNumber(str) {
  return typeof str === 'string' && /^\d/.test(str);
}

/** createMapper may pass affix as string | string[] */
function normalizeAffix(prefix) {
  if (prefix == null) {
    return '';
  }
  if (Array.isArray(prefix)) {
    const first = prefix[0];
    return first != null && String(first).trim() !== '' ? String(first) : '';
  }
  const s = String(prefix);
  return s.trim() !== '' ? s : '';
}

/**
 * `uidCorrector` for the `id` branch (no separate `uid`).
 */
function entrySourceUidCorrector({ id, prefix }) {
  const value = id != null && id !== '' ? String(id) : '';
  if (!value) {
    return '';
  }
  const affix = normalizeAffix(prefix);
  const effectivePrefix = affix !== '' ? affix : DEFAULT_PREFIX;
  if (startsWithNumber(value)) {
    return `${effectivePrefix}_${value.replace(/[ -]/g, '_').toLowerCase()}`;
  }
  return value.replace(/[ -]/g, '_').toLowerCase();
}

/**
 * @param {import('mysql2').Connection} connection - Open mysql2 connection
 * @param {string} [prefix] - Stack affix / prefix 
 * @returns {Promise<Record<string, Array<object>>>} Map of Drupal bundle machine name - entryMapping rows
 */
async function extractEntries(connection, prefix) {
  const byBundle = {};
  if (!connection || typeof connection.promise !== 'function') {
    console.warn('extractEntries (Drupal): invalid connection, skipping');
    return byBundle;
  }

  try {
    const query = `
      SELECT nid, title, langcode, type
      FROM node_field_data
      WHERE status = 1
        AND LOWER(type) <> 'profile'
      ORDER BY type, nid, langcode
    `;
    const [rows] = await connection.promise().query(query);

    for (const row of rows) {
      const bundle = row?.type;
      if (!bundle) {
        continue;
      }
      const otherCmsEntryUid = entrySourceUidCorrector({
        id: `content_type_entries_title_${row?.nid}`,
        prefix,
      });
      const entryName = row?.title ? String(row?.title) : `Node ${row?.nid}`;

      if (!byBundle[bundle]) {
        byBundle[bundle] = [];
      }
      byBundle[bundle].push({
        contentTypeUid: bundle,
        entryName,
        language: row?.langcode || '',
        otherCmsEntryUid,
        otherCmsCTName: bundle,
        isUpdate: false,
      });
    }

    const total = Object?.values(byBundle)?.reduce((n, arr) => n + arr?.length, 0);
    console.info(
      `extractEntries (Drupal): ${total} entries across ${Object.keys(byBundle).length} bundle(s)`
    );
    return byBundle;
  } catch (err) {
    console.error('extractEntries (Drupal) error:', err?.message || err);
    return byBundle;
  }
}

module.exports = extractEntries;