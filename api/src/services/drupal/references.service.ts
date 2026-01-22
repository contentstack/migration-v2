import fs from "fs";
import path from "path";
import mysql from 'mysql2';
import { MIGRATION_DATA_CONFIG } from "../../constants/index.js";
import { getLogMessage } from "../../utils/index.js";
import customLogger from "../../utils/custom-logger.utils.js";
import { getDbConnection } from "../../helper/index.js";

const {
  DATA,
  REFERENCES_DIR_NAME,
  REFERENCES_FILE_NAME,
} = MIGRATION_DATA_CONFIG;

interface QueryConfig {
  page: {
    [contentType: string]: string;
  };
  count: {
    [contentTypeCount: string]: string;
  };
}

interface DrupalEntry {
  nid: number;
  title: string;
  langcode: string;
  created: number;
  type: string;
  [key: string]: any;
}

interface TaxonomyReference {
  drupal_term_id: number;
  taxonomy_uid: string;
  term_uid: string;
}

interface DrupalTaxonomyTerm {
  taxonomy_uid: string;  // vid (vocabulary id)
  drupal_term_id: number;      // term id
  term_name: string;     // term name
  term_description: string | null; // term description
}

const LIMIT = 100; // Pagination limit for references

// NOTE: Hardcoded queries have been REMOVED. All queries are now generated dynamically 
// by the query.service.ts based on actual database field analysis.

/**
 * Executes SQL query and returns results as Promise
 */
const executeQuery = (connection: mysql.Connection, query: string): Promise<any[]> => {
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
 * Writes data to a specified file, ensuring the target directory exists.
 */
async function writeFile(dirPath: string, filename: string, data: any) {
  try {
    await fs.promises.mkdir(dirPath, { recursive: true });
    const filePath = path.join(dirPath, filename);
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8');
  } catch (err) {
    console.error(`Error writing ${dirPath}/${filename}::`, err);
  }
}

/**
 * Reads existing references file or returns empty object
 */
async function readReferencesFile(referencesPath: string): Promise<any> {
  try {
    const data = await fs.promises.readFile(referencesPath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    return {};
  }
}

/**
 * Processes entries for a specific content type and creates reference mappings
 * Following the original putPosts logic from references.js
 */
const putPosts = async (
  entries: DrupalEntry[],
  contentType: string,
  referencesPath: string,
  projectId: string,
  destination_stack_id: string
): Promise<void> => {
  const srcFunc = 'putPosts';
  
  try {
    // Read existing references data
    const referenceData = await readReferencesFile(referencesPath);

    // Process each entry and create reference mapping
    entries.forEach((entry) => {
      const referenceKey = `content_type_entries_title_${entry.nid}`;
      referenceData[referenceKey] = {
        uid: referenceKey,
        _content_type_uid: contentType,
      };
    });

    // Write updated references back to file
    await fs.promises.writeFile(referencesPath, JSON.stringify(referenceData, null, 4), 'utf8');

    const message = getLogMessage(
      srcFunc,
      `Created ${entries.length} reference mappings for content type ${contentType}.`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', message);

  } catch (error: any) {
    const message = getLogMessage(
      srcFunc,
      `Error creating references for ${contentType}: ${error.message}`,
      {},
      error
    );
    await customLogger(projectId, destination_stack_id, 'error', message);
    throw error;
  }
};

/**
 * Processes entries for a specific content type with pagination
 * Following the original getQuery logic from references.js
 */
const getQuery = async (
  connection: mysql.Connection,
  contentType: string,
  skip: number,
  queryPageConfig: QueryConfig,
  referencesPath: string,
  projectId: string,
  destination_stack_id: string
): Promise<boolean> => {
  const srcFunc = 'getQuery';
  
  try {
    // Following original pattern: queryPageConfig['page']['' + pagename + '']
    const baseQuery = queryPageConfig['page'][contentType];
    if (!baseQuery) {
      throw new Error(`No query found for content type: ${contentType}`);
    }
    
    const query = baseQuery + ` LIMIT ${skip}, ${LIMIT}`;
    const entries = await executeQuery(connection, query);

    if (entries.length === 0) {
      return false; // No more entries
    }

    await putPosts(entries, contentType, referencesPath, projectId, destination_stack_id);
    return true; // More entries might exist

  } catch (error: any) {
    const message = getLogMessage(
      srcFunc,
      `Error querying references for ${contentType}: ${error.message}`,
      {},
      error
    );
    await customLogger(projectId, destination_stack_id, 'error', message);
    throw error;
  }
};

/**
 * Processes all entries for a specific content type
 * Following the original getPageCount logic from references.js
 */
const getPageCount = async (
  connection: mysql.Connection,
  contentType: string,
  queryPageConfig: QueryConfig,
  referencesPath: string,
  projectId: string,
  destination_stack_id: string
): Promise<void> => {
  const srcFunc = 'getPageCount';
  
  try {
    // Process entries in batches
    let skip = 0;
    let hasMoreEntries = true;

    while (hasMoreEntries) {
      hasMoreEntries = await getQuery(
        connection,
        contentType,
        skip,
        queryPageConfig,
        referencesPath,
        projectId,
        destination_stack_id
      );
      skip += LIMIT;
    }

    const message = getLogMessage(
      srcFunc,
      `Completed reference extraction for content type ${contentType}.`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', message);

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
async function readQueryConfig(destination_stack_id: string): Promise<QueryConfig> {
  try {
    const queryPath = path.join(DATA, destination_stack_id, 'query', 'index.json');
    const data = await fs.promises.readFile(queryPath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    // No fallback - dynamic queries must be generated first by createQuery() service
    throw new Error(`❌ No dynamic query configuration found at query/index.json. Dynamic queries must be generated first using createQuery() service. Original error: ${err}`);
  }
}

/**
 * Creates taxonomy reference mappings from Drupal database
 * Using the taxonomy query to create a flat mapping file: taxonomyReference.json
 */
const createTaxonomyReferences = async (
  connection: mysql.Connection,
  referencesSave: string,
  projectId: string,
  destination_stack_id: string
): Promise<void> => {
  const srcFunc = 'createTaxonomyReferences';
  
  try {
    const message = getLogMessage(
      srcFunc,
      `Creating taxonomy reference mappings...`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', message);

    // Use the same SQL query as taxonomy.service.ts
    const taxonomyQuery = `
      SELECT
        f.vid AS taxonomy_uid,
        f.tid AS drupal_term_id,
        f.name AS term_name,
        f.description__value AS term_description
      FROM taxonomy_term_field_data f
      ORDER BY f.vid, f.tid
    `;
    
    const taxonomyTerms = await executeQuery(connection, taxonomyQuery);
    
    if (taxonomyTerms.length === 0) {
      const noDataMessage = getLogMessage(
        srcFunc,
        `No taxonomy terms found in database.`,
        {}
      );
      await customLogger(projectId, destination_stack_id, 'info', noDataMessage);
      return;
    }

    // Transform to taxonomy reference format
    const taxonomyReferences: TaxonomyReference[] = [];
    
    for (const term of taxonomyTerms as DrupalTaxonomyTerm[]) {
      const termUid = `${term.taxonomy_uid}_${term.drupal_term_id}`;
      
      taxonomyReferences.push({
        drupal_term_id: term.drupal_term_id,
        taxonomy_uid: term.taxonomy_uid,
        term_uid: termUid
      });
    }

    // Save taxonomy references to taxonomyReference.json
    await writeFile(referencesSave, 'taxonomyReference.json', taxonomyReferences);

    const successMessage = getLogMessage(
      srcFunc,
      `Created ${taxonomyReferences.length} taxonomy reference mappings.`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', successMessage);

  } catch (error: any) {
    const message = getLogMessage(
      srcFunc,
      `Error creating taxonomy references: ${error.message}`,
      {},
      error
    );
    await customLogger(projectId, destination_stack_id, 'error', message);
    throw error;
  }
};

/**
 * Creates reference mappings from Drupal database for migration to Contentstack.
 * Based on the original Drupal v8 references.js logic with direct SQL queries.
 * 
 * This creates a references.json file that maps node IDs to content types,
 * which is then used by the entries service to resolve entity references.
 * 
 * Supports dynamic SQL queries from query/index.json file following original pattern:
 * var queryPageConfig = helper.readFile(path.join(process.cwd(), config.data, 'query', 'index.json'));
 * var query = queryPageConfig['page']['' + pagename + ''];
 */
export const createRefrence = async (
  dbConfig: any,
  destination_stack_id: string,
  projectId: string,
  isTest = false
): Promise<void> => {
  const srcFunc = 'createRefrence';
  let connection: mysql.Connection | null = null;
  
  try {
    const referencesSave = path.join(DATA, destination_stack_id, REFERENCES_DIR_NAME);
    const referencesPath = path.join(referencesSave, REFERENCES_FILE_NAME);
    
    // Initialize directories and files
    await fs.promises.mkdir(referencesSave, { recursive: true });
    
    // Initialize empty references file if it doesn't exist
    if (!await fs.promises.access(referencesPath).then(() => true).catch(() => false)) {
      await fs.promises.writeFile(referencesPath, JSON.stringify({}, null, 4), 'utf8');
    }

    const message = getLogMessage(
      srcFunc,
      `Exporting references...`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', message);

    // Read query configuration (following original pattern)
    const queryPageConfig = await readQueryConfig(destination_stack_id);
    
    // Create database connection
    connection = await getDbConnection(dbConfig, projectId, destination_stack_id);

    // Process each content type from query config (like original)
    const pageQuery = queryPageConfig.page;
    const contentTypes = Object.keys(pageQuery);
    const typesToProcess = isTest ? contentTypes.slice(0, 2) : contentTypes;

    // Process content types sequentially (like original sequence logic)
    for (const contentType of typesToProcess) {
      await getPageCount(
        connection,
        contentType,
        queryPageConfig,
        referencesPath,
        projectId,
        destination_stack_id
      );
    }

    // Create taxonomy reference mappings
    await createTaxonomyReferences(
      connection,
      referencesSave,
      projectId,
      destination_stack_id
    );

    const successMessage = getLogMessage(
      srcFunc,
      `Successfully created reference mappings for ${typesToProcess.length} content types and taxonomy references.`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', successMessage);

  } catch (err) {
    const message = getLogMessage(
      srcFunc,
      `Error encountered while creating references.`,
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