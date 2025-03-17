"use strict";
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * External module dependencies.
 */
const fs = require("fs");

/**
 * @description
 * Function to retrieve the unique source locales from the legacy CMS 
 * @param {*} jsonFilePath - Local file path of the exported data
 * @returns {Array} - Array of unique locales used in the exported data
 */
const extractLocale = async (jsonFilePath) => {
    try {
        const rawData = fs?.readFileSync?.(jsonFilePath, "utf8");
        const jsonData = JSON?.parse?.(rawData);

        // Extract unique language codes from locales array
        const uniqueLanguages = new Set();
        if (Array?.isArray?.(jsonData?.locales)) {
            jsonData?.locales?.forEach?.(locale => {
                if (locale?.code) {
                    uniqueLanguages.add(locale?.code); // Normalize to lowercase
                }
            });
        }

        return [...uniqueLanguages]; // Convert Set to array for output
    } catch (error) {
        console.error(`Error reading JSON file:`, error.message);
        return [];
    }
};

module.exports = extractLocale