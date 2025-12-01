import fs from 'fs';
import path from 'path';
import mysql from 'mysql2';
import { v4 as uuidv4 } from 'uuid';
import { JSDOM } from 'jsdom';
import _ from 'lodash';
import {
  htmlToJson,
  jsonToHtml,
  jsonToMarkdown,
} from '@contentstack/json-rte-serializer';
import { CHUNK_SIZE, MIGRATION_DATA_CONFIG } from '../../constants/index.js';
import { getLogMessage } from '../../utils/index.js';
import customLogger from '../../utils/custom-logger.utils.js';
import { getDbConnection } from '../../helper/index.js';
import {
  analyzeFieldTypes,
  isTaxonomyField,
  isReferenceField,
  isAssetField,
  type TaxonomyFieldMapping,
  type ReferenceFieldMapping,
  type AssetFieldMapping,
} from './field-analysis.service.js';
import FieldFetcherService from './field-fetcher.service.js';
import { mapDrupalLocales } from './locales.service.js';
// Dynamic import for phpUnserialize will be used in the function

// Local utility functions (extracted from entries-field-creator.utils.ts patterns)
// Default prefix fallback if none provided
const DEFAULT_PREFIX = 'cs';

function startsWithNumber(str: string) {
  return /^\d/.test(str);
}

const uidCorrector = ({
  uid,
  id,
  prefix,
}: {
  uid?: string;
  id?: string;
  prefix?: string;
}) => {
  const value = uid || id;
  if (!value) return '';

  const effectivePrefix = prefix || DEFAULT_PREFIX;

  if (startsWithNumber(value)) {
    return `${effectivePrefix}_${_.replace(
      value,
      new RegExp('[ -]', 'g'),
      '_'
    )?.toLowerCase()}`;
  }
  return _.replace(value, new RegExp('[ -]', 'g'), '_')?.toLowerCase();
};

interface TaxonomyReference {
  drupal_term_id: number;
  taxonomy_uid: string;
  term_uid: string;
}

interface TaxonomyFieldOutput {
  taxonomy_uid: string;
  term_uid: string;
}

const {
  DATA,
  ENTRIES_DIR_NAME,
  ASSETS_DIR_NAME,
  REFERENCES_DIR_NAME,
  REFERENCES_FILE_NAME,
  TAXONOMIES_DIR_NAME,
} = MIGRATION_DATA_CONFIG;

interface DrupalFieldConfig {
  field_name: string;
  field_type: string;
  settings?: {
    handler?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

interface DrupalEntry {
  nid: number;
  title: string;
  langcode: string;
  created: number;
  type: string;
  [key: string]: any;
}

interface QueryConfig {
  page: {
    [contentType: string]: string;
  };
  count: {
    [contentTypeCount: string]: string;
  };
}

const LIMIT = 5; // Pagination limit

// NOTE: Hardcoded queries have been REMOVED. All queries are now generated dynamically
// by the query.service.ts based on actual database field analysis.

/**
 * Executes SQL query and returns results as Promise
 */
const executeQuery = (
  connection: mysql.Connection,
  query: string
): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    connection.query(query, (error, results) => {
      if (error) {
        reject(error);
      } else {
        resolve(results as any[]);
      }
    });
  });
};

/**
 * Load taxonomy reference mappings from taxonomyReference.json
 */
const loadTaxonomyReferences = async (
  referencesPath: string
): Promise<Record<number, TaxonomyFieldOutput>> => {
  try {
    const taxonomyRefPath = path.join(referencesPath, 'taxonomyReference.json');

    if (!fs.existsSync(taxonomyRefPath)) {
      return {};
    }

    const taxonomyReferences: TaxonomyReference[] = JSON.parse(
      fs.readFileSync(taxonomyRefPath, 'utf8')
    );

    // Create lookup map: drupal_term_id -> {taxonomy_uid, term_uid}
    const lookup: Record<number, TaxonomyFieldOutput> = {};

    taxonomyReferences.forEach((ref) => {
      lookup[ref.drupal_term_id] = {
        taxonomy_uid: ref.taxonomy_uid,
        term_uid: ref.term_uid,
      };
    });

    return lookup;
  } catch (error) {
    console.error('Could not load taxonomy references:', error);
    return {};
  }
};

/**
 * Writes data to a specified file, ensuring the target directory exists.
 */
async function writeFile(dirPath: string, filename: string, data: any) {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, filename);
    await fs.promises.writeFile(filePath, JSON.stringify(data), 'utf8');
  } catch (err) {
    console.error(`Error writing ${dirPath}/${filename}::`, err);
  }
}

/**
 * Reads a file and returns its JSON content.
 */
async function readFile(filePath: string, fileName: string) {
  try {
    const data = await fs.promises.readFile(
      path.join(filePath, fileName),
      'utf8'
    );
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

/**
 * Fetches field configurations from Drupal database
 */
const fetchFieldConfigs = async (
  connection: mysql.Connection,
  projectId: string,
  destination_stack_id: string
): Promise<DrupalFieldConfig[]> => {
  const srcFunc = 'fetchFieldConfigs';
  const contentTypeQuery =
    "SELECT *, CONVERT(data USING utf8) as data FROM config WHERE name LIKE '%field.field.node%'";

  try {
    const results = await executeQuery(connection, contentTypeQuery);

    const fieldConfigs: DrupalFieldConfig[] = [];
    for (const row of results) {
      try {
        const { unserialize } = await import('php-serialize');
        const configData = unserialize(row.data);
        if (configData && typeof configData === 'object') {
          fieldConfigs.push(configData as DrupalFieldConfig);
        }
      } catch (parseError) {
        console.error(
          `Failed to parse field config for ${row.name}:`,
          parseError
        );
      }
    }

    const message = getLogMessage(
      srcFunc,
      `Fetched ${fieldConfigs.length} field configurations from database.`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', message);

    return fieldConfigs;
  } catch (error: any) {
    const message = getLogMessage(
      srcFunc,
      `Failed to fetch field configurations: ${error.message}`,
      {},
      error
    );
    await customLogger(projectId, destination_stack_id, 'error', message);
    throw error;
  }
};

/**
 * Determines the source field type based on the value structure
 */
const determineSourceFieldType = (value: any): string => {
  if (typeof value === 'object' && value !== null && value.type === 'doc') {
    return 'json_rte';
  }
  if (typeof value === 'string' && /<\/?[a-z][\s\S]*>/i.test(value)) {
    return 'html_rte';
  }
  if (typeof value === 'string') {
    // Simple heuristic: if it has line breaks, consider it multi-line
    return value.includes('\n') || value.includes('\r')
      ? 'multi_line'
      : 'single_line';
  }
  return 'unknown';
};

/**
 * Checks if conversion is allowed based on the exact rules:
 * 1. Single-line text → Single-line/Multi-line/HTML RTE/JSON RTE
 * 2. Multi-line text → Multi-line/HTML RTE/JSON RTE (NOT Single-line)
 * 3. HTML RTE → HTML RTE/JSON RTE (NOT Single-line or Multi-line)
 * 4. JSON RTE → JSON RTE/HTML RTE (NOT Single-line or Multi-line)
 */
const isConversionAllowed = (
  sourceType: string,
  targetType: string
): boolean => {
  const conversionRules: { [key: string]: string[] } = {
    // ✅ Single line can upgrade to multi-line, HTML RTE, or JSON RTE
    single_line: [
      'single_line_text',
      'text',
      'multi_line_text',
      'html',
      'json',
    ],
    // ✅ Multi-line can upgrade to HTML RTE or JSON RTE (but not downgrade to single-line)
    multi_line: ['multi_line_text', 'text', 'html', 'json'],
    // ✅ HTML RTE can only convert to JSON RTE (no downgrades to text fields)
    html_rte: ['html', 'json'],
    // ✅ JSON RTE can only convert to HTML RTE (no downgrades to text fields)
    json_rte: ['json', 'html'],
  };

  return conversionRules[sourceType]?.includes(targetType) || false;
};

/**
 * Processes field values based on content type mapping and field type switching
 * Follows proper conversion rules for field type compatibility
 */
const processFieldByType = (
  value: any,
  fieldMapping: any,
  assetId: any,
  referenceId: any
): any => {
  if (!fieldMapping || !fieldMapping.contentstackFieldType) {
    return value;
  }

  // Determine source field type
  const sourceType = determineSourceFieldType(value);
  const targetType = fieldMapping.contentstackFieldType;

  // Check if conversion is allowed
  if (!isConversionAllowed(sourceType, targetType)) {
    console.error(
      `Conversion not allowed: ${sourceType} → ${targetType}. Keeping original value.`
    );
    return value;
  }

  switch (targetType) {
    case 'single_line_text': {
      // Convert to single line text
      if (typeof value === 'object' && value !== null && value.type === 'doc') {
        // JSON RTE to plain text (extract text content)
        try {
          const htmlContent = jsonToHtml(value) || '';
          // Strip HTML tags and convert to single line
          const textContent = htmlContent
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          return textContent;
        } catch (error) {
          console.error(
            'Failed to convert JSON RTE to single line text:',
            error
          );
          return String(value);
        }
      } else if (typeof value === 'string') {
        if (/<\/?[a-z][\s\S]*>/i.test(value)) {
          // HTML to plain text
          const textContent = value
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim();
          return textContent;
        }
        // Multi-line to single line
        return value.replace(/\s+/g, ' ').trim();
      }
      return String(value);
    }

    case 'text':
    case 'multi_line_text': {
      // Convert to multi-line text
      if (typeof value === 'object' && value !== null && value.type === 'doc') {
        // JSON RTE to HTML (preserving structure)
        try {
          return (
            jsonToHtml(value, {
              customElementTypes: {
                'social-embed': (attrs, child, jsonBlock) => {
                  return `<social-embed${attrs}>${child}</social-embed>`;
                },
              },
              customTextWrapper: {
                color: (child, value) => {
                  return `<color data-color="${value}">${child}</color>`;
                },
              },
            }) || ''
          );
        } catch (error) {
          console.error('Failed to convert JSON RTE to HTML:', error);
          return String(value);
        }
      }
      // HTML and plain text can stay as-is for multi-line
      return typeof value === 'string' ? value : String(value || '');
    }

    case 'json': {
      // Convert to JSON RTE
      if (typeof value === 'string' && /<\/?[a-z][\s\S]*>/i.test(value)) {
        // HTML to JSON RTE
        try {
          const dom = new JSDOM(value);
          const htmlDoc = dom.window.document.querySelector('body');
          if (htmlDoc) {
            htmlDoc.innerHTML = value;
            return htmlToJson(htmlDoc);
          }
        } catch (error) {
          console.error('Failed to convert HTML to JSON RTE:', error);
        }
      } else if (typeof value === 'string') {
        // Plain text to JSON RTE
        try {
          const dom = new JSDOM(`<p>${value}</p>`);
          const htmlDoc = dom.window.document.querySelector('body');
          if (htmlDoc) {
            return htmlToJson(htmlDoc);
          }
        } catch (error) {
          console.error('Failed to convert text to JSON RTE:', error);
        }
      }
      // If already JSON RTE or conversion failed, return as-is
      return value;
    }

    case 'html': {
      // Convert to HTML RTE
      if (typeof value === 'object' && value !== null && value.type === 'doc') {
        // JSON RTE to HTML
        try {
          return (
            jsonToHtml(value, {
              customElementTypes: {
                'social-embed': (attrs, child, jsonBlock) => {
                  return `<social-embed${attrs}>${child}</social-embed>`;
                },
              },
              customTextWrapper: {
                color: (child, value) => {
                  return `<color data-color="${value}">${child}</color>`;
                },
              },
            }) || '<p></p>'
          );
        } catch (error) {
          console.error('Failed to convert JSON RTE to HTML:', error);
          return value;
        }
      } else if (typeof value === 'string') {
        // Check if it's already HTML
        if (/<\/?[a-z][\s\S]*>/i.test(value)) {
          // Already HTML, return as-is
          return value;
        } else {
          // Plain text to HTML - wrap in paragraph tags
          return `<p>${value}</p>`;
        }
      }
      return typeof value === 'string' ? value : String(value || '');
    }

    case 'markdown': {
      // Convert to Markdown
      if (typeof value === 'object' && value !== null && value.type === 'doc') {
        try {
          return jsonToMarkdown(value);
        } catch (error) {
          console.error('Failed to convert JSON RTE to Markdown:', error);
          return value;
        }
      }
      return typeof value === 'string' ? value : String(value || '');
    }

    case 'file': {
      // File/Asset processing with proper validation and cleanup
      if (fieldMapping.advanced?.multiple) {
        // Multiple files
        if (Array.isArray(value)) {
          const validAssets = value
            .map((assetRef) => {
              const assetKey = `assets_${assetRef}`;
              const assetReference = assetId[assetKey];

              if (assetReference && typeof assetReference === 'object') {
                return assetReference;
              }

              console.error(
                `Asset ${assetKey} not found or invalid, excluding from array`
              );
              return null;
            })
            .filter((asset) => asset !== null); // Remove null entries

          return validAssets.length > 0 ? validAssets : undefined; // Return undefined if no valid assets
        }
      } else {
        // Single file
        const assetKey = `assets_${value}`;
        const assetReference = assetId[assetKey];

        if (assetReference && typeof assetReference === 'object') {
          return assetReference;
        }

        console.error(`Asset ${assetKey} not found or invalid, removing field`);
        return undefined; // Return undefined to indicate field should be removed
      }
      return value;
    }

    case 'reference': {
      // Reference processing
      if (fieldMapping.advanced?.multiple) {
        // Multiple references
        if (Array.isArray(value)) {
          return value.map(
            (refId) =>
              referenceId[`content_type_entries_title_${refId}`] || refId
          );
        }
      } else {
        // Single reference
        return [referenceId[`content_type_entries_title_${value}`] || value];
      }
      return value;
    }

    case 'number': {
      // Number processing
      if (typeof value === 'string') {
        const parsed = parseInt(value);
        return isNaN(parsed) ? 0 : parsed;
      }
      return typeof value === 'number' ? value : 0;
    }

    case 'boolean': {
      // Boolean processing
      if (typeof value === 'string') {
        return value === '1' || value.toLowerCase() === 'true';
      }
      return Boolean(value);
    }

    case 'isodate': {
      // Date processing
      if (typeof value === 'number') {
        return new Date(value * 1000).toISOString();
      }
      return value;
    }

    default: {
      // Default processing - handle HTML content
      if (typeof value === 'string' && /<\/?[a-z][\s\S]*>/i.test(value)) {
        try {
          const dom = new JSDOM(value);
          const htmlDoc = dom.window.document.querySelector('body');
          return htmlToJson(htmlDoc);
        } catch (error) {
          return value;
        }
      }
      return value;
    }
  }
};

/**
 * Consolidates all taxonomy fields into a single 'taxonomies' field with unique term_uid validation
 * Uses the same pattern as entries-field-creator.utils.ts
 */
const consolidateTaxonomyFields = (
  processedEntry: any,
  contentType: string,
  taxonomyFieldMapping: TaxonomyFieldMapping
): any => {
  const consolidatedTaxonomies: Array<{
    taxonomy_uid: string;
    term_uid: string;
  }> = [];
  const fieldsToRemove: string[] = [];
  const seenTermUids = new Set<string>(); // Track unique term_uid values

  // Iterate through all fields in the processed entry
  for (const [fieldKey, fieldValue] of Object.entries(processedEntry)) {
    // Extract field name from key (remove _target_id suffix)
    const fieldName = fieldKey.replace(/_target_id$/, '');

    // Check if this is a taxonomy field using field analysis
    if (isTaxonomyField(fieldName, contentType, taxonomyFieldMapping)) {
      // Validate that field value is an array with taxonomy structure
      if (Array.isArray(fieldValue)) {
        for (const taxonomyItem of fieldValue) {
          // Validate taxonomy structure
          if (
            taxonomyItem &&
            typeof taxonomyItem === 'object' &&
            taxonomyItem.taxonomy_uid &&
            taxonomyItem.term_uid
          ) {
            // Check for unique term_uid (avoid duplicates)
            if (!seenTermUids.has(taxonomyItem.term_uid)) {
              consolidatedTaxonomies.push({
                taxonomy_uid: taxonomyItem.taxonomy_uid,
                term_uid: taxonomyItem.term_uid,
              });
              seenTermUids.add(taxonomyItem.term_uid);
            }
          }
        }
      }

      // Mark this field for removal
      fieldsToRemove.push(fieldKey);
    }
  }

  // Create new entry object without the original taxonomy fields
  const consolidatedEntry = { ...processedEntry };

  // Remove original taxonomy fields
  for (const fieldKey of fieldsToRemove) {
    delete consolidatedEntry[fieldKey];
  }

  // Add consolidated taxonomy field if we have any taxonomies
  if (consolidatedTaxonomies.length > 0) {
    consolidatedEntry.taxonomies = consolidatedTaxonomies;
  }

  return consolidatedEntry;
};

/**
 * Processes field values based on field configuration - following original Drupal logic
 */
const processFieldData = async (
  entryData: DrupalEntry,
  fieldConfigs: DrupalFieldConfig[],
  assetId: any,
  referenceId: any,
  taxonomyId: any,
  taxonomyFieldMapping: TaxonomyFieldMapping,
  referenceFieldMapping: ReferenceFieldMapping,
  assetFieldMapping: any,
  taxonomyReferenceLookup: Record<number, TaxonomyFieldOutput>,
  contentType: string,
  prefix: string = DEFAULT_PREFIX
): Promise<any> => {
  const fieldNames = Object.keys(entryData);
  const isoDate = new Date();
  const processedData: any = {};
  const skippedFields = new Set<string>(); // Track fields that should be skipped entirely
  const processedFields = new Set<string>(); // Track fields that have been processed to avoid duplicates

  // Process each field in the entry data
  for (const [dataKey, value] of Object.entries(entryData)) {
    // Extract field name from dataKey (remove _target_id suffix)
    const fieldName = dataKey
      .replace(/_target_id$/, '')
      .replace(/_value$/, '')
      .replace(/_status$/, '')
      .replace(/_uri$/, '');

    // Handle asset fields using field analysis
    if (
      dataKey.endsWith('_target_id') &&
      isAssetField(fieldName, contentType, assetFieldMapping)
    ) {
      const assetKey = `assets_${value}`;
      if (assetKey in assetId) {
        // Transform to proper Contentstack asset reference format
        const assetReference = assetId[assetKey];
        if (assetReference && typeof assetReference === 'object') {
          processedData[dataKey] = assetReference;
        }
        // If asset reference is not properly structured, skip the field
      }
      // If asset not found in assets index, mark field as skipped
      skippedFields.add(dataKey);
      continue; // Skip further processing for this field
    }

    // Handle entity references (taxonomy and node references) using field analysis
    // NOTE: value can be a number (single reference) or string (GROUP_CONCAT comma-separated IDs)
    if (
      dataKey.endsWith('_target_id') &&
      (typeof value === 'number' || typeof value === 'string')
    ) {
      // Check if this is a taxonomy field using our field analysis
      if (isTaxonomyField(fieldName, contentType, taxonomyFieldMapping)) {
        // Handle both single ID (number) and GROUP_CONCAT result (comma-separated string)
        const targetIds =
          typeof value === 'string'
            ? value
                .split(',')
                .map((id) => parseInt(id.trim()))
                .filter((id) => !isNaN(id))
            : [value];

        const transformedTaxonomies: Array<{
          taxonomy_uid: string;
          term_uid: string;
        }> = [];

        for (const tid of targetIds) {
          // Look up taxonomy reference using drupal_term_id
          const taxonomyRef = taxonomyReferenceLookup[tid];

          if (taxonomyRef) {
            transformedTaxonomies.push({
              taxonomy_uid: taxonomyRef.taxonomy_uid,
              term_uid: taxonomyRef.term_uid,
            });
          } else {
            console.warn(
              `⚠️  Taxonomy term ${tid} not found in reference lookup for field ${fieldName}`
            );
          }
        }

        if (transformedTaxonomies.length > 0) {
          processedData[dataKey] = transformedTaxonomies;
        } else {
          // Fallback to original value if no lookups succeeded
          processedData[dataKey] = value;
        }

        // Mark field as processed so it doesn't get overwritten by ctValue loop
        processedFields.add(dataKey);
        skippedFields.add(dataKey); // Also skip in ctValue loop

        continue; // Skip further processing for this field
      } else if (
        isReferenceField(fieldName, contentType, referenceFieldMapping)
      ) {
        // Handle node reference fields using field analysis
        // Handle both single ID (number) and GROUP_CONCAT result (comma-separated string)
        const targetIds =
          typeof value === 'string'
            ? value
                .split(',')
                .map((id) => parseInt(id.trim()))
                .filter((id) => !isNaN(id))
            : [value];

        const transformedReferences: any[] = [];

        for (const nid of targetIds) {
          const referenceKey = `content_type_entries_title_${nid}`;
          if (referenceKey in referenceId) {
            transformedReferences.push(referenceId[referenceKey]);
          }
        }

        if (transformedReferences.length > 0) {
          processedData[dataKey] = transformedReferences;
        } else {
          // If no references found, mark field as skipped
          skippedFields.add(dataKey);
        }

        // Mark field as processed so it doesn't get overwritten by ctValue loop
        processedFields.add(dataKey);
        skippedFields.add(dataKey); // Also skip in ctValue loop

        continue; // Skip further processing for this field
      }
    }

    // Handle other field types by checking field configs
    const matchingFieldConfig = fieldConfigs.find(
      (fc) =>
        dataKey === `${fc.field_name}_value` ||
        dataKey === `${fc.field_name}_status` ||
        dataKey === fc.field_name
    );

    if (matchingFieldConfig) {
      // Handle datetime and timestamps
      if (
        matchingFieldConfig.field_type === 'datetime' ||
        matchingFieldConfig.field_type === 'timestamp'
      ) {
        if (dataKey === `${matchingFieldConfig.field_name}_value`) {
          if (typeof value === 'number') {
            processedData[dataKey] = new Date(value * 1000).toISOString();
          } else {
            processedData[dataKey] = isoDate.toISOString();
          }
          // Mark field as processed to avoid duplicate processing in second loop
          processedFields.add(dataKey);
          processedFields.add(matchingFieldConfig.field_name);
          continue;
        }
      }

      // Handle boolean fields
      if (matchingFieldConfig.field_type === 'boolean') {
        if (
          dataKey === `${matchingFieldConfig.field_name}_value` &&
          typeof value === 'number'
        ) {
          processedData[dataKey] = value === 1;
          // Mark field as processed to avoid duplicate processing in second loop
          processedFields.add(dataKey);
          processedFields.add(matchingFieldConfig.field_name);
          continue;
        }
      }

      // Handle comment fields
      if (matchingFieldConfig.field_type === 'comment') {
        if (
          dataKey === `${matchingFieldConfig.field_name}_status` &&
          typeof value === 'number'
        ) {
          processedData[dataKey] = `${value}`;
          // Mark field as processed to avoid duplicate processing in second loop
          processedFields.add(dataKey);
          processedFields.add(matchingFieldConfig.field_name);
          continue;
        }
      }
    }

    // Remove null, undefined, and empty values
    if (value === null || value === undefined || value === '') {
      // Skip null, undefined, and empty string values
      continue;
    }

    // Default case: copy field to processedData if it wasn't handled by special processing above
    if (!(dataKey in processedData)) {
      processedData[dataKey] = value;
    }
  }

  // Process standard field transformations
  const ctValue: any = {};

  for (const fieldName of fieldNames) {
    // Skip fields that were intentionally excluded in the main processing loop
    if (skippedFields.has(fieldName)) {
      continue;
    }

    const value = entryData[fieldName];

    if (fieldName === 'created') {
      ctValue[fieldName] = new Date(value * 1000).toISOString();
    } else if (fieldName === 'uid_name') {
      ctValue[fieldName] = [value];
    } else if (fieldName.endsWith('_tid')) {
      ctValue[fieldName] = [value];
    } else if (fieldName === 'nid') {
      ctValue.uid = uidCorrector({
        id: `content_type_entries_title_${value}`,
        prefix,
      });
    } else if (fieldName === 'langcode') {
      // Use the actual langcode from the entry for proper multilingual support
      ctValue.locale = value || 'en-us'; // fallback to en-us if langcode is empty
    } else if (fieldName.endsWith('_uri')) {
      // Skip if this field has already been processed
      if (processedFields.has(fieldName)) {
        continue;
      }

      const baseFieldName = fieldName.replace('_uri', '');
      const titleFieldName = `${baseFieldName}_title`;

      // Check if we also have title data
      const titleValue = entryData[titleFieldName];

      if (value) {
        ctValue[baseFieldName] = {
          title: titleValue || value, // Use title if available, fallback to URI
          href: value,
        };
      } else {
        ctValue[baseFieldName] = {
          title: titleValue || '',
          href: '',
        };
      }

      // Mark title field as processed to avoid duplicate processing
      if (titleValue) {
        processedFields.add(titleFieldName);
      }
    } else if (fieldName.endsWith('_title')) {
      // Skip _title fields as they're handled with _uri fields
      if (processedFields.has(fieldName)) {
        continue;
      }

      // Check if there's a corresponding _uri field
      const baseFieldName = fieldName.replace('_title', '');
      const uriFieldName = `${baseFieldName}_uri`;

      if (entryData[uriFieldName]) {
        // URI field will handle this, skip processing here
        continue;
      } else {
        // No URI field found, process title field standalone (rare case)
        ctValue[baseFieldName] = {
          title: value || '',
          href: '',
        };
      }
    } else if (fieldName.endsWith('_value')) {
      // Skip if this field was already processed in the main loop (avoid duplicates)
      const baseFieldName = fieldName.replace('_value', '');
      if (
        processedFields.has(fieldName) ||
        processedFields.has(baseFieldName)
      ) {
        continue;
      }

      // Check if content contains HTML
      if (/<\/?[a-z][\s\S]*>/i.test(value)) {
        const dom = new JSDOM(value);
        const htmlDoc = dom.window.document.querySelector('body');
        const jsonValue = htmlToJson(htmlDoc);
        ctValue[baseFieldName] = jsonValue;
      } else {
        ctValue[baseFieldName] = value;
      }

      // Mark both the original and base field as processed to avoid duplicates
      processedFields.add(fieldName);
      processedFields.add(baseFieldName);
    } else if (fieldName.endsWith('_status')) {
      // Skip if this field was already processed in the main loop (avoid duplicates)
      const baseFieldName = fieldName.replace('_status', '');
      if (
        processedFields.has(fieldName) ||
        processedFields.has(baseFieldName)
      ) {
        continue;
      }

      ctValue[baseFieldName] = value;

      // Mark both the original and base field as processed to avoid duplicates
      processedFields.add(fieldName);
      processedFields.add(baseFieldName);
    } else {
      // Check if content contains HTML
      if (typeof value === 'string' && /<\/?[a-z][\s\S]*>/i.test(value)) {
        const dom = new JSDOM(value);
        const htmlDoc = dom.window.document.querySelector('body');
        const jsonValue = htmlToJson(htmlDoc);
        ctValue[fieldName] = jsonValue;
      } else {
        ctValue[fieldName] = value;
      }
    }
  }

  // Apply processed field data, but prioritize ctValue (processed without suffixes) over processedData (with suffixes)
  // This prevents duplicate fields like both 'body' and 'body_value' from appearing
  const mergedData = { ...processedData, ...ctValue };

  // Final cleanup: remove any null, undefined, or empty values from the final result
  // Also remove duplicate fields where both suffixed and non-suffixed versions exist
  const cleanedEntry: any = {};
  for (const [key, val] of Object.entries(mergedData)) {
    if (val !== null && val !== undefined && val !== '') {
      // Check if this is a suffixed field (_value, _status, _uri) and if a non-suffixed version exists
      const isValueField = key.endsWith('_value');
      const isStatusField = key.endsWith('_status');
      const isUriField = key.endsWith('_uri');

      if (isValueField) {
        const baseFieldName = key.replace('_value', '');
        // Only include the _value field if the base field doesn't exist
        if (!mergedData.hasOwnProperty(baseFieldName)) {
          cleanedEntry[key] = val;
        }
        // If base field exists, skip the _value field (base field takes priority)
      } else if (isStatusField) {
        const baseFieldName = key.replace('_status', '');
        // Only include the _status field if the base field doesn't exist
        if (!mergedData.hasOwnProperty(baseFieldName)) {
          cleanedEntry[key] = val;
        }
        // If base field exists, skip the _status field (base field takes priority)
      } else if (isUriField) {
        const baseFieldName = key.replace('_uri', '');
        // Only include the _uri field if the base field doesn't exist
        if (!mergedData.hasOwnProperty(baseFieldName)) {
          cleanedEntry[key] = val;
        }
        // If base field exists, skip the _uri field (base field takes priority)
      } else {
        // For non-suffixed fields, always include them
        cleanedEntry[key] = val;
      }
    }
  }

  return cleanedEntry;
};

/**
 * Processes entries for a specific content type and pagination offset
 */
const processEntries = async (
  connection: mysql.Connection,
  contentType: string,
  skip: number,
  queryPageConfig: QueryConfig,
  fieldConfigs: DrupalFieldConfig[],
  assetId: any,
  referenceId: any,
  taxonomyId: any,
  taxonomyFieldMapping: TaxonomyFieldMapping,
  referenceFieldMapping: ReferenceFieldMapping,
  assetFieldMapping: AssetFieldMapping,
  taxonomyReferenceLookup: Record<number, TaxonomyFieldOutput>,
  projectId: string,
  destination_stack_id: string,
  masterLocale: string,
  contentTypeMapping: any[] = [],
  isTest: boolean = false,
  project: any = null
): Promise<{ [key: string]: any } | null> => {
  const srcFunc = 'processEntries';

  try {
    // Following original pattern: queryPageConfig['page']['' + pagename + '']
    const baseQuery = queryPageConfig['page'][contentType];
    if (!baseQuery) {
      throw new Error(`No query found for content type: ${contentType}`);
    }

    // Check if this is an optimized query (content type with many fields)
    const isOptimizedQuery = baseQuery.includes('/* OPTIMIZED_NO_JOINS:');
    let entries: any[] = [];

    if (isOptimizedQuery) {
      // Handle content types with many fields using optimized approach
      const fieldCountMatch = baseQuery.match(
        /\/\* OPTIMIZED_NO_JOINS:(\d+) \*\//
      );
      const fieldCount = fieldCountMatch ? parseInt(fieldCountMatch[1]) : 0;

      const optimizedMessage = getLogMessage(
        srcFunc,
        `Processing ${contentType} with optimized field fetching (${fieldCount} fields)`,
        {}
      );
      await customLogger(
        projectId,
        destination_stack_id,
        'info',
        optimizedMessage
      );

      // Execute base query without field JOINs
      const effectiveLimit = isTest ? 1 : LIMIT;
      const cleanBaseQuery = baseQuery
        .replace(/\/\* OPTIMIZED_NO_JOINS:\d+ \*\//, '')
        .trim();
      const query = cleanBaseQuery + ` LIMIT ${skip}, ${effectiveLimit}`;
      const baseEntries = await executeQuery(connection, query);

      if (baseEntries.length === 0) {
        return null;
      }

      // Fetch field data separately using FieldFetcherService
      const fieldFetcher = new FieldFetcherService(
        connection,
        projectId,
        destination_stack_id
      );
      const nodeIds = baseEntries.map((entry) => entry.nid);
      const fieldsForType = await fieldFetcher.getFieldsForContentType(
        contentType
      );

      if (fieldsForType.length > 0) {
        const fieldData = await fieldFetcher.fetchFieldDataForContentType(
          contentType,
          nodeIds,
          fieldsForType
        );

        // Merge base entries with field data
        entries = fieldFetcher.mergeNodeAndFieldData(baseEntries, fieldData);

        const mergeMessage = getLogMessage(
          srcFunc,
          `Merged ${baseEntries.length} base entries with field data for ${contentType}`,
          {}
        );
        await customLogger(
          projectId,
          destination_stack_id,
          'info',
          mergeMessage
        );
      } else {
        entries = baseEntries;
      }
    } else {
      // Handle content types with few fields using traditional approach
      const effectiveLimit = isTest ? 1 : LIMIT;
      const query = baseQuery + ` LIMIT ${skip}, ${effectiveLimit}`;
      entries = await executeQuery(connection, query);

      if (entries.length === 0) {
        return null;
      }
    }

    // Group entries by their actual locale (langcode) for proper multilingual support
    const entriesByLocale: { [locale: string]: any[] } = {};

    // Group entries by their langcode
    entries.forEach((entry) => {
      const entryLocale = entry.langcode || masterLocale; // fallback to masterLocale if no langcode
      if (!entriesByLocale[entryLocale]) {
        entriesByLocale[entryLocale] = [];
      }
      entriesByLocale[entryLocale].push(entry);
    });

    // Map source locales to destination locales using user-selected mapping from UI
    // This replaces the old hardcoded transformation rules with dynamic user mapping
    const transformedEntriesByLocale: { [locale: string]: any[] } = {};
    const allLocales = Object.keys(entriesByLocale);
    const hasEn = allLocales.includes('en');
    const hasEnUs = allLocales.includes('en-us');

    // Get locale mapping configuration from project
    const localeMapping = project?.localeMapping || {};
    const localesFromProject = {
      masterLocale: project?.master_locale || {},
      ...(project?.locales || {}),
    };

    // Get source master locale from database query
    // Use the masterLocale parameter which was fetched from Drupal's system.site config
    const sourceMasterLocale = masterLocale || 'en';

    // Get destination master locale from project configuration
    // Priority: localeMapping -> master_locale values -> stackDetails.master_locale -> masterLocale
    const masterLocaleKey = `${sourceMasterLocale}-master_locale`;
    const destinationMasterLocale =
      localeMapping?.[masterLocaleKey] ||
      Object.values(project?.master_locale || {})?.[0] || // ✅ Use values() not keys()!
      project?.stackDetails?.master_locale ||
      masterLocale ||
      'en-us';
    // Apply source locale transformation rules first (und → en-us, etc.)
    // Then map the transformed source locale to destination locale using user's selection
    Object.entries(entriesByLocale).forEach(([originalLocale, entries]) => {
      // Step 1: Apply Drupal-specific transformation rules (same as before)
      let transformedSourceLocale = originalLocale;

      if (originalLocale === 'und') {
        if (hasEn && hasEnUs) {
          // Rule 4: All three "en" + "und" + "en-us" → all three stays
          transformedSourceLocale = 'und';
        } else if (hasEnUs && !hasEn) {
          // Rule 2: "und" + "en-us" → "und" become "en", "en-us" stays
          transformedSourceLocale = 'en';
        } else if (hasEn && !hasEnUs) {
          // Rule 3: "en" + "und" → "und" becomes "en-us", "en" stays
          transformedSourceLocale = 'en-us';
        } else if (!hasEn && !hasEnUs) {
          // Rule 1: "und" alone → "en-us"
          transformedSourceLocale = 'en-us';
        } else {
          // Keep as is for any other combinations
          transformedSourceLocale = 'und';
        }
      } else if (originalLocale === 'en-us') {
        // "en-us" always stays as "en-us" in all rules
        transformedSourceLocale = 'en-us';
      } else if (originalLocale === 'en') {
        // "en" always stays as "en" in all rules (never transforms to "und")
        transformedSourceLocale = 'en';
      }

      // Step 2: Map transformed source locale to destination locale using user's mapping
      const destinationLocale = mapDrupalLocales({
        masterLocale,
        locale: transformedSourceLocale,
        locales: localesFromProject,
        localeMapping,
        sourceMasterLocale,
        destinationMasterLocale,
      });

      // Merge entries if destination locale already has entries
      if (transformedEntriesByLocale[destinationLocale]) {
        transformedEntriesByLocale[destinationLocale] = [
          ...transformedEntriesByLocale[destinationLocale],
          ...entries,
        ];
      } else {
        transformedEntriesByLocale[destinationLocale] = entries;
      }
    });

    // Find content type mapping for field type switching
    const currentContentTypeMapping = contentTypeMapping.find(
      (ct) =>
        ct.otherCmsUid === contentType || ct.contentstackUid === contentType
    );

    const allProcessedContent: { [key: string]: any } = {};

    // Process entries for each transformed locale separately
    for (const [currentLocale, localeEntries] of Object.entries(
      transformedEntriesByLocale
    )) {
      // Create folder structure: entries/contentType/locale/
      const contentTypeFolderPath = path.join(
        MIGRATION_DATA_CONFIG.DATA,
        destination_stack_id,
        MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME,
        contentType
      );
      const localeFolderPath = path.join(contentTypeFolderPath, currentLocale);
      await fs.promises.mkdir(localeFolderPath, { recursive: true });

      // Read existing content for this locale or initialize
      const localeFileName = `${currentLocale}.json`;
      const existingLocaleContent =
        (await readFile(localeFolderPath, localeFileName)) || {};

      // Extract prefix from project for UID correction
      const prefix = project?.legacy_cms?.affix || DEFAULT_PREFIX;

      // Process each entry in this locale
      for (const entry of localeEntries) {
        let processedEntry = await processFieldData(
          entry,
          fieldConfigs,
          assetId,
          referenceId,
          taxonomyId,
          taxonomyFieldMapping,
          referenceFieldMapping,
          assetFieldMapping,
          taxonomyReferenceLookup,
          contentType,
          prefix
        );

        // 🏷️ TAXONOMY CONSOLIDATION: Merge all taxonomy fields into single 'taxonomies' field
        processedEntry = consolidateTaxonomyFields(
          processedEntry,
          contentType,
          taxonomyFieldMapping
        );

        // Apply field type switching based on user's UI selections (from content type schema)
        const enhancedEntry: any = {};

        // Process each field with type switching support
        for (const [fieldName, fieldValue] of Object.entries(processedEntry)) {
          let fieldMapping = null;

          // PRIORITY 1: Read from generated content type schema (has UI-selected field types)
          // This is checked FIRST because it contains the final field types after user's UI changes
          // Load the content type schema to get user's field type selections
          try {
            const contentTypeSchemaPath = path.join(
              MIGRATION_DATA_CONFIG.DATA,
              destination_stack_id,
              'content_types',
              `${contentType}.json`
            );
            const contentTypeSchema = JSON.parse(
              await fs.promises.readFile(contentTypeSchemaPath, 'utf8')
            );

            // Find field in schema
            const schemaField = contentTypeSchema.schema?.find(
              (field: any) =>
                field.uid === fieldName ||
                field.uid === fieldName.replace(/_target_id$/, '') ||
                field.uid === fieldName.replace(/_value$/, '') ||
                fieldName.includes(field.uid)
            );

            if (schemaField) {
              // Determine the proper field type based on schema configuration
              let targetFieldType = schemaField.data_type;

              // Handle HTML RTE fields (text with allow_rich_text: true)
              if (
                schemaField.data_type === 'text' &&
                schemaField.field_metadata?.allow_rich_text === true
              ) {
                targetFieldType = 'html'; // ✅ HTML RTE field
              }
              // Handle JSON RTE fields
              else if (schemaField.data_type === 'json') {
                targetFieldType = 'json'; // ✅ JSON RTE field
              }
              // Handle text fields with multiline metadata
              else if (
                schemaField.data_type === 'text' &&
                schemaField.field_metadata?.multiline
              ) {
                targetFieldType = 'multi_line_text'; // ✅ Multi-line text field
              }

              // Create a mapping from schema field
              fieldMapping = {
                uid: fieldName,
                contentstackFieldType: targetFieldType,
                backupFieldType: schemaField.data_type,
                advanced: schemaField,
              };
            }
          } catch (error: any) {
            // Schema not found, will try fallback below
          }

          // FALLBACK: If schema not found, try UI content type mapping
          if (
            !fieldMapping &&
            currentContentTypeMapping &&
            currentContentTypeMapping.fieldMapping
          ) {
            fieldMapping = currentContentTypeMapping.fieldMapping.find(
              (fm: any) =>
                fm.uid === fieldName ||
                fm.otherCmsField === fieldName ||
                fieldName.startsWith(fm.uid) ||
                fieldName.includes(fm.uid)
            );
          }

          if (fieldMapping) {
            // Apply field type processing based on user's selection
            const processedValue = processFieldByType(
              fieldValue,
              fieldMapping,
              assetId,
              referenceId
            );

            // Only add field if processed value is not undefined (undefined means remove field)
            if (processedValue !== undefined) {
              enhancedEntry[fieldName] = processedValue;

              // Log field type processing
              if (
                fieldMapping.contentstackFieldType !==
                fieldMapping.backupFieldType
              ) {
                const message = getLogMessage(
                  srcFunc,
                  `Field ${fieldName} processed as ${fieldMapping.contentstackFieldType} (switched from ${fieldMapping.backupFieldType})`,
                  {}
                );
                await customLogger(
                  projectId,
                  destination_stack_id,
                  'info',
                  message
                );
              }
            } else {
              // Log field removal
              const message = getLogMessage(
                srcFunc,
                `Field ${fieldName} removed due to missing or invalid asset reference`,
                {}
              );
              await customLogger(
                projectId,
                destination_stack_id,
                'warn',
                message
              );
            }
          } else {
            // Keep original value if no mapping found
            enhancedEntry[fieldName] = fieldValue;
          }
        }

        processedEntry = enhancedEntry;

        // Add publish_details as an empty array to the end of entry creation
        processedEntry.publish_details = [];

        if (typeof entry.nid === 'number') {
          const entryUid = uidCorrector({
            id: `content_type_entries_title_${entry.nid}`,
            prefix,
          });
          existingLocaleContent[entryUid] = processedEntry;
          allProcessedContent[entryUid] = processedEntry;
        }

        // Log each entry transformation
        const message = getLogMessage(
          srcFunc,
          `Entry with uid ${entry.nid} (locale: ${currentLocale}) for content type ${contentType} has been successfully transformed.`,
          {}
        );
        await customLogger(projectId, destination_stack_id, 'info', message);
      }

      // Write processed content for this specific locale
      await writeFile(localeFolderPath, localeFileName, existingLocaleContent);

      const localeMessage = getLogMessage(
        srcFunc,
        `Successfully processed ${localeEntries.length} entries for locale ${currentLocale} in content type ${contentType}`,
        {}
      );
      await customLogger(
        projectId,
        destination_stack_id,
        'info',
        localeMessage
      );
    }

    // 📁 Create mandatory index.json files for each transformed locale directory
    for (const [currentLocale, localeEntries] of Object.entries(
      transformedEntriesByLocale
    )) {
      if (localeEntries.length > 0) {
        const contentTypeFolderPath = path.join(
          MIGRATION_DATA_CONFIG.DATA,
          destination_stack_id,
          MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME,
          contentType
        );
        const localeFolderPath = path.join(
          contentTypeFolderPath,
          currentLocale
        );
        const localeFileName = `${currentLocale}.json`;

        // Create mandatory index.json file that maps to the locale file
        const indexData = { '1': localeFileName };
        await writeFile(localeFolderPath, 'index.json', indexData);
      }
    }

    return allProcessedContent;
  } catch (error: any) {
    const message = getLogMessage(
      srcFunc,
      `Error processing entries for ${contentType}: ${error.message}`,
      {},
      error
    );
    await customLogger(projectId, destination_stack_id, 'error', message);
    throw error;
  }
};

/**
 * Gets count and processes all entries for a specific content type
 */
const processContentType = async (
  connection: mysql.Connection,
  contentType: string,
  queryPageConfig: QueryConfig,
  fieldConfigs: DrupalFieldConfig[],
  assetId: any,
  referenceId: any,
  taxonomyId: any,
  taxonomyFieldMapping: TaxonomyFieldMapping,
  referenceFieldMapping: ReferenceFieldMapping,
  assetFieldMapping: AssetFieldMapping,
  taxonomyReferenceLookup: Record<number, TaxonomyFieldOutput>,
  projectId: string,
  destination_stack_id: string,
  masterLocale: string,
  contentTypeMapping: any[] = [],
  isTest: boolean = false,
  project: any = null
): Promise<void> => {
  const srcFunc = 'processContentType';

  try {
    // Get total count for pagination (if count query exists)
    const countKey = `${contentType}Count`;
    let totalCount = 1; // Default to process at least one batch

    if (queryPageConfig.count && queryPageConfig.count[countKey]) {
      const countQuery = queryPageConfig.count[countKey];
      const countResults = await executeQuery(connection, countQuery);
      totalCount = countResults[0]?.countentry || 0;
    }

    if (totalCount === 0) {
      const message = getLogMessage(
        srcFunc,
        `No entries found for content type ${contentType}.`,
        {}
      );
      await customLogger(projectId, destination_stack_id, 'info', message);
      return;
    }

    // 🧪 Process entries in batches (test migration: single entry, main migration: all entries)
    const effectiveLimit = isTest ? 1 : LIMIT;

    for (
      let i = 0;
      i < (isTest ? effectiveLimit : totalCount + LIMIT);
      i += effectiveLimit
    ) {
      const result = await processEntries(
        connection,
        contentType,
        i,
        queryPageConfig,
        fieldConfigs,
        assetId,
        referenceId,
        taxonomyId,
        taxonomyFieldMapping,
        referenceFieldMapping,
        assetFieldMapping,
        taxonomyReferenceLookup,
        projectId,
        destination_stack_id,
        masterLocale,
        contentTypeMapping,
        isTest,
        project
      );

      // If no entries returned, break the loop
      if (!result) {
        break;
      }
    }
  } catch (error: any) {
    const message = getLogMessage(
      srcFunc,
      `Error processing content type ${contentType}: ${error.message}`,
      {},
      error
    );
    await customLogger(projectId, destination_stack_id, 'error', message);
    throw error;
  }
};

/**
 * Reads dynamic query configuration file generated by query.service.ts
 * Following original pattern: helper.readFile(path.join(process.cwd(), config.data, 'query', 'index.json'))
 *
 * NOTE: No fallback to hardcoded queries - dynamic queries MUST be generated first
 */
async function readQueryConfig(
  destination_stack_id: string
): Promise<QueryConfig> {
  try {
    const queryPath = path.join(
      DATA,
      destination_stack_id,
      'query',
      'index.json'
    );
    const data = await fs.promises.readFile(queryPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    // No fallback - dynamic queries must be generated first by createQuery() service
    throw new Error(
      `❌ No dynamic query configuration found at query/index.json. Dynamic queries must be generated first using createQuery() service. Original error: ${err}`
    );
  }
}

/**
 * Creates and processes entries from Drupal database for migration to Contentstack.
 * Based on the original Drupal v8 migration logic with direct SQL queries.
 *
 * Supports dynamic SQL queries from query/index.json file following original pattern:
 * var queryPageConfig = helper.readFile(path.join(process.cwd(), config.data, 'query', 'index.json'));
 * var query = queryPageConfig['page']['' + pagename + ''];
 */
export const createEntry = async (
  dbConfig: any,
  destination_stack_id: string,
  projectId: string,
  isTest = false,
  masterLocale = 'en-us',
  contentTypeMapping: any[] = [],
  project: any = null
): Promise<void> => {
  const srcFunc = 'createEntry';
  let connection: mysql.Connection | null = null;

  try {
    const entriesSave = path.join(DATA, destination_stack_id, ENTRIES_DIR_NAME);
    const assetsSave = path.join(DATA, destination_stack_id, ASSETS_DIR_NAME);
    const referencesSave = path.join(
      DATA,
      destination_stack_id,
      REFERENCES_DIR_NAME
    );

    // Initialize directories
    await fs.promises.mkdir(entriesSave, { recursive: true });

    const message = getLogMessage(srcFunc, `Exporting entries...`, {});
    await customLogger(projectId, destination_stack_id, 'info', message);

    // Read query configuration (following original pattern)
    const queryPageConfig = await readQueryConfig(destination_stack_id);

    // Create database connection
    connection = await getDbConnection(
      dbConfig,
      projectId,
      destination_stack_id
    );

    // Analyze field types to identify taxonomy, reference, and asset fields
    const {
      taxonomyFields: taxonomyFieldMapping,
      referenceFields: referenceFieldMapping,
      assetFields: assetFieldMapping,
    } = await analyzeFieldTypes(dbConfig, destination_stack_id, projectId);

    // Fetch field configurations
    const fieldConfigs = await fetchFieldConfigs(
      connection,
      projectId,
      destination_stack_id
    );

    // Read supporting data - following original page.js pattern
    // Load assets from index.json (your new format)
    const assetId = (await readFile(assetsSave, 'index.json')) || {};

    const referenceId =
      (await readFile(referencesSave, REFERENCES_FILE_NAME)) || {};
    const taxonomyId =
      (await readFile(
        path.join(entriesSave, 'taxonomy'),
        `${masterLocale}.json`
      )) || {};

    // Load taxonomy reference mappings for field transformation
    const taxonomyReferenceLookup = await loadTaxonomyReferences(
      referencesSave
    );

    // Process each content type from query config (like original)
    const pageQuery = queryPageConfig.page;
    const contentTypes = Object.keys(pageQuery);
    // 🧪 Test migration: Process ALL content types but with limited data per content type
    const typesToProcess = contentTypes; // Always process all content types

    for (const contentType of typesToProcess) {
      await processContentType(
        connection,
        contentType,
        queryPageConfig,
        fieldConfigs,
        assetId,
        referenceId,
        taxonomyId,
        taxonomyFieldMapping,
        referenceFieldMapping,
        assetFieldMapping,
        taxonomyReferenceLookup,
        projectId,
        destination_stack_id,
        masterLocale,
        contentTypeMapping,
        isTest,
        project
      );
    }

    const successMessage = getLogMessage(
      srcFunc,
      `Successfully processed entries for ${typesToProcess.length} content types with multilingual support.`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', successMessage);

    // Log multilingual structure summary
    const structureSummary = getLogMessage(
      srcFunc,
      `Multilingual entries structure created at: ${DATA}/${destination_stack_id}/${ENTRIES_DIR_NAME}/[contentType]/[locale]/[locale].json`,
      {}
    );
    await customLogger(
      projectId,
      destination_stack_id,
      'info',
      structureSummary
    );
  } catch (err) {
    const message = getLogMessage(
      srcFunc,
      `Error encountered while creating entries.`,
      {},
      err
    );
    await customLogger(projectId, destination_stack_id, 'error', message);
    throw err;
  } finally {
    // Close database connection
    if (connection) {
      connection.end();
    }
  }
};
