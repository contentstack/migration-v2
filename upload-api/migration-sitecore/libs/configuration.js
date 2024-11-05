/* eslint-disable @typescript-eslint/no-var-requires */
const path = require("path");
const read = require("fs-readdir-recursive");
const helper = require("../utils/helper");
const { MIGRATION_DATA_CONFIG } = require("../constants/index");

const {
  DATA_MAPPER_DIR,
  DATA_MAPPER_CONFIG,
  DATA_MAPPER_CONFIG_TREE
} = MIGRATION_DATA_CONFIG;


const assignFolderName = ({ path }) => {
  const spliter = "/sitecore";
  const newPath = path.split(spliter)?.[1];
  return `${spliter}${newPath}`;
}




function ExtractConfiguration(sitecore_folder) {
  const xml_folder = read(sitecore_folder);
  const obj = {};
  const treeObj = {};
  for (let i = 0; i < xml_folder?.length; i++) {
    if (xml_folder?.[i]?.endsWith("data.json") && !xml_folder?.[i]?.includes("undefined.json")) {
      const nwPath = xml_folder?.[i];
      const data = helper?.readFile(path?.join?.(sitecore_folder, xml_folder?.[i]));
      if (data?.item?.$?.template === "configuration group") {
        let newPath = nwPath?.split("/{")?.[0];
        const groupPath = read(path?.join?.(sitecore_folder, newPath));
        let arrayValue = [];
        let multiValueArrayTree = [];
        groupPath?.forEach((item) => {
          if (item?.endsWith("data.json") && !item?.includes("undefined.json")) {
            const conf = helper?.readFile(path?.join?.(sitecore_folder, newPath, item))
            const value = conf?.item?.fields?.field?.find((item) => item?.$?.key === "value")
            if (value) {
              arrayValue.push({ key: conf?.item?.$?.name, value: value?.content !== "" ? value?.content : conf?.item?.$?.name })
            } else {
              arrayValue.push({ value: conf?.item?.$?.name })
            }
            multiValueArrayTree.push({ key: conf?.item?.$?.name, value: conf?.item?.$?.id })
          }
        })
        obj[assignFolderName({ path: path?.join?.(sitecore_folder, newPath) })] = arrayValue;
        treeObj[assignFolderName({ path: path?.join?.(sitecore_folder, newPath) })] = multiValueArrayTree;
      }
    }
  }
  helper.writeFile(
    path.join(
      process.cwd(),
      MIGRATION_DATA_CONFIG.DATA,
      DATA_MAPPER_DIR,
    ),
    JSON.stringify(obj, null, 4),
    DATA_MAPPER_CONFIG,
    (err) => {
      if (err) throw err;
    }
  );
  helper.writeFile(
    path.join(
      process.cwd(),
      MIGRATION_DATA_CONFIG.DATA,
      DATA_MAPPER_DIR,
    ),
    JSON.stringify(treeObj, null, 4),
    DATA_MAPPER_CONFIG_TREE,
    (err) => {
      if (err) throw err;
    }
  );
}



module.exports = ExtractConfiguration;