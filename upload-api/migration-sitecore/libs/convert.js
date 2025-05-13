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
  const xml_folder = read(sitecore_folder)
  for (let i = 0; i < xml_folder.length; i++) {
    if (xml_folder?.[i]?.endsWith?.("xml")) {
      const xml_data = path?.join?.(sitecore_folder, xml_folder?.[i]);
      const jsonFilePath = xml_data?.replace?.('xml', '');
      parseString(helper?.readXMLFile?.(xml_data), { explicitArray: false }, function (err, result) {
        if (err) {
          console.error("failed to parse xml: ", err);
        } else {
          const filePath = path.join(jsonFilePath, config?.json_filename);
          try {
            const jsonFileArray = read?.(jsonFilePath)?.filter?.((fileExt) => fileExt?.includes?.('.json')) ?? [];
            for (const ext of jsonFileArray) {
              const absolutePath = path?.resolve?.(path?.join?.(jsonFilePath, ext));
              fs?.unlinkSync?.(absolutePath);
            }
          } catch (error) {
            console.error("Error deleting file:", error);
          }
          fs.writeFileSync(filePath, JSON.stringify(result, null, 4), "utf8");
        }
      })
    }
  }
}




module.exports = ExtractFiles;