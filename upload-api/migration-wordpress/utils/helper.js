/**
 * External module Dependencies.
 */
var fs = require("fs");
var path = require("path");
var mkdirp = require("mkdirp");
const xml2js = require("xml2js");
/**
 * Internal module Dependencies.
 */

// for checking XML file
exports.readXMLFile = function (filePath) {
  var data;
  if (fs.existsSync(filePath)) data = fs.readFileSync(filePath, "utf-8");

  return data;
};

// parse xml to json
exports.parseXmlToJson = async (xml) => {
  try {
    const parser = new xml2js.Parser({
      attrkey: "attributes",
      charkey: "text",
      explicitArray: false,
    });
    return await parser.parseStringPromise(xml);
  } catch (err) {
    console.log(chalk.red(`Error parsing XML: ${err.message}`));
  }
}

exports.writeFileAsync = async function (filePath, data, tabSpaces) {
  filePath = path.resolve(filePath);
  data = typeof data == "object" ? JSON.stringify(data, null, tabSpaces) : data || "{}";
  await fs.promises.writeFile(filePath, data, "utf-8");
};

exports.readFile = function (filePath, parse) {
  parse = typeof parse == "undefined" ? true : parse;
  filePath = path.resolve(filePath);
  var data;
  if (fs.existsSync(filePath))
    data = parse ? JSON.parse(fs.readFileSync(filePath, "utf-8")) : data;
  return data;
};

exports.writeFile = function (filePath, data) {
  filePath = path.resolve(filePath);
  data = typeof data == "object" ? JSON.stringify(data) : data || "{}";
  fs.writeFileSync(filePath, data, "utf-8");
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
