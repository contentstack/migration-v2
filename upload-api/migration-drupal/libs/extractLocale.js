'use strict';
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * External module dependencies.
 */
const { dbConnection} = require('../utils/helper');

/**
 * Apply locale transformation rules (same logic as API side)
 * - "und" alone → "en-us"
 * - "und" + "en-us" → both become "en"  
 * - "en" + "en-us" → "en" becomes "und", "en-us" stays
 * - All three → "en"+"und" become "und", "en-us" stays
 */
function applyLocaleTransformations(originalLocales) {
    const locales = [...originalLocales]; // Copy to avoid mutation
    const hasUnd = locales.includes('und');
    const hasEn = locales.includes('en');
    const hasEnUs = locales.includes('en-us');
    
    console.log(`🔍 Locale Analysis: hasUnd=${hasUnd}, hasEn=${hasEn}, hasEnUs=${hasEnUs}`);
    
    const transformedSet = new Set();
    
    // Apply transformation rules
    locales.forEach(locale => {
        if (locale === 'und') {
            if (hasEn && hasEnUs) {
                // If all three present, "und" stays as "und"
                transformedSet.add('und');
                console.log(`🔄 "und" stays as "und" (all three present)`);
            } else if (hasEnUs) {
                // If "und" + "en-us", "und" becomes "en"
                transformedSet.add('en');
                console.log(`🔄 Transforming "und" → "en" (en-us exists)`);
            } else {
                // If only "und", becomes "en-us"
                transformedSet.add('en-us');
                console.log(`🔄 Transforming "und" → "en-us"`);
            }
        } else if (locale === 'en-us') {
            if (hasUnd && !hasEn) {
                // If "und" + "en-us" (no en), "und" becomes "en", so keep "en-us"
                transformedSet.add('en-us');
                console.log(`🔄 "en-us" stays as "en-us" (und becomes en)`);
            } else {
                // Keep en-us as is in other cases
                transformedSet.add('en-us');
            }
        } else if (locale === 'en') {
            if (hasEnUs && !hasUnd) {
                // If "en" + "en-us" (no und), "en" becomes "und"
                transformedSet.add('und');
                console.log(`🔄 Transforming "en" → "und" (en-us exists, no und)`);
            } else {
                // Keep "en" as is in other cases
                transformedSet.add('en');
            }
        } else {
            // Keep other locales as is
            transformedSet.add(locale);
        }
    });
    
    return Array.from(transformedSet).sort();
}

const extractLocale = async ( systemConfig ) =>
{
    let connection;
    try
    {
    // Get database connection - pass your MySQL config
        connection = await dbConnection( systemConfig );

        // DYNAMIC locale extraction - query directly for unique language codes
        console.log('🌐 Extracting locales dynamically from Drupal database...');
        
        // Simple query to get all unique language codes from content
        const localeQuery = "SELECT DISTINCT langcode FROM node_field_data WHERE langcode IS NOT NULL AND langcode != '' ORDER BY langcode";
        
        const [localeRows] = await connection.promise().query(localeQuery);
        const originalLocales = localeRows.map(row => row.langcode).filter(locale => locale && locale.trim());
        
        console.log(`📍 Found ${originalLocales.length} original locales:`, originalLocales);
        
        // 🔄 Apply locale transformation rules for UI consistency
        const transformedLocales = applyLocaleTransformations(originalLocales);
        
        console.log(`✅ Transformed to ${transformedLocales.length} locales for UI:`, transformedLocales);
        
        return transformedLocales;
        
  } catch (error) {
    console.error(`Error reading JSON file:`, error);
    return [];
  }
};

module.exports = extractLocale;
