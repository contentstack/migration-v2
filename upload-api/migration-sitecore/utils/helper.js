/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * External module Dependencies.
 */
var fs = require("fs");
var path = require("path");
var mkdirp = require("mkdirp");

/**
 * Internal module Dependencies.
 */

// for checking XML file
exports.readXMLFile = function (filePath) {
  let data;
  if (fs.existsSync(filePath)) data = fs.readFileSync(filePath, "utf8");
  return data;
};

exports.readFile = function (filePath, parse) {
  try {
    parse = typeof parse == "undefined" ? true : parse;
    filePath = path.resolve(filePath);
    let data;
    if (fs.existsSync(filePath)) {
      data = parse ? JSON.parse(fs.readFileSync(filePath, "utf8")) : data;
      return data;
    } else {
      return undefined;
    }
  } catch (err) {
    console.log("🚀 ~ file: helper.js:29 ~ err:", err)
  }
};

exports.writeFile = function (filePath, data, pathName) {
  if (fs.existsSync(filePath)) {
    filePath = path.resolve(`${filePath}/${pathName}`);
    data = typeof data === "object" ? JSON.stringify(data) : data || "{}";
    fs.writeFileSync(`${filePath}.json`, data, "utf8");
  } else {
    fs.mkdirSync(
      filePath,
      { recursive: true }
    );
    filePath = path.resolve(`${filePath}/${pathName}`);
    data = typeof data == "object" ? JSON.stringify(data) : data || "{}";
    fs.writeFileSync(`${filePath}.json`, data, "utf8");
  }
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
