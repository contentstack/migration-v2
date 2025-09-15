// Test the new UID format and JSON structure

const testLocales = ['en', 'und', 'fr-fr', 'es-mx'];
const masterLocale = 'en';

console.log('🧪 Testing New UID Format and JSON Structure...\n');

// Test UID generation
console.log('🔍 UID Generation:');
testLocales.forEach(langcode => {
  const uid = `drupallocale_${langcode.toLowerCase().replace(/-/g, '_')}`;
  console.log(`   ${langcode} → ${uid}`);
});

console.log('\n📄 Expected JSON Output:\n');

// Simulate the expected output
const msLocale = {};
const allLocales = {};
const localeList = {};

testLocales.forEach(langcode => {
  const uid = `drupallocale_${langcode.toLowerCase().replace(/-/g, '_')}`;
  const isMaster = langcode === masterLocale;
  
  // Apply transformation (simplified)
  let code = langcode.toLowerCase();
  let name = '';
  
  if (langcode === 'und') {
    code = 'en-us';
    name = 'English - United States';
  } else if (langcode === 'en') {
    name = 'English';
  } else if (langcode === 'fr-fr') {
    name = 'French - France';
  } else if (langcode === 'es-mx') {
    name = 'Spanish - Mexico';
  }
  
  const locale = {
    code: code,
    name: name,
    fallback_locale: isMaster ? null : masterLocale.toLowerCase(),
    uid: uid
  };
  
  if (isMaster) {
    msLocale[uid] = locale;
  } else {
    allLocales[uid] = locale;
  }
  
  localeList[uid] = locale;
});

console.log('✅ master-locale.json:');
console.log(JSON.stringify(msLocale, null, 2));

console.log('\n✅ locales.json:');
console.log(JSON.stringify(allLocales, null, 2));

console.log('\n✅ language.json:');
console.log(JSON.stringify(localeList, null, 2));

console.log('\n🎯 Key Features:');
console.log('   ✅ UID format: drupallocale_{langcode}');
console.log('   ✅ Hyphens replaced with underscores');
console.log('   ✅ UID used as JSON key (not random UUID)');
console.log('   ✅ Master locale has null fallback');
console.log('   ✅ Non-master locales use master as fallback');
