"use strict";
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * External module dependencies.
 */
const mkdirp = require("mkdirp");
const path = require("path");
const fs = require("fs");

/**
 * Internal module dependencies.
 */
const config = require('../config');
const { readFile, writeFile } = require("../utils/helper");

/**
 * Setup the folder path
 */
const contentfulFolderPath = path.resolve(
  config.data,
  config.contentful.contentful
);
/**
 * Functional Approach for ExtractContent
 */

const saveContentType = (contentTypes, editorInterface, prefix) => {
  try {
    const contentName = contentTypes.map((content) => {
      return content.sys.id.replace(/([A-Z])/g, '_$1').toLowerCase();
    });
    contentTypes.map((content) => {
      const jsonObj = [];

      const editor = editorInterface.find(
        (editor) => editor.sys.contentType.sys.id === content.sys.id
      );

      for (const valueType of content.fields) {
        const valueEditor = editor.controls.find(
          (value) => valueType.id === value.fieldId
        );
        jsonObj.push({
          prefix: prefix,
          contentUid: content.sys.id.replace(/([A-Z])/g, "_$1").toLowerCase(),
          contentDescription: content.description,
          contentfulID: content.sys.id,
          ...valueType,
          ...valueEditor,
          contentNames: contentName,
        });
      }

      writeFile(
        path.join(
          contentfulFolderPath,
          `${
            content.name.charAt(0).toUpperCase() +
            content.name.slice(1).replace(/[^\w\s]/g, "")
          }.json`
        ),
        JSON.stringify(jsonObj, null, 4)
      );
    });
  } catch (error) {
    console.error("Error saving content types:", error);
    throw error;
  }
};

const extractContentTypes = async (filePath, prefix) => {
  try {
    if (!fs.existsSync(contentfulFolderPath)) {
      mkdirp.sync(contentfulFolderPath);
    }
    
    const alldata = readFile(filePath);
    const { contentTypes, editorInterfaces } = alldata;

    if (contentTypes && contentTypes.length > 0) {
      saveContentType(contentTypes, editorInterfaces, prefix);
    } else {
      console.log("No content-type found");
    }
  } catch (error) {
    console.error("Error getting all content:", error);
    throw error;
  }
};

module.exports = extractContentTypes;
