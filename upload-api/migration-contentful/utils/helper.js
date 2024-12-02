/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * External module Dependencies.
 */
const mkdirp = require('mkdirp');
const path = require('path');
const fs = require('fs');

 const readFile = function (filePath, parse) {
  parse = typeof parse == 'undefined' ? true : parse;
  filePath = path.resolve(filePath);
  let data;
  if (fs.existsSync(filePath)) data = parse ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : data;
  return data;
};

 const writeFile = function (filePath, data) {
  filePath = path.resolve(filePath);
  data = typeof data == 'object' ? JSON.stringify(data) : data || '{}';
  fs.writeFileSync(filePath, data, 'utf-8');
};

 const appendFile = function (filePath, data) {
  filePath = path.resolve(filePath);
  fs.appendFileSync(filePath, data);
};

 const makeDirectory = function () {
  for (let key in arguments) {
    let dirname = path.resolve(arguments[key]);
    if (!fs.existsSync(dirname)) mkdirp.sync(dirname);
  }
};

function deleteFolderSync(folderPath) {
  if (fs.existsSync(folderPath)) {
    fs.readdirSync(folderPath).forEach((file) => {
      const currentPath = path.join(folderPath, file);
      if (fs.lstatSync(currentPath).isDirectory()) {
        // Recurse
        deleteFolderSync(currentPath);
      } else {
        // Delete file
        fs.unlinkSync(currentPath);
      }
    });
    // Delete now-empty folder
    fs.rmdirSync(folderPath);
  }
}

module.exports = {
  readFile,
  writeFile,
  appendFile,
  makeDirectory,
  deleteFolderSync
};
