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
 * Processes and saves content types by combining data from content types and their respective editor interfaces.
 * 
 * @param {Array} contentTypes - An array of content type objects containing content type details.
 * @param {Array} editorInterface - An array of editor interface objects that map content types to their corresponding editor controls.
 * @param {string} prefix - A prefix to be used when saving content types, typically used to namespace the saved files.
 * 
 * @returns {void} This function doesn't return a value but writes content type data to files.
 * 
 * @description
 * This function processes the provided `contentTypes` and `editorInterface` data to map fields and their editors,
 * and then generates a JSON object for each field in the content type. It writes each content type's data to a separate
 * JSON file in the specified `contentfulFolderPath`. The files are named using the content type's name, formatted and 
 * cleaned for use as a valid filename.
 * 
 * @throws {Error} If an error occurs while processing or saving the content types, the error is thrown.
 * 
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

/**
 * Extracts and processes content types from a given file and saves them.
 * 
 * @param {string} filePath - The path to the file containing content type data.
 * @param {string} prefix - A prefix to be used when saving content types.
 * 
 * @returns {Promise<void>} A promise that resolves once the content types are saved.
 * 
 * @description
 * This function reads a file containing content type data, checks if the `contentTypes` array exists
 * and contains any content types. If valid content types are found, it calls a function (`saveContentType`)
 * to process and save them. If no content types are found, a message is logged to the console.
 * The function also ensures that a folder (defined by `contentfulFolderPath`) exists, creating it if necessary.
 * 
 * @throws {Error} If an error occurs during the extraction or saving of content types, the error is thrown.
 * 
 */
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
