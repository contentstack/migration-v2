const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
const { unserialize } = require('php-unserialize');

/**
 * Execute SQL query with promise support
 */
const executeQuery = async (connection, query) => {
  return new Promise((resolve, reject) => {
    connection.query(query, (error, results) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(results);
    });
  });
};

/**
 * Generate slug from name (similar to Contentstack uid format)
 */
const generateSlug = (name) => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '_')         // Replace spaces with underscores
    .replace(/-+/g, '_')          // Replace hyphens with underscores
    .replace(/_+/g, '_')          // Replace multiple underscores with single
    .replace(/^_|_$/g, '');       // Remove leading/trailing underscores
};

/**
 * Extract taxonomy vocabularies (parent-level only) from Drupal database
 * and save them to drupalMigrationData/taxonomySchema/taxonomySchema.json
 * 
 * @param {Object} dbConfig - Database configuration
 * @returns {Promise<Array>} Array of vocabulary objects with uid and name
 */
const extractTaxonomy = async (dbConfig) => {
  console.log('🔍 === EXTRACTING TAXONOMY VOCABULARIES ===');
  console.log('📋 Database Config:', JSON.stringify(dbConfig, null, 2));
  
  let connection;
  
  try {
    // Create database connection
    connection = mysql.createConnection(dbConfig);
    
    // Test connection
    await new Promise((resolve, reject) => {
      connection.connect((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    console.log('✅ Database connection successful');
    
    // Extract vocabularies from Drupal config table (Drupal 8+)
    // This gets only the parent vocabularies, not individual terms
    const vocabularyQuery = `
      SELECT 
        SUBSTRING_INDEX(SUBSTRING_INDEX(name, '.', 3), '.', -1) as vid,
        CONVERT(data USING utf8) as data
      FROM config 
      WHERE name LIKE 'taxonomy.vocabulary.%'
      AND data IS NOT NULL
    `;
    
    console.log('🔍 Executing vocabulary query...');
    const vocabularies = await executeQuery(connection, vocabularyQuery);
    
    console.log(`📋 Found ${vocabularies.length} vocabularies`);
    
    // Transform vocabularies to required format
    const taxonomySchema = [];
    
    for (const vocab of vocabularies) {
      try {
        if (vocab.vid && vocab.data) {
          // Unserialize the PHP data to get vocabulary details
          const vocabularyData = unserialize(vocab.data);
          
          if (vocabularyData && vocabularyData.name) {
            const uid = generateSlug(vocab.vid); // Use vid as base for uid
            const name = vocabularyData.name;
            
            taxonomySchema.push({
              uid: uid,
              name: name
            });
            
            console.log(`✅ Added vocabulary: ${uid} (${name})`);
          }
        }
      } catch (parseError) {
        console.warn(`⚠️ Failed to parse vocabulary data for ${vocab.vid}:`, parseError.message);
      }
    }
    
    // Create output directory
    const outputDir = path.join(__dirname, '..', '..', 'drupalMigrationData', 'taxonomySchema');
    await fs.promises.mkdir(outputDir, { recursive: true });
    
    // Save taxonomy schema to file
    const outputPath = path.join(outputDir, 'taxonomySchema.json');
    await fs.promises.writeFile(outputPath, JSON.stringify(taxonomySchema, null, 2));
    
    console.log(`✅ Taxonomy schema saved to: ${outputPath}`);
    console.log(`📊 Total vocabularies extracted: ${taxonomySchema.length}`);
    console.log('==========================================');
    
    return taxonomySchema;
    
  } catch (error) {
    console.error('❌ Error extracting taxonomy:', error.message);
    throw error;
  } finally {
    if (connection) {
      connection.end();
    }
  }
};

module.exports = extractTaxonomy;
