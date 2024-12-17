/**
 * External module Dependencies.
 */
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const mysql = require('mysql2');

//const mysql = require('mariadb');

/**
 * Internal module Dependencies.
 */

exports.readFile = function (filePath, parse) {
  parse = typeof parse == 'undefined' ? true : parse;
  filePath = path.resolve(filePath);
  var data;
  if (fs.existsSync(filePath))
    data = parse ? JSON.parse(fs.readFileSync(filePath, 'utf-8')) : data;
  return data;
};

exports.writeFile = function (filePath, data) {
  filePath = path.resolve(filePath);
  data = typeof data == 'object' ? JSON.stringify(data) : data || '{}';
  fs.writeFileSync(filePath, data, 'utf-8');
};

exports.writeFileAsync = async function (filePath, data, tabSpaces = 4) {
  filePath = path.resolve(filePath);
  data = typeof data == "object" ? JSON.stringify(data, null, tabSpaces) : data || "{}";
  await fs.promises.writeFile(filePath, data, "utf-8");
};

exports.appendFile = function (filePath, data) {
  filePath = path.resolve(filePath);
  fs.appendFileSync(filePath, data);
};

exports.makeDirectory = function () {
  for (var key in arguments) {
    var dirname = path.resolve(arguments[key]);
    if (!fs.existsSync(dirname)) mkdirp.sync(dirname);
  }
};

exports.connect = function ({
  host,
  user,
  password,
  database,
}) {
  const mysqlConfig ={
    host: host,
    user: user,
    password: password,
    database: database,
  }
  if(host && host !== ""){  
  const connection = mysql.createConnection(mysqlConfig);
  // var connection = mysql.createConnection({
  //   host: MIGRATION_DATA_CONFIG['mysql']['host'],
  //   user: MIGRATION_DATA_CONFIG['mysql']['user'],
  //   password: MIGRATION_DATA_CONFIG['mysql']['password'],
  //   database: MIGRATION_DATA_CONFIG['mysql']['database'],
  // });
    return connection;
  }
  return false
};
