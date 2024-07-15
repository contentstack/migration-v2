/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const read = require("fs-readdir-recursive");
const helper = require("../utils/helper");


/**
 * Assigns a folder name based on the provided path.
 *
 * @param {Object} options - The options object.
 * @param {string} options.path - The path to be processed.
 * @returns {string} The modified path with the folder name.
 */
const assignFolderName = ({ path }) => {
  const spliter = "/sitecore";
  const newPath = path.split(spliter)?.[1];
  return `${spliter}${newPath}`;
}

/**
 * Extracts configuration data from the specified sitecore_folder.
 * @param {string} sitecore_folder - The path to the sitecore_folder.
 */
function ExtractConfiguration(sitecore_folder) {
  const xml_folder = read(sitecore_folder);
  const obj = {};
  const treeObj = {};
  for (let i = 0; i < xml_folder?.length; i++) {
    if ((xml_folder?.[i]?.includes("data.json") || xml_folder?.[i]?.includes("data.json.json")) && !xml_folder?.[i]?.includes("undefined.json")) {
      const path = xml_folder?.[i]
      const data = helper?.readFile(`${sitecore_folder}/${xml_folder?.[i]}`)
      if (data?.item?.$?.template === "configuration group") {
        let newPath = path?.split("/{")?.[0];
        const groupPath = read(`${sitecore_folder}/${newPath}`)
        let arrayValue = [];
        let multiValueArrayTree = [];
        groupPath?.forEach((item) => {
          if ((item?.includes("data.json") || item?.includes("data.json.json")) && !item?.includes("undefined.json")) {
            const conf = helper?.readFile(`${sitecore_folder}/${newPath}/${item}`)
            const value = conf?.item?.fields?.field?.find((item) => item?.$?.key === "value")
            if (value) {
              arrayValue.push({ key: conf?.item?.$?.name, value: value?.content !== "" ? value?.content : conf?.item?.$?.name })
            } else {
              arrayValue.push({ value: conf?.item?.$?.name })
            }
            multiValueArrayTree.push({ key: conf?.item?.$?.name, value: conf?.item?.$?.id })
          }
        })
        obj[assignFolderName({ path: `${sitecore_folder}/${newPath}` })] = arrayValue;
        treeObj[assignFolderName({ path: `${sitecore_folder}/${newPath}` })] = multiValueArrayTree;
      }
    }
  }
  helper.writeFile(
    path.join(
      process.cwd(),
      "sitecoreMigrationData/MapperData",
    ),
    JSON.stringify(obj, null, 4),
    "configuration",
    (err) => {
      if (err) throw err;
    }
  );
  helper.writeFile(
    path.join(
      process.cwd(),
      "sitecoreMigrationData/MapperData",
    ),
    JSON.stringify(treeObj, null, 4),
    "configurationTree",
    (err) => {
      if (err) throw err;
    }
  );
}



module.exports = ExtractConfiguration;