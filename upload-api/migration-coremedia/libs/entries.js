const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");
const readdirRecursive = require("fs-readdir-recursive");
const xml2js = require("xml2js");
const config = require("../config");

const contenttypeFolder = config?.modules?.contentTypes?.dirName;
const contentTypeFolder = path.join(
  process.cwd(),
  config.data,
  contenttypeFolder
);
const globalFieldFolder = config?.modules?.globalFields;
const entryFolder = config?.modules?.entries?.dirName;

if (!fs.existsSync(path.join(process.cwd(), config.data, entryFolder))) {
  mkdirp.sync(path.join(process.cwd(), config.data, entryFolder));
}


const entries = async () => {
  const entries = fs.readFileSync(path.join(process.cwd(), config.data, contenttypeFolder, "entries.json"), "utf8");
  return JSON.parse(entries);
};

let locale;

const transformStruct = async (parsedStruct) => {
  let schema = {};
  Object.entries(parsedStruct || {}).map(async ([key, prop]) => {
    if (key === "attributes") return null;

    switch (key) {
      case "StringProperty":
        schema[key?.toLowerCase()] = prop?.text;
        break;

      case "BooleanProperty":
        schema[key?.toLowerCase()] = prop?.text;
        break;

      case "StructProperty":
        schema[key?.toLowerCase()] =  await transformStruct(prop?.Struct);  // recursive call for nested struct
        break;

      default:
        return null;
    }
  }).filter(Boolean);
  return schema;
}

module.exports = entries;