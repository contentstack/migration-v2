/* eslint-disable @typescript-eslint/no-var-requires */
const fs = require('fs');
const path = require('path');

function contentfulSchemeIdToStackTaxonomyUid(contentfulSchemeId) {
  if (!contentfulSchemeId || typeof contentfulSchemeId !== 'string') return '';
  return contentfulSchemeId
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Display name for mapper UI (product_category -> Product Category). */
function humanizeSchemeId(id) {
  if (!id || typeof id !== 'string') return '';
  return id
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Collects unique TaxonomyConceptScheme ids from Contentful export content types (`metadata.taxonomy`).
 *
 * @param {string} filePath - Absolute path to the Contentful export JSON.
 * @returns {Promise<Array<{ uid: string, name: string }>>}
 */
const extractTaxonomy = async (filePath) => {
  const raw = await fs.promises.readFile(filePath, 'utf8');
  const data = JSON.parse(raw);
  const contentTypes = data?.contentTypes || [];
  const schemeIds = new Set();

  for (const ct of contentTypes) {
    const links = ct?.metadata?.taxonomy;
    if (!Array.isArray(links)) continue;
    for (const link of links) {
      const sid = link?.sys?.id;
      if (!sid) continue;
      const uid = contentfulSchemeIdToStackTaxonomyUid(sid);
      if (uid) schemeIds.add(uid);
    }
  }

  const taxonomySchema = [...schemeIds].sort().map((uid) => ({
    uid,
    name: humanizeSchemeId(uid) || uid,
  }));

  const outputDir = path.join(process.cwd(), 'contentfulMigrationData', 'taxonomySchema');
  await fs.promises.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, 'taxonomySchema.json');
  await fs.promises.writeFile(outputPath, JSON.stringify(taxonomySchema, null, 2));

  return taxonomySchema;
};

module.exports = extractTaxonomy;
