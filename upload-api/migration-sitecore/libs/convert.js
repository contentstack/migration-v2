/**
 * External module Dependencies.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const fs = require("fs");
const parseString = require("xml2js").parseString;
const read = require("fs-readdir-recursive");
/**
 * Internal module Dependencies.
 */
const helper = require("../utils/helper");
const { MIGRATION_DATA_CONFIG } = require("../constants/index");
const config = {
  "data": "./" + MIGRATION_DATA_CONFIG.DATA,
  "backup": "./backupMigrationData",
  "xml_filename": "",
  "sitecore_folder": "",
  "json_file": "",
  "json_filename": "data.json",
  "table_prefix": "wp_",
  "entryfolder": MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME,
}
/**
 * Create folders and files if they are not created
 */

function ExtractFiles(sitecore_folder) {
  const xml_folder = read(sitecore_folder);

  for (let i = 0; i < xml_folder.length; i++) {
    const file = xml_folder[i];

    // Only process .xml files
    if (file?.endsWith?.(".xml")) {
      const xml_data_path = path?.join?.(sitecore_folder, file);
      const xml_content = helper?.readXMLFile?.(xml_data_path);

      // Skip empty or non-XML content
      if (!xml_content?.trim?.().startsWith?.("<")) {
        console.warn(`⛔ Skipping non-XML content: ${file}`);
        continue;
      }

      const jsonFilePath = xml_data_path?.replace?.(/\.xml$/, '');
      parseString(xml_content, { explicitArray: false }, function (err, result) {
        if (err) {
          console.error("❌ Failed to parse XML:", err);
          return;
        }

        const filePath = path.join(jsonFilePath, config?.json_filename);

        try {
          // Delete existing .json files in that directory
          const jsonFileArray = read?.(jsonFilePath)?.filter?.(f => f?.endsWith?.(".json")) ?? [];
          for (const jsonFile of jsonFileArray) {
            const absolutePath = path.resolve(path.join(jsonFilePath, jsonFile));
            fs?.unlinkSync?.(absolutePath);
          }

          // Write the parsed XML as JSON
          fs?.writeFileSync?.(filePath, JSON.stringify(result, null, 4), "utf8");

        } catch (error) {
          console.error("⚠️ Error deleting or writing file:", error);
        }
      });
    }
  }
}


module.exports = ExtractFiles;