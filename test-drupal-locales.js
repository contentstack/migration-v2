const { createLocale } = await import('./api/src/services/drupal/locales.service.js');
const path = await import('path');
const fs = await import('fs');

// Test configuration using upload-api database
const testProject = {
  mysql: {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'riceuniversity2',
    port: '3306'
  }
};

const testDestinationStackId = 'test-drupal-locale-stack';
const testProjectId = 'test-project-123';

async function testDrupalLocales() {
  console.log('🧪 Testing Drupal Locale System...');
  console.log('📊 Database:', testProject.mysql.database);
  console.log('🎯 Stack ID:', testDestinationStackId);
  
  try {
    // Test the createLocale function
    await createLocale(testDestinationStackId, testProjectId, testProject);
    
    console.log('✅ Locale creation completed successfully!');
    
    // Check if files were created
    const localesDir = path.join('./api/cmsMigrationData', testDestinationStackId, 'locales');
    
    console.log('\n📁 Checking created files:');
    
    // Check master-locale.json
    const masterLocalePath = path.join(localesDir, 'master-locale.json');
    if (fs.existsSync(masterLocalePath)) {
      const masterLocale = JSON.parse(fs.readFileSync(masterLocalePath, 'utf8'));
      console.log('✅ master-locale.json:', JSON.stringify(masterLocale, null, 2));
    } else {
      console.log('❌ master-locale.json not found');
    }
    
    // Check locales.json
    const localesPath = path.join(localesDir, 'locales.json');
    if (fs.existsSync(localesPath)) {
      const locales = JSON.parse(fs.readFileSync(localesPath, 'utf8'));
      console.log('✅ locales.json:', JSON.stringify(locales, null, 2));
    } else {
      console.log('❌ locales.json not found');
    }
    
    // Check language.json
    const languagePath = path.join(localesDir, 'language.json');
    if (fs.existsSync(languagePath)) {
      const language = JSON.parse(fs.readFileSync(languagePath, 'utf8'));
      console.log('✅ language.json:', JSON.stringify(language, null, 2));
    } else {
      console.log('❌ language.json not found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testDrupalLocales().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});
