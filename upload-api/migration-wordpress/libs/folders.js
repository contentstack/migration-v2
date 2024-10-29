"use strict";
/**
 * External module Dependencies.
 */
const path = require("path");
/**
 * Internal module Dependencies .
 */
const helper = require("../utils/helper");
const config = require("../config");

const saveFolder = (affix) => {
  try {
    const folderJSON = [
      {
        urlPath: "/assets/wordpressasset",
        uid: "wordpressasset",
        content_type: "application/vnd.contenstack.folder",
        tags: [],
        name: affix,
        is_dir: true,
        parent_uid: null,
        _version: 1,
      },
    ];

    const folderPath = path.join(
      process.cwd(),
      config.data,
      "assets",
      "folders.json"
    );
    helper.writeFile(folderPath, JSON.stringify(folderJSON, null, 4));

    console.log("Folder JSON created successfully.");
  } catch (error) {
    console.error("Error creating folder JSON:", error.message);
  }
}
const assetFolder = (affix) => {
  try {
    console.log(`Creating assets folder...`);
    if (affix) {
      return saveFolder(affix);
    }
    console.log("Assets folder creation completed.");
  } catch (error) {
    console.error("Error in folder creation process:", error.message);
    throw error;
  }
}
module.exports = assetFolder;
