import fs from "fs";
import path from "path";
import mysql from "mysql2";
import { getDbConnection } from "../../helper/index.js";
import customLogger from "../../utils/custom-logger.utils.js";
import { getLogMessage } from "../../utils/index.js";
import { MIGRATION_DATA_CONFIG } from "../../constants/index.js";

const { DATA, TAXONOMIES_DIR_NAME } = MIGRATION_DATA_CONFIG;

interface DrupalTaxonomyTerm {
  taxonomy_uid: string;  // vid (vocabulary id)
  term_tid: number;      // term id
  term_name: string;     // term name
  term_description: string | null; // term description
}

interface TaxonomyTerm {
  uid: string;
  name: string;
  parent_uid: string | null;
  description?: string;
}

interface TaxonomyStructure {
  taxonomy: {
    uid: string;
    name: string;
    description: string;
  };
  terms: TaxonomyTerm[];
}

/**
 * Execute SQL query with promise support
 */
const executeQuery = async (connection: mysql.Connection, query: string): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    connection.query(query, (error, results) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(results as any[]);
    });
  });
};

/**
 * Generate slug from name (similar to Contentstack uid format)
 */
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .substring(0, 50); // Limit length
};

/**
 * Get vocabulary names from Drupal database
 * Note: In Drupal 8+, vocabulary names are in the config table
 */
const getVocabularyNames = async (
  connection: mysql.Connection,
  projectId: string,
  destination_stack_id: string
): Promise<Record<string, string>> => {
  const srcFunc = 'getVocabularyNames';
  
  try {
    // Try to get vocabulary names from config table (Drupal 8+)
    const configQuery = `
      SELECT 
        SUBSTRING_INDEX(SUBSTRING_INDEX(name, '.', 3), '.', -1) as vid,
        JSON_UNQUOTE(JSON_EXTRACT(data, '$.name')) as name
      FROM config 
      WHERE name LIKE 'taxonomy.vocabulary.%'
      AND data IS NOT NULL
    `;
    
    const vocabularies = await executeQuery(connection, configQuery);
    
    const vocabNames: Record<string, string> = {};
    
    for (const vocab of vocabularies) {
      if (vocab.vid && vocab.name) {
        vocabNames[vocab.vid] = vocab.name;
      }
    }
    
    const message = getLogMessage(
      srcFunc,
      `Found ${Object.keys(vocabNames).length} vocabularies in config.`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', message);
    
    return vocabNames;
    
  } catch (error: any) {
    // Fallback: use vid as name if config method fails
    const message = getLogMessage(
      srcFunc,
      `Could not fetch vocabulary names from config, will use vid as name: ${error.message}`,
      {},
      error
    );
    await customLogger(projectId, destination_stack_id, 'warn', message);
    
    return {};
  }
};

/**
 * Fetch taxonomy hierarchy information
 * Note: Drupal uses taxonomy_term__parent or taxonomy_term_hierarchy table for hierarchy
 */
const getTermHierarchy = async (
  connection: mysql.Connection,
  projectId: string,
  destination_stack_id: string
): Promise<Record<number, number[]>> => {
  const srcFunc = 'getTermHierarchy';
  
  try {
    // Try different possible hierarchy table structures
    const hierarchyQueries = [
      // Drupal 8+ field-based hierarchy
      `SELECT entity_id as tid, parent_target_id as parent_tid 
       FROM taxonomy_term__parent 
       WHERE parent_target_id IS NOT NULL AND parent_target_id != 0`,
      
      // Drupal 7 style hierarchy
      `SELECT tid, parent 
       FROM taxonomy_term_hierarchy 
       WHERE parent IS NOT NULL AND parent != 0`
    ];
    
    let hierarchyData: any[] = [];
    
    for (const query of hierarchyQueries) {
      try {
        hierarchyData = await executeQuery(connection, query);
        if (hierarchyData.length > 0) {
          break; // Use the first successful query
        }
      } catch (queryError) {
        // Continue to next query if this one fails
        continue;
      }
    }
    
    const hierarchy: Record<number, number[]> = {};
    
    for (const item of hierarchyData) {
      const childTid = item.tid || item.entity_id;
      const parentTid = item.parent || item.parent_tid || item.parent_target_id;
      
      if (childTid && parentTid) {
        if (!hierarchy[parentTid]) {
          hierarchy[parentTid] = [];
        }
        hierarchy[parentTid].push(childTid);
      }
    }
    
    const message = getLogMessage(
      srcFunc,
      `Found ${Object.keys(hierarchy).length} parent-child relationships.`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', message);
    
    return hierarchy;
    
  } catch (error: any) {
    const message = getLogMessage(
      srcFunc,
      `Could not fetch term hierarchy: ${error.message}`,
      {},
      error
    );
    await customLogger(projectId, destination_stack_id, 'warn', message);
    
    return {};
  }
};

/**
 * Process taxonomy terms and organize by vocabulary
 */
const processTaxonomyData = async (
  terms: DrupalTaxonomyTerm[],
  vocabularyNames: Record<string, string>,
  hierarchy: Record<number, number[]>,
  projectId: string,
  destination_stack_id: string
): Promise<Record<string, TaxonomyStructure>> => {
  const srcFunc = 'processTaxonomyData';
  
  try {
    const taxonomies: Record<string, TaxonomyStructure> = {};
    
    // Group terms by vocabulary
    const termsByVocabulary: Record<string, DrupalTaxonomyTerm[]> = {};
    
    for (const term of terms) {
      if (!termsByVocabulary[term.taxonomy_uid]) {
        termsByVocabulary[term.taxonomy_uid] = [];
      }
      termsByVocabulary[term.taxonomy_uid].push(term);
    }
    
    // Create taxonomy structure for each vocabulary
    for (const [vid, vocabTerms] of Object.entries(termsByVocabulary)) {
      const vocabularyName = vocabularyNames[vid] || vid;
      
      const taxonomyStructure: TaxonomyStructure = {
        taxonomy: {
          uid: vid,
          name: vocabularyName,
          description: ""
        },
        terms: []
      };
      
      // Convert terms to Contentstack format
      for (const term of vocabTerms) {
        // 🏷️ Generate term UID using vocabulary prefix + term ID format
        const vocabularyPrefix = vid.toLowerCase();
        const termUid = `${vocabularyPrefix}_${term.term_tid}`;
        
        // Find parent if exists
        let parentUid: string | null = null;
        for (const [parentTid, childTids] of Object.entries(hierarchy)) {
          if (childTids.includes(term.term_tid)) {
            // Find parent term in the same vocabulary
            const parentTerm = vocabTerms.find(t => t.term_tid === parseInt(parentTid));
            if (parentTerm) {
              // 🏷️ Generate parent UID using same vocabulary prefix + term ID format
              parentUid = `${vocabularyPrefix}_${parentTerm.term_tid}`;
            }
            break;
          }
        }
        
        taxonomyStructure.terms.push({
          uid: termUid,
          name: term.term_name,
          parent_uid: parentUid,
          description: term.term_description || ""
        });
      }
      
      taxonomies[vid] = taxonomyStructure;
    }
    
    const message = getLogMessage(
      srcFunc,
      `Processed ${Object.keys(taxonomies).length} vocabularies with ${terms.length} total terms.`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', message);
    
    return taxonomies;
    
  } catch (error: any) {
    const message = getLogMessage(
      srcFunc,
      `Error processing taxonomy data: ${error.message}`,
      {},
      error
    );
    await customLogger(projectId, destination_stack_id, 'error', message);
    throw error;
  }
};

/**
 * Save taxonomy files to disk
 */
const saveTaxonomyFiles = async (
  taxonomies: Record<string, TaxonomyStructure>,
  taxonomiesPath: string,
  projectId: string,
  destination_stack_id: string
): Promise<void> => {
  const srcFunc = 'saveTaxonomyFiles';
  
  try {
    let filesSaved = 0;
    
    // Save individual taxonomy files (existing functionality)
    for (const [vid, taxonomy] of Object.entries(taxonomies)) {
      const filePath = path.join(taxonomiesPath, `${vid}.json`);
      await fs.promises.writeFile(filePath, JSON.stringify(taxonomy, null, 2), 'utf8');
      filesSaved++;
      
      const message = getLogMessage(
        srcFunc,
        `Saved taxonomy file: ${vid}.json with ${taxonomy.terms.length} terms.`,
        {}
      );
      await customLogger(projectId, destination_stack_id, 'info', message);
    }
    
    // Create consolidated taxonomies.json file with just vocabulary metadata
    const taxonomiesDataObject: Record<string, any> = {};
    
    for (const [vid, taxonomy] of Object.entries(taxonomies)) {
      taxonomiesDataObject[vid] = {
        uid: taxonomy.taxonomy.uid,
        name: taxonomy.taxonomy.name,
        description: taxonomy.taxonomy.description
      };
    }
    
    const taxonomiesFilePath = path.join(taxonomiesPath, 'taxonomies.json');
    await fs.promises.writeFile(taxonomiesFilePath, JSON.stringify(taxonomiesDataObject, null, 2), 'utf8');
    
    const consolidatedMessage = getLogMessage(
      srcFunc,
      `Saved consolidated taxonomies.json with ${Object.keys(taxonomiesDataObject).length} vocabularies.`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', consolidatedMessage);
    
    const summaryMessage = getLogMessage(
      srcFunc,
      `Successfully saved ${filesSaved} individual taxonomy files + 1 consolidated taxonomies.json file.`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', summaryMessage);
    
  } catch (error: any) {
    const message = getLogMessage(
      srcFunc,
      `Error saving taxonomy files: ${error.message}`,
      {},
      error
    );
    await customLogger(projectId, destination_stack_id, 'error', message);
    throw error;
  }
};

/**
 * Creates taxonomy files from Drupal database for migration to Contentstack.
 * 
 * Extracts taxonomy vocabularies and terms from Drupal database,
 * organizes them by vocabulary, and saves individual JSON files
 * for each vocabulary in the format expected by Contentstack.
 */
export const createTaxonomy = async (
  dbConfig: any,
  destination_stack_id: string,
  projectId: string
): Promise<void> => {
  const srcFunc = 'createTaxonomy';
  let connection: mysql.Connection | null = null;
  
  try {
    const taxonomiesPath = path.join(DATA, destination_stack_id, TAXONOMIES_DIR_NAME);
    
    // Create taxonomies directory
    await fs.promises.mkdir(taxonomiesPath, { recursive: true });

    const message = getLogMessage(
      srcFunc,
      `Exporting taxonomies...`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', message);

    // Create database connection
    connection = await getDbConnection(dbConfig, projectId, destination_stack_id);
    
    // Main SQL query to fetch taxonomy terms
    const taxonomyQuery = `
      SELECT
        f.vid AS taxonomy_uid,
        f.tid AS term_tid,
        f.name AS term_name,
        f.description__value AS term_description
      FROM taxonomy_term_field_data f
      ORDER BY f.vid, f.tid
    `;
    
    // Fetch taxonomy data
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
    
    // Get vocabulary names and hierarchy
    const [vocabularyNames, hierarchy] = await Promise.all([
      getVocabularyNames(connection, projectId, destination_stack_id),
      getTermHierarchy(connection, projectId, destination_stack_id)
    ]);
    
    // Process taxonomy data
    const taxonomies = await processTaxonomyData(
      taxonomyTerms,
      vocabularyNames,
      hierarchy,
      projectId,
      destination_stack_id
    );
    
    // Save taxonomy files
    await saveTaxonomyFiles(taxonomies, taxonomiesPath, projectId, destination_stack_id);

    const successMessage = getLogMessage(
      srcFunc,
      `Successfully exported ${Object.keys(taxonomies).length} taxonomies with ${taxonomyTerms.length} total terms.`,
      {}
    );
    await customLogger(projectId, destination_stack_id, 'info', successMessage);

  } catch (err) {
    const message = getLogMessage(
      srcFunc,
      `Error encountered while creating taxonomies.`,
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
