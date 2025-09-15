const mysql = require('mysql2/promise');
const axios = require('axios');

// Test configuration using upload-api database
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'riceuniversity2',
  port: 3306
};

async function testDrupalLocaleQueries() {
  console.log('🧪 Testing Drupal Locale SQL Queries...');
  console.log('📊 Database:', dbConfig.database);
  
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection(dbConfig);
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
    
    // 4. Test Contentstack API
    console.log('\n🔍 Testing Contentstack Locales API...');
    try {
      const response = await axios.get('https://app.contentstack.com/api/v3/locales?include_all=true');
      const contentstackLocales = response.data?.locales || {};
      const localeCount = Object.keys(contentstackLocales).length;
      console.log('✅ Contentstack API Response:', `${localeCount} locales fetched`);
      
      // Show sample locales
      const sampleLocales = Object.entries(contentstackLocales).slice(0, 5);
      console.log('📋 Sample Locales:', sampleLocales);
      
      // Test locale name lookup for found codes
      console.log('\n🔍 Testing Locale Name Mapping...');
      allLocaleCodes.forEach(code => {
        const name = contentstackLocales[code] || contentstackLocales[code.toLowerCase()] || 'Unknown';
        console.log(`   ${code} → ${name}`);
      });
      
    } catch (apiError) {
      console.error('❌ Contentstack API Error:', apiError.message);
    }
    
    // 5. Test transformation logic
    console.log('\n🔍 Testing Transformation Logic...');
    const hasUnd = allLocaleCodes.includes('und');
    const hasEn = allLocaleCodes.includes('en');
    const hasEnUs = allLocaleCodes.includes('en-us');
    
    console.log('📊 Locale Analysis:');
    console.log(`   Has "und": ${hasUnd}`);
    console.log(`   Has "en": ${hasEn}`);
    console.log(`   Has "en-us": ${hasEnUs}`);
    console.log(`   Master Locale: ${masterLocaleCode}`);
    
    // Apply transformation rules
    console.log('\n🔄 Applying Transformation Rules...');
    allLocaleCodes.forEach(locale => {
      let transformedCode = locale.toLowerCase();
      let transformedName = '';
      let isMaster = locale === masterLocaleCode;
      
      if (locale === 'und') {
        if (hasEnUs) {
          transformedCode = 'en';
          transformedName = 'English';
        } else {
          transformedCode = 'en-us';
          transformedName = 'English - United States';
        }
      } else if (locale === 'en-us') {
        if (hasUnd) {
          transformedCode = 'en';
          transformedName = 'English';
        }
      } else if (locale === 'en' && hasEnUs) {
        transformedCode = 'und';
        transformedName = 'Language Neutral';
      }
      
      console.log(`   ${locale} → ${transformedCode} (${transformedName || 'API lookup'}) [${isMaster ? 'MASTER' : 'regular'}]`);
    });
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
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
