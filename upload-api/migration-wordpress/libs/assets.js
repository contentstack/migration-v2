/**
 * External module Dependencies.
 */
const mkdirp = require("mkdirp"),
  path = require("path"),
  _ = require("lodash"),
  fs = require("fs"),
  axios = require("axios");

const chalk = require("chalk");
const config = require("../config");

/**
 * Internal module Dependencies .
 */
const helper = require("../utils/helper");

const { asset: assetConfig } = config.modules;
const assetFolderPath = path.resolve(config.data, assetConfig.dirName);
const assetMasterFolderPath = path.resolve(config.data, "logs", "assets");
const failedJSONFilePath = path.join(assetMasterFolderPath, "wp_failed.json");
const failedJSON = helper.readFile(failedJSONFilePath) || {};

var assetData = {};
function startingDir(){
if (!fs.existsSync(assetFolderPath)) {
  mkdirp.sync(assetFolderPath);
  helper.writeFile(path.join(assetFolderPath, assetConfig.fileName));
  mkdirp.sync(assetMasterFolderPath);
  return true;
} else {
  if (!fs.existsSync(path.join(assetFolderPath, assetConfig.fileName))) {
    helper.writeFile(path.join(assetFolderPath, assetConfig.fileName));
    return true;
  }else{
    assetData = helper.readFile(path.join(assetFolderPath, assetConfig.fileName));
    
  }
  if (!fs.existsSync(assetMasterFolderPath)) {
    mkdirp.sync(assetMasterFolderPath);
    return true;
  }
}
}
async function saveAsset (assets, retryCount, affix) {
  const url = encodeURI(assets["wp:attachment_url"]);
  const name = url.split("/").pop();

  let description =
    assets["description"] ||
    assets["content:encoded"] ||
    assets["excerpt:encoded"] ||
    "";
  description =
    description.length > 255 ? description.slice(0, 255) : description;

  const parent_uid = affix ? "wordpressasset" : null;
  const assetPath = path.resolve(
    assetFolderPath,
    `assets_${assets["wp:post_id"].toString()}`,
    name
  );

  if (fs.existsSync(assetPath)) {
    console.log(`Asset already present: ${assets["wp:post_id"]}`);
    return assets["wp:post_id"];
  }

  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    mkdirp.sync(
      path.resolve(
        assetFolderPath,
        `assets_${assets["wp:post_id"].toString()}`
      )
    );
    fs.writeFileSync(assetPath, response.data);

    const stats = fs.lstatSync(assetPath);

    assetData[`assets_${assets["wp:post_id"]}`] = {
      uid: `assets_${assets["wp:post_id"]}`,
      urlPath: `/assets/assets_${assets["wp:post_id"]}`,
      status: true,
      file_size: `${stats.size}`,
      tag: [],
      filename: name,
      url,
      is_dir: false,
      parent_uid,
      _version: 1,
      title: assets["title"] || name.split(".").slice(0, -1).join("."),
      publish_details: [],
      description,
    };

    if (failedJSON[assets["wp:post_id"]]) {
      // delete the assest entry from wp_failed log
      delete failedJSON[assets["wp:post_id"]];
      helper.writeFile(
        failedJSONFilePath,
        JSON.stringify(failedJSON, null, 4)
      );
    }

    helper.writeFile(
      path.join(assetFolderPath, assetConfig.fileName),
      JSON.stringify(assetData, null, 4)
    );

    console.log(
      "An asset with id",
      chalk.green(`assets_${assets["wp:post_id"]}`),
      "and name",
      chalk.green(`${name}`),
      "downloaded successfully."
    );

    return assets["wp:post_id"];
  } catch (err) {
    const assetName =
      assets["title"] || name.split(".").slice(0, -1).join(".");
    failedJSON[assets["wp:post_id"]] = {
      failedUid: assets["wp:post_id"],
      name: assetName,
      url,
      reason_for_error: err?.message,
    };

    helper.writeFile(failedJSONFilePath, JSON.stringify(failedJSON, null, 4));

    if (retryCount === 0) {
      return saveAsset(assets, 1, affix);
    } else {
      console.log(
        chalk.red(`Failed to download asset with id `),
        assets["wp:post_id"],
        chalk.red("with error message"),
        err?.message
      );
      return assets["wp:post_id"];
    }
  }
}

async function getAsset(attachments, affix) {
  const BATCH_SIZE = 5; // 5 promises at a time
  const results = [];

  for (let i = 0; i < attachments.length; i += BATCH_SIZE) {
    const batch = attachments.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map((data) => saveAsset(data, 0, affix))
    );
    results.push(...batchResults);
  }
  return results;
}

// Function to get all assets from the data source
async function getAllAssets( affix) {
  const alldata = helper.readFile(
    path.join(config.data, config.json_filename)
  );
  //const alldata = helper.readFile(newPath);
  const assets = alldata?.rss?.channel?.item ?? alldata?.channel?.item;

  if (!assets || assets.length === 0) {
    console.log(chalk.red("No assets found"));
    return;
  }

  const attachments = assets.filter(
    ({ "wp:post_type": postType }) => postType === "attachment"
  );
  if (attachments.length > 0) {
    await getAsset(attachments, affix);
  }

  // if (!filePath) {
  //   const attachments = assets.filter(
  //     ({ "wp:post_type": postType }) => postType === "attachment"
  //   );
  //   if (attachments.length > 0) {
  //     await getAsset(attachments);
  //   }
  // } else {
  //   //if want to custom export
  //   const assetIds = fs.existsSync(filePath)
  //     ? fs.readFileSync(filePath, "utf-8").split(",")
  //     : [];
  //   if (assetIds.length > 0) {
  //     const assetDetails = assetIds
  //       .map((id) => assets.find(({ "wp:post_id": postId }) => postId === id))
  //       .filter((asset) => asset && asset["wp:post_type"] === "attachment");
  //     if (assetDetails.length > 0) {
  //       await getAsset(assetDetails);
  //     } else {
  //       console.error("Please provide valid IDs for asset export");
  //     }
  //   } else {
  //     console.error("No asset IDs found");
  //   }
  // }
}

async function startAssetExport(affix) {
  console.log("Exporting assets...");
  try {
    startingDir()
    await getAllAssets( affix);
  } catch (err) {
    console.error("Error in asset export:", err);
  }
}
module.exports = startAssetExport;
