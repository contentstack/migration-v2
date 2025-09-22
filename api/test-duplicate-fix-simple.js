#!/usr/bin/env node

/**
 * Simple test script to verify duplicate field fix
 * Tests the core duplicate removal logic without complex imports
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Duplicate Field Fix - Simple Version\n');
console.log('===============================================\n');

// Simulate the exact duplicate removal logic from entries.service.ts
function testDuplicateRemovalLogic(mergedData) {
  console.log('📋 Input Data (with potential duplicates):');
  console.log(JSON.stringify(mergedData, null, 2));
  console.log('');

  // Apply the exact cleanup logic from the service
  const cleanedEntry = {};
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
        if (!mergedData.hasOwnProperty(baseFieldName)) {
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
        if (!mergedData.hasOwnProperty(baseFieldName)) {
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

  console.log('\n🎯 Output Data (duplicates removed):');
  console.log(JSON.stringify(cleanedEntry, null, 2));
  console.log('');

  return cleanedEntry;
}

// Test cases based on your actual entry structure
function runTestCases() {
  const testCases = [
    {
      name: 'Your Actual Entry Structure',
      data: {
        nid: 496,
        title: 'Creativity: 13 Ways to Look at It',
        langcode: 'en',
        created: '2019-09-09T13:09:29.000Z',
        type: 'article',

        // These are the duplicates from your actual file
        body_value: {
          type: 'doc',
          uid: '025c76b8546a46b9aacfbea3a4ea15b3',
          attrs: {},
          children: [
            {
              type: 'p',
              attrs: {},
              uid: 'f63185c9190d4f5aac92ada099e08d3c',
              children: [
                {
                  text: 'Every day, we see the spark of imagination and invention...',
                },
              ],
            },
          ],
        },
        body: {
          type: 'doc',
          uid: '0fa04056a606443f8e3417086b88cd38',
          attrs: {},
          children: [
            {
              type: 'p',
              attrs: {},
              uid: '6e0be5417c9048d1a2c36ed42d242813',
              children: [
                {
                  text: 'Every day, we see the spark of imagination and invention...',
                },
              ],
            },
          ],
        },
        field_external_link_value:
          'https://magazine.rice.edu/2019/05/13-ways-of-looking-at-creativity/?utm_source=Hero&utm_medium=thirteen&utm_campaign=Hero%20Links',
        field_external_link:
          'https://magazine.rice.edu/2019/05/13-ways-of-looking-at-creativity/?utm_source=Hero&utm_medium=thirteen&utm_campaign=Hero%20Links',
        field_formatted_title_value: '<p><strong>Creativity</strong></p>\r\n',
        field_formatted_title: {
          type: 'doc',
          uid: '2b5aac7ee1e44194a8d41ab806753677',
          attrs: {},
          children: [
            {
              type: 'p',
              attrs: {},
              uid: 'cce203a33e0640d7a7ab389055638635',
              children: [
                { text: 'Creativity', attrs: { style: {} }, bold: true },
              ],
            },
          ],
        },
        field_subtitle_value: '13 WAYS TO LOOK AT IT',
        field_subtitle: '13 WAYS TO LOOK AT IT',
        uid: 'content_type_entries_title_496',
        locale: 'en',
      },
    },
    {
      name: 'Mixed Scenarios',
      data: {
        // Case 1: Both _value and base exist (should remove _value)
        test_field_value: 'value version',
        test_field: 'base version',

        // Case 2: Only _value exists (should keep _value)
        only_value_field_value: 'only value exists',

        // Case 3: Only base exists (should keep base)
        only_base_field: 'only base exists',

        // Case 4: Status fields
        comment_status: 1,
        comment: 'processed comment',

        // Case 5: URI fields
        link_uri: 'https://example.com',
        link: { title: 'Example', href: 'https://example.com' },

        // Regular fields
        title: 'Test Title',
        nid: 123,
      },
    },
  ];

  console.log('🧪 Running Test Cases\n');

  let allTestsPassed = true;

  testCases.forEach((testCase, index) => {
    console.log(`TEST ${index + 1}: ${testCase.name}`);
    console.log('='.repeat(testCase.name.length + 10));

    const result = testDuplicateRemovalLogic(testCase.data);

    // Check for duplicates
    const fieldNames = Object.keys(result);
    const duplicates = [];

    fieldNames.forEach((field) => {
      if (field.endsWith('_value')) {
        const baseField = field.replace('_value', '');
        if (fieldNames.includes(baseField)) {
          duplicates.push({ suffix: field, base: baseField });
        }
      } else if (field.endsWith('_status')) {
        const baseField = field.replace('_status', '');
        if (fieldNames.includes(baseField)) {
          duplicates.push({ suffix: field, base: baseField });
        }
      } else if (field.endsWith('_uri')) {
        const baseField = field.replace('_uri', '');
        if (fieldNames.includes(baseField)) {
          duplicates.push({ suffix: field, base: baseField });
        }
      }
    });

    console.log('📊 Test Results:');
    console.log(`   Input fields: ${Object.keys(testCase.data).length}`);
    console.log(`   Output fields: ${fieldNames.length}`);
    console.log(`   Duplicates found: ${duplicates.length}`);

    if (duplicates.length === 0) {
      console.log('   ✅ PASSED - No duplicates found!');
    } else {
      console.log('   ❌ FAILED - Duplicates still exist:');
      duplicates.forEach((dup) => {
        console.log(`      - ${dup.suffix} + ${dup.base}`);
      });
      allTestsPassed = false;
    }

    console.log('\n');
  });

  return allTestsPassed;
}

// Test the specific case from your JSON file
function testYourSpecificCase() {
  console.log('🎯 Testing Your Specific Case\n');
  console.log('=============================\n');

  // This is exactly what should be in your JSON after the fix
  const expectedCleanResult = {
    nid: 496,
    title: 'Creativity: 13 Ways to Look at It',
    langcode: 'en',
    created: '2019-09-09T13:09:29.000Z',
    type: 'article',
    uid: 'content_type_entries_title_496',
    locale: 'en',
    // Only these should remain (no _value versions)
    body: {
      /* processed content */
    },
    field_external_link:
      'https://magazine.rice.edu/2019/05/13-ways-of-looking-at-creativity/?utm_source=Hero&utm_medium=thirteen&utm_campaign=Hero%20Links',
    field_formatted_title: {
      /* processed content */
    },
    field_subtitle: '13 WAYS TO LOOK AT IT',
  };

  console.log(
    '✅ Expected Clean Result (what you should see after migration):'
  );
  console.log('Fields that should exist:');
  Object.keys(expectedCleanResult).forEach((field) => {
    console.log(`   - ${field}`);
  });

  console.log('\n❌ Fields that should NOT exist:');
  console.log('   - body_value');
  console.log('   - field_external_link_value');
  console.log('   - field_formatted_title_value');
  console.log('   - field_subtitle_value');

  console.log('\n💡 After running migration, check your JSON file:');
  console.log(
    '   /Users/saurav.upadhyay/Expert Service/Contentstack Migration/migration-v2/api/cmsMigrationData/blta4dadbc9c65d73cb/entries/article/en/en.json'
  );
  console.log(
    '   It should only contain the fields listed above, not the _value versions.'
  );
}

// Main execution
function main() {
  console.log('🚀 Starting Duplicate Field Fix Tests\n');

  const testResults = runTestCases();

  testYourSpecificCase();

  console.log('\n📊 FINAL RESULTS');
  console.log('================');
  console.log(`All tests passed: ${testResults ? '✅ YES' : '❌ NO'}`);

  if (testResults) {
    console.log(
      '\n🎉 SUCCESS: The duplicate removal logic is working correctly!'
    );
    console.log('✅ The fix should work when you run the full migration.');
    console.log('\n🚀 Next Steps:');
    console.log('   1. Run the migration from the UI');
    console.log('   2. Check the generated JSON files');
    console.log(
      '   3. Verify no _value suffixes remain when base fields exist'
    );
  } else {
    console.log('\n❌ FAILURE: The logic needs more work.');
    console.log('⚠️ Do not run the full migration yet.');
  }

  process.exit(testResults ? 0 : 1);
}

// Run the test
main();
