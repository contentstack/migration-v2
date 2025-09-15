import { createLocale } from './src/services/drupal/locales.service.js';
import mysql from 'mysql2/promise';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Test configuration using upload-api database (riceuniversity2)
const testProject = {
  mysql: {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'riceuniversity2',
    port: 3306
  }
};

const testDestinationStackId = 'test-drupal-locale-stack';
const testProjectId = 'test-project-123';

async function testDrupalLocaleQueries() {
  console.log('🧪 Testing Drupal Locale SQL Queries...');
  console.log('📊 Database:', testProject.mysql.database);
  
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection(testProject.mysql);
    console.log('✅ Database connection established');
    
    // 1. Test master locale query
    console.log('\n🔍 Testing Master Locale Query...');
    const masterLocaleQuery = `
      SELECT SUBSTRING_INDEX( 
        SUBSTRING_INDEX(CONVERT(data USING utf8), 'default_langcode";s:2:"', -1), 
        '"', 1 
      ) as master_locale 
      FROM config 
      WHERE name = 'system.site'
    `;
    
    const [masterRows] = await connection.execute(masterLocaleQuery);
    const masterLocaleCode = masterRows[0]?.master_locale || 'en';
    console.log('✅ Master Locale:', masterLocaleCode);
    
    // 2. Test all locales query
    console.log('\n🔍 Testing All Locales Query...');
    const allLocalesQuery = `
      SELECT DISTINCT langcode 
      FROM node_field_data 
      WHERE langcode IS NOT NULL AND langcode != '' 
      ORDER BY langcode
    `;
    
    const [allLocaleRows] = await connection.execute(allLocalesQuery);
    const allLocaleCodes = allLocaleRows.map(row => row.langcode);
    console.log('✅ All Locales:', allLocaleCodes);
    
    // 3. Test non-master locales query
    console.log('\n🔍 Testing Non-Master Locales Query...');
    const nonMasterLocalesQuery = `
      SELECT DISTINCT n.langcode
      FROM node_field_data n
      WHERE n.langcode IS NOT NULL
        AND n.langcode != ''
        AND n.langcode != (
          SELECT 
             SUBSTRING_INDEX(
                SUBSTRING_INDEX(CONVERT(data USING utf8), 'default_langcode";s:2:"', -1),
                '"',
                1
             )
          FROM config 
          WHERE name = 'system.site'
          LIMIT 1
        )
      ORDER BY n.langcode
    `;
    
    const [nonMasterRows] = await connection.execute(nonMasterLocalesQuery);
    const nonMasterLocaleCodes = nonMasterRows.map(row => row.langcode);
    console.log('✅ Non-Master Locales:', nonMasterLocaleCodes);
    
    await connection.end();
    
    // 4. Test Contentstack API
    console.log('\n🔍 Testing Contentstack Locales API...');
    try {
      const response = await axios.get('https://app.contentstack.com/api/v3/locales?include_all=true');
      const contentstackLocales = response.data?.locales || {};
      const localeCount = Object.keys(contentstackLocales).length;
      console.log('✅ Contentstack API Response:', `${localeCount} locales fetched`);
      
      // Test locale name lookup for found codes
      console.log('\n🔍 Testing Locale Name Mapping...');
      allLocaleCodes.forEach(code => {
        const name = contentstackLocales[code] || contentstackLocales[code.toLowerCase()] || 'Unknown';
        console.log(`   ${code} → ${name}`);
      });
      
    } catch (apiError) {
      console.error('❌ Contentstack API Error:', apiError.message);
    }
    
    // 5. Test the actual createLocale function
    console.log('\n🔍 Testing createLocale Function...');
    try {
      await createLocale(testDestinationStackId, testProjectId, testProject);
      console.log('✅ createLocale function executed successfully');
      
      // Check if files were created
      const localesDir = path.join('./cmsMigrationData', testDestinationStackId, 'locales');
      console.log('📂 Checking directory:', localesDir);
      
      if (fs.existsSync(localesDir)) {
        const files = fs.readdirSync(localesDir);
        console.log('📁 Created files:', files);
        
        // Read and display each file
        files.forEach(file => {
          const filePath = path.join(localesDir, file);
          const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          console.log(`\n📄 ${file}:`, JSON.stringify(content, null, 2));
        });
      } else {
        console.log('❌ Locales directory not found');
      }
      
    } catch (createError) {
      console.error('❌ createLocale function failed:', createError);
      console.error('Stack trace:', createError.stack);
    }
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testDrupalLocaleQueries().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});
