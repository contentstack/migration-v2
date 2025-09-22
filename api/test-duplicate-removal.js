#!/usr/bin/env node

/**
 * Test script to verify duplicate field removal logic
 */

console.log('🧪 Testing Duplicate Field Removal Logic\n');

// Simulate the mergedData that would contain duplicates
const testMergedData = {
  // Duplicate case 1: both body_value and body exist
  body_value: 'content from _value field',
  body: 'content from base field',

  // Duplicate case 2: both field_formatted_title_value and field_formatted_title exist
  field_formatted_title_value: 'title from _value field',
  field_formatted_title: 'title from base field',

  // Duplicate case 3: both field_external_link_value and field_external_link exist
  field_external_link_value: 'link from _value field',
  field_external_link: 'link from base field',

  // Non-duplicate case: only _value field exists
  field_only_value_exists_value: 'only value field',

  // Non-duplicate case: only base field exists
  field_only_base_exists: 'only base field',

  // Other fields
  title: 'Article Title',
  nid: 496,
  created: '2019-09-09T13:09:29.000Z',
};

console.log('📋 Input (with duplicates):');
console.log(JSON.stringify(testMergedData, null, 2));

// Apply the duplicate removal logic
const cleanedEntry = {};
for (const [key, val] of Object.entries(testMergedData)) {
  if (val !== null && val !== undefined && val !== '') {
    // Check if this is a suffixed field (_value, _status, _uri) and if a non-suffixed version exists
    const isValueField = key.endsWith('_value');
    const isStatusField = key.endsWith('_status');
    const isUriField = key.endsWith('_uri');

    if (isValueField) {
      const baseFieldName = key.replace('_value', '');
      // Only include the _value field if the base field doesn't exist
      if (!testMergedData.hasOwnProperty(baseFieldName)) {
        cleanedEntry[key] = val;
        console.log(`✅ Keeping _value field: ${key} (no base field found)`);
      } else {
        console.log(
          `🗑️ Removing _value field: ${key} (base field ${baseFieldName} exists)`
        );
      }
      // If base field exists, skip the _value field (base field takes priority)
    } else if (isStatusField) {
      const baseFieldName = key.replace('_status', '');
      // Only include the _status field if the base field doesn't exist
      if (!testMergedData.hasOwnProperty(baseFieldName)) {
        cleanedEntry[key] = val;
        console.log(`✅ Keeping _status field: ${key} (no base field found)`);
      } else {
        console.log(
          `🗑️ Removing _status field: ${key} (base field ${baseFieldName} exists)`
        );
      }
      // If base field exists, skip the _status field (base field takes priority)
    } else if (isUriField) {
      const baseFieldName = key.replace('_uri', '');
      // Only include the _uri field if the base field doesn't exist
      if (!testMergedData.hasOwnProperty(baseFieldName)) {
        cleanedEntry[key] = val;
        console.log(`✅ Keeping _uri field: ${key} (no base field found)`);
      } else {
        console.log(
          `🗑️ Removing _uri field: ${key} (base field ${baseFieldName} exists)`
        );
      }
      // If base field exists, skip the _uri field (base field takes priority)
    } else {
      // For non-suffixed fields, always include them
      cleanedEntry[key] = val;
      console.log(`✅ Keeping base field: ${key}`);
    }
  }
}

console.log('\n🎯 Output (duplicates removed):');
console.log(JSON.stringify(cleanedEntry, null, 2));

console.log('\n📊 Summary:');
console.log(`Input fields: ${Object.keys(testMergedData).length}`);
console.log(`Output fields: ${Object.keys(cleanedEntry).length}`);
console.log(
  `Removed duplicates: ${
    Object.keys(testMergedData).length - Object.keys(cleanedEntry).length
  }`
);

// Verify no duplicates remain
const hasBodyDuplicate =
  cleanedEntry.hasOwnProperty('body') &&
  cleanedEntry.hasOwnProperty('body_value');
const hasTitleDuplicate =
  cleanedEntry.hasOwnProperty('field_formatted_title') &&
  cleanedEntry.hasOwnProperty('field_formatted_title_value');
const hasLinkDuplicate =
  cleanedEntry.hasOwnProperty('field_external_link') &&
  cleanedEntry.hasOwnProperty('field_external_link_value');

console.log(`\n✅ Verification:`);
console.log(
  `Body duplicate removed: ${!hasBodyDuplicate ? '✅ YES' : '❌ NO'}`
);
console.log(
  `Title duplicate removed: ${!hasTitleDuplicate ? '✅ YES' : '❌ NO'}`
);
console.log(
  `Link duplicate removed: ${!hasLinkDuplicate ? '✅ YES' : '❌ NO'}`
);
