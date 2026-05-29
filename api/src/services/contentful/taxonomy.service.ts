import fs from 'fs';
import path from 'path';
import { getLogMessage } from '../../utils/index.js';
import customLogger from '../../utils/custom-logger.utils.js';
import { MIGRATION_DATA_CONFIG } from '../../constants/index.js';

const { DATA, TAXONOMIES_DIR_NAME, TAXONOMIES_FILE_NAME } = MIGRATION_DATA_CONFIG;

/**
 * Contentful export uses scheme ids like `productCategory`. Contentstack taxonomy UIDs must be
 * lowercase alphanumeric + underscores only (no camelCase).
 */
export function contentfulSchemeIdToStackTaxonomyUid(contentfulSchemeId: string): string {
  if (!contentfulSchemeId || typeof contentfulSchemeId !== 'string') return '';
  return contentfulSchemeId
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Maps Contentful concept id prefix (before first "-") to Contentstack taxonomy uid (sanitized). */
export const CONCEPT_PREFIX_TO_SCHEME: Record<string, string> = {
  brd: 'brand',
  cat: 'product_category',
  branch: 'branch',
  dis: 'discipline',
};

export function inferSchemeFromConceptId(conceptId: string): string | null {
  if (!conceptId || typeof conceptId !== 'string') return null;
  const prefix = conceptId.split('-')[0];
  return CONCEPT_PREFIX_TO_SCHEME[prefix] ?? null;
}

export function sanitizeTermUid(conceptId: string): string {
  return conceptId
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function humanizeSchemeId(id: string): string {
  if (!id) return '';
  const words = id.split('_').filter(Boolean);
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function buildContentfulTaxonomyAssignments(
  concepts: Array<{ sys?: { id?: string } }> | undefined,
  allowedSchemeIds: string[],
): Array<{ taxonomy_uid: string; term_uid: string }> {
  const allow = (allowedSchemeIds || []).filter(Boolean);
  const allowSet = new Set(
    allow.map((id) => contentfulSchemeIdToStackTaxonomyUid(id)).filter(Boolean),
  );
  const useAllow = allowSet.size > 0;
  const out: Array<{ taxonomy_uid: string; term_uid: string }> = [];
  const seen = new Set<string>();

  for (const c of concepts || []) {
    const id = c?.sys?.id;
    if (!id) continue;
    const scheme = inferSchemeFromConceptId(id);
    if (!scheme) continue;
    if (useAllow && !allowSet.has(scheme)) continue;
    const termUid = sanitizeTermUid(id);
    const key = `${scheme}::${termUid}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ taxonomy_uid: scheme, term_uid: termUid });
  }
  return out;
}

interface TaxonomyTerm {
  uid: string;
  name: string;
  parent_uid: string | null;
  description?: string;
  contentful_concept_id: string;
}

interface TaxonomyStructure {
  taxonomy: {
    uid: string;
    name: string;
    description: string;
  };
  terms: TaxonomyTerm[];
}

const saveTaxonomyFiles = async (
  taxonomies: Record<string, TaxonomyStructure>,
  taxonomiesPath: string,
  projectId: string,
  destination_stack_id: string,
): Promise<void> => {
  for (const [schemeUid, taxonomy] of Object.entries(taxonomies)) {
    const filePath = path.join(taxonomiesPath, `${schemeUid}.json`);
    await fs.promises.writeFile(filePath, JSON.stringify(taxonomy, null, 2), 'utf8');
    const message = getLogMessage(
      'saveTaxonomyFiles',
      `Saved taxonomy file: ${schemeUid}.json with ${taxonomy?.terms?.length} terms.`,
      {},
    );
    await customLogger(projectId, destination_stack_id, 'info', message);
  }

  const taxonomiesDataObject: Record<string, any> = {};
  for (const [schemeUid, taxonomy] of Object.entries(taxonomies)) {
    taxonomiesDataObject[schemeUid] = {
      uid: taxonomy?.taxonomy?.uid,
      name: taxonomy?.taxonomy?.name,
      description: taxonomy?.taxonomy?.description,
    };
  }

  const taxonomiesFilePath = path.join(taxonomiesPath, TAXONOMIES_FILE_NAME);
  await fs.promises.writeFile(
    taxonomiesFilePath,
    JSON.stringify(taxonomiesDataObject, null, 2),
    'utf8',
  );
  await customLogger(
    projectId,
    destination_stack_id,
    'info',
    getLogMessage(
      'saveTaxonomyFiles',
      `Saved consolidated ${TAXONOMIES_FILE_NAME} with ${Object.keys(taxonomiesDataObject)?.length} taxonomies.`,
      {},
    ),
  );
};

/**
 * Builds taxonomy vocabularies and terms from a Contentful export JSON (metadata.taxonomy on content types,
 * metadata.concepts on entries) and writes the same layout as Drupal: per-scheme JSON + taxonomies.json.
 */
export const createTaxonomy = async (
  packagePath: string,
  destination_stack_id: string,
  projectId: string,
): Promise<void> => {
  const taxonomiesPath = path.join(DATA, destination_stack_id, TAXONOMIES_DIR_NAME);

  try {
    await fs.promises.mkdir(taxonomiesPath, { recursive: true });
    const raw = await fs.promises.readFile(packagePath, 'utf8');
    const data = JSON.parse(raw);
    const contentTypes = data?.contentTypes || [];
    const entries = data?.entries || [];

    const schemeIds = new Set<string>();
    for (const ct of contentTypes) {
      for (const link of ct?.metadata?.taxonomy || []) {
        const sid = link?.sys?.id;
        if (!sid) continue;
        const schemeUid = contentfulSchemeIdToStackTaxonomyUid(sid);
        if (schemeUid) schemeIds.add(schemeUid);
      }
    }

    const termsByScheme: Record<string, Map<string, string>> = {};
    for (const sid of schemeIds) {
      termsByScheme[sid] = new Map();
    }

    for (const entry of entries) {
      for (const c of entry?.metadata?.concepts || []) {
        const conceptId = c?.sys?.id;
        if (!conceptId) continue;
        const scheme = inferSchemeFromConceptId(conceptId);
        if (!scheme || !termsByScheme[scheme]) continue;
        const termUid = sanitizeTermUid(conceptId);
        if (!termsByScheme[scheme].has(termUid)) {
          termsByScheme[scheme].set(termUid, conceptId);
        }
      }
    }

    const taxonomies: Record<string, TaxonomyStructure> = {};

    for (const schemeUid of schemeIds) {
      const termMap = termsByScheme[schemeUid];
      const terms: TaxonomyTerm[] = [];
      for (const [termUid, conceptId] of termMap) {
        terms.push({
          uid: termUid,
          name: conceptId,
          parent_uid: null,
          description: '',
          contentful_concept_id: conceptId,
        });
      }
      taxonomies[schemeUid] = {
        taxonomy: {
          uid: schemeUid,
          name: humanizeSchemeId(schemeUid) || schemeUid,
          description: 'Imported from Contentful taxonomy',
        },
        terms,
      };
    }

    if (Object.keys(taxonomies)?.length === 0) {
      const message = getLogMessage(
        'createTaxonomy',
        'No Contentful taxonomy schemes found on content types (metadata.taxonomy). Skipping taxonomy files.',
        {},
      );
      await customLogger(projectId, destination_stack_id, 'info', message);
      return;
    }

    await saveTaxonomyFiles(taxonomies, taxonomiesPath, projectId, destination_stack_id);

    const successMessage = getLogMessage(
      'createTaxonomy',
      `Exported ${Object.keys(taxonomies)?.length} Contentful taxonomies.`,
      {},
    );
    await customLogger(projectId, destination_stack_id, 'info', successMessage);
  } catch (err) {
    const message = getLogMessage(
      'createTaxonomy',
      'Error encountered while creating taxonomies from Contentful export.',
      {},
      err,
    );
    await customLogger(projectId, destination_stack_id, 'error', message);
    throw err;
  }
};
