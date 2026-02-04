/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * External module Dependencies.
 */
const mkdirp = require('mkdirp');
const path = require('path');
const fs = require('fs');
const mysql = require('mysql2');

const readFile = function (filePath, parse) {
  parse = typeof parse === 'undefined' ? true : parse;
  filePath = path.resolve(filePath);
  let data;
  if (fs.existsSync(filePath)) {
    const fileContents = fs.readFileSync(filePath, 'utf-8');
    data = parse ? JSON.parse(fileContents) : fileContents;
  }
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
  if (folderPath && fs.existsSync(folderPath)) {
    const files = fs.readdirSync(folderPath);
    if (files && Array.isArray(files)) {
      files.forEach((file) => {
        if (!file) return;
        const currentPath = path.join(folderPath, file);
        if (fs.existsSync(currentPath) && fs.lstatSync(currentPath).isDirectory()) {
          // Recurse
          deleteFolderSync(currentPath);
        } else if (fs.existsSync(currentPath)) {
          // Delete file
          fs.unlinkSync(currentPath);
        }
      });
    }
    // Delete now-empty folder
    if (fs.existsSync(folderPath)) {
      fs.rmdirSync(folderPath);
    }
  }
}

function dbConnection(config) {
  // Parse port with explicit NaN handling
  const rawPort = Number(config['mysql']['port']);
  const port = Number.isFinite(rawPort) ? rawPort : 3306;

  var connection = mysql.createConnection({
    host: config['mysql']['host'],
    user: config['mysql']['user'],
    password: config['mysql']['password'],
    database: config['mysql']['database'],
    port: port
  });
  return connection;
}

module.exports = {
  readFile,
  writeFile,
  appendFile,
  makeDirectory,
  deleteFolderSync,
  dbConnection
};
