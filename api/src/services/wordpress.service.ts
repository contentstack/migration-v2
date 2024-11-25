import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import _ from "lodash";
import { MIGRATION_DATA_CONFIG } from "../constants/index.js";
import jsdom from "jsdom";
import { v4 as uuidv4 } from "uuid";
import { htmlToJson } from "@contentstack/json-rte-serializer";
import customLogger from "../utils/custom-logger.utils.js";
import { getLogMessage } from "../utils/index.js";

const { JSDOM } = jsdom;
const virtualConsole = new jsdom.VirtualConsole();
// Get the current file's path
const __filename = fileURLToPath(import.meta.url);
// Get the current directory
const __dirname = path.dirname(__filename);

const slugRegExp = /[^a-z0-9_-]+/g;
let assetsSave = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME
);
let referencesFolder = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.REFERENCES_DIR_NAME
);
let entrySave = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME
);
let postFolderPath = path.join(
  entrySave,
  MIGRATION_DATA_CONFIG.POSTS_DIR_NAME,
  MIGRATION_DATA_CONFIG.POSTS_FOLDER_NAME
);
let chunksDir = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.CHUNKS_DIR_NAME
);
let authorsFolderPath = path.join(
  entrySave,
  MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME
);
let authorsFilePath = path.join(
  authorsFolderPath,
  MIGRATION_DATA_CONFIG.AUTHORS_FILE_NAME
);
let termsFolderPath = path.join(
  entrySave,
  MIGRATION_DATA_CONFIG.TERMS_DIR_NAME
);
let tagsFolderPath = path.join(entrySave, MIGRATION_DATA_CONFIG.TAG_DIR_NAME);
let categoriesFolderPath = path.join(
  entrySave,
  MIGRATION_DATA_CONFIG.CATEGORIES_DIR_NAME
);
let assetMasterFolderPath = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  "logs",
  MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME
);
// let globalPrefix = "";

interface Asset {
  "wp:post_type": string;
  [key: string]: any;
}

const idCorrector = (id: any) => {
  const newId = id?.replace(/[-{}]/g, (match: any) => match === '-' ? '' : '')
  if (newId) {
    return newId?.toLowerCase()
  } else {
    return id
  }
}

let failedJSONFilePath = path.join(
  assetMasterFolderPath,
  MIGRATION_DATA_CONFIG.ASSETS_FAILED_FILE
);
const failedJSON: Record<string, any> = {};
let assetData: Record<string, any> | any = {};
let blog_base_url = "";

// helper functions
async function writeFileAsync(filePath: string, data: any, tabSpaces: number) {
  filePath = path.resolve(filePath);
  data =
    typeof data == "object" ? JSON.stringify(data, null, tabSpaces)
      : data || "{}";
  await fs.promises.writeFile(filePath, data, "utf-8");
}

/************  Assests module functions start *********/
async function startingDirAssests(destinationStackId: string) {
  try {
    // Check if assetsSave directory exists
    assetsSave = path.join(
      MIGRATION_DATA_CONFIG.DATA,
      destinationStackId,
      MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME
    );

     

    assetMasterFolderPath = path.join(
      MIGRATION_DATA_CONFIG.DATA,
      destinationStackId,
      "logs",
      MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME
    );

    failedJSONFilePath = path.join(
      assetMasterFolderPath,
      MIGRATION_DATA_CONFIG.ASSETS_FAILED_FILE
    );
    await fs.promises.mkdir(assetMasterFolderPath, { recursive: true });
      await fs.promises.writeFile(failedJSONFilePath,  "{}" );
    try {
      await fs.promises.access(assetsSave);
    } catch {
      // Directory doesn't exist, create it
      await fs.promises.mkdir(assetsSave, { recursive: true });
      await fs.promises.writeFile(
        path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_FILE_NAME),
        "{}"
      );
      await fs.promises.writeFile(
        path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE),
        "{}"
      );
      await fs.promises.writeFile(
        path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_FOLDER_FILE_NAME),
        "{}"
      );
      await fs.promises.mkdir(assetMasterFolderPath, { recursive: true });
      await fs.promises.writeFile(failedJSONFilePath,  "{}" );

      return;
    }

    // Check if assets.json exists
    const assetsJsonPath = path.join(
      assetsSave,
      MIGRATION_DATA_CONFIG.ASSETS_FILE_NAME
    );
    const assetsSchemaJsonPath = path.join(
      assetsSave,
      MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE
    );
    try {
      await fs.promises.access(assetsJsonPath);
      // Read assets.json data
      const fileContent = await fs.promises.readFile(assetsJsonPath, "utf-8");
      assetData = JSON.parse(fileContent);
    } catch {
      // assets.json doesn't exist, create it
      await fs.promises.writeFile(assetsJsonPath, "{}");
      return;
    }

    try {
      await fs.promises.access(assetsSchemaJsonPath);
      // Read assets.json data
      const fileContent = await fs.promises.readFile(assetsSchemaJsonPath, "utf-8");
      assetData = JSON.parse(fileContent);
    } catch {
      // assets.json doesn't exist, create it
      await fs.promises.writeFile(assetsSchemaJsonPath, "{}");
      return;
    }

    // Check if assetMasterFolderPath exists
    try {
      await fs.promises.access(assetMasterFolderPath);
    } catch {
      // Directory doesn't exist, create it
      await fs.promises.mkdir(assetMasterFolderPath, { recursive: true });
      await fs.promises.writeFile(
        path.join(assetMasterFolderPath,MIGRATION_DATA_CONFIG.ASSETS_FAILED_FILE),
        "{}"
      );
      return;
    }
  } catch (error) {
    console.error("Error in startingDir:", error);
    return;
  }
}

async function saveAsset(assets: any, retryCount: number, affix: string, destinationStackId: string, projectId: string) {
  const srcFunc = 'saveAsset';
  const url = encodeURI(assets["wp:attachment_url"]);
  const name = url.split("/").pop() || "";

  let description =
    assets["description"] ||
    assets["content:encoded"] ||
    assets["excerpt:encoded"] ||
    "";
  description =
    description.length > 255 ? description.slice(0, 255) : description;

  const parent_uid = affix ? "wordpressasset" : null;

  let customId = idCorrector(uuidv4())
  
  const assetPath = path.resolve(
    assetsSave, "files",
    customId,
    name
  );

  if (fs.existsSync(assetPath)) {
    console.error(`Asset already present: ${customId}`);
    return assets["wp:post_id"];
  }

  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    fs.mkdirSync(
      path.resolve(assetsSave, "files", customId),
      { recursive: true }
    );
    fs.writeFileSync(assetPath, response.data);

    const stats = fs.lstatSync(assetPath);
    const acc: any = {};
    const key = customId;

    acc[key] = {
      uid: key,
      urlPath: `/assets/files/${key}`,
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

    if (failedJSON[customId]) {
      // delete the assest entry from wp_failed log
      delete failedJSON[customId];
      await writeFileAsync(failedJSONFilePath, failedJSON, 4);
    }
    assetData[key] = acc[key];
    // await writeFileAsync(
    //   path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_FILE_NAME),
    //   assetData,
    //   4
    // );

    await writeFileAsync(
      path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE),
      assetData,
      4
    );
    const message = getLogMessage(
      "createAssetFolderFile",
      `An asset with id ${customId} and name ${name} downloaded successfully.`,
      {}
    )
    await customLogger(projectId, destinationStackId, 'info', message);

    // console.log(
    //   "An asset with id",
    //   `assets_${assets["wp:post_id"]}`,
    //   "and name",
    //   `${name}`,
    //   "downloaded successfully."
    // );

    return assets["wp:post_id"];
  } catch (err: any) {
    const assetName = assets["title"] || name.split(".").slice(0, -1).join(".");
    failedJSON[assets["wp:post_id"]] = {
      failedUid: assets["wp:post_id"],
      name: assetName,
      url,
      reason_for_error: err?.message || "error",
    };

    try {
      await fs.promises.access(assetMasterFolderPath);
    } catch {
      await fs.promises.mkdir(assetMasterFolderPath, { recursive: true });
    }
    await fs.promises.writeFile(
      path.join(assetMasterFolderPath,MIGRATION_DATA_CONFIG.ASSETS_FAILED_FILE),
      "{}"
    );
   await writeFileAsync(failedJSONFilePath, failedJSON, 4);

    if (retryCount === 0) {
      return saveAsset(assets, 1, affix, destinationStackId, projectId);
    } else {
      const message = getLogMessage(
        srcFunc,
        `Failed to download asset with id ${assets["wp:post_id"]}`,
        {},
        err
      )
      await customLogger(projectId, destinationStackId, 'error', message);
      return assets["wp:post_id"];
    }
  }
}

async function getAsset(attachments: any[], affix: string, destinationStackId: string, projectId: string) {
  const BATCH_SIZE = 5; // 5 promises at a time
  const results = [];
  let refs: any = {};
  for (let i = 0; i < attachments.length; i += BATCH_SIZE) {
    const batch = attachments.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.allSettled(
      batch.map((data) => {
        saveAsset(data, 0, affix, destinationStackId, projectId)
      })
    );
    results.push(...batchResults);
  }
  await writeFileAsync(
    path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_FILE_NAME),
    { "1": MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE},
    4
  );
  
  return results;
}

async function getAllAssets(
  affix: string,
  packagePath: string,
  destinationStackId: string,
  projectId: string
) {
  try {
    await startingDirAssests(destinationStackId);
    const alldata: any = await fs.promises.readFile(packagePath, "utf8");
    const alldataParsed = JSON.parse(alldata);
    const assets: Asset[] =
      alldataParsed?.rss?.channel?.item ?? alldataParsed?.channel?.item;
    // await writeFileAsync(path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_FILE_NAME), assets, 4);
    if (!assets || assets.length === 0) {
      const message = getLogMessage(
        "createAssetFolderFile",
        `No assets found.`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
      // console.log("No assets found", projectId);
      return;
    }

    const attachments = assets.filter(
      ({ "wp:post_type": postType }) => postType === "attachment"
    );
    if (attachments.length > 0) {
      await getAsset(attachments, affix, destinationStackId, projectId);
    }
    return;
  } catch (error) {
    return {
      err: "error in Workpresss",
      error: error,
    };
  }
}

const createAssetFolderFile = async (affix: string, destinationStackId:string, projectId: string) => {
  try {
    const folderJSON = [
      {
        urlPath: "/assets/wordpressasset",
        uid: "wordpressasset",
        content_type: "application/vnd.contenstack.folder",
        tags: [],
        name: affix,
        is_dir: true,
        parent_uid: null,
        _version: 1,
      },
    ];

    const folderPath = path.join(
      assetsSave,
      MIGRATION_DATA_CONFIG.ASSETS_FOLDER_FILE_NAME
    );
    await writeFileAsync(folderPath, folderJSON, 4);
    const message = getLogMessage(
      "createAssetFolderFile",
      `Folder JSON created successfully.`,
      {}
    )
    await customLogger(projectId, destinationStackId, 'info', message);
    // console.log("Folder JSON created successfully.");
    return;
  } catch (error) {
    return {
      err: "Error creating folder JSON:",
      error: error,
    };
  }
};
/************  End of assests module functions *********/

/************  References module functions start *********/
async function startDirReferences(destinationStackId: string) {
  referencesFolder = path.join(
    MIGRATION_DATA_CONFIG.DATA,
    destinationStackId,
    MIGRATION_DATA_CONFIG.REFERENCES_DIR_NAME
  );
  try {
    await fs.promises.access(referencesFolder);
  } catch {
    // Directory doesn't exist, create it
    await fs.promises.mkdir(referencesFolder, { recursive: true });
    await fs.promises.writeFile(
      path.join(referencesFolder, MIGRATION_DATA_CONFIG.REFERENCES_FILE_NAME),
      "{}"
    );
    return;
  }
}

async function saveReference(referenceDetails: any[], destinationStackId:string, projectId: string) {
  try {
    const result = referenceDetails.reduce((acc: any, item: any) => {
      acc[item.id] = {
        uid: item.id,
        slug: item.slug,
        content_type: item.content_type,
      };
      return acc;
    }, {});

    await writeFileAsync(
      path.join(referencesFolder, MIGRATION_DATA_CONFIG.REFERENCES_FILE_NAME),
      result,
      4
    );
    const message = getLogMessage(
      "saveReference",
      `Reference data saved successfully.`,
      {}
    )
    await customLogger(projectId, destinationStackId, 'info', message);
    // console.log("Reference data saved successfully.");
  } catch (error) {
    return {
      err: "error in saving references",
      error: error,
    };
  }
}

// helper function to process categories, terms, or tags
function processReferenceData(
  data: any,
  idPrefix: string,
  slugKey: string,
  contentType: string
) {
  const referenceArray = [];
  if (Array.isArray(data)) {
    data.forEach((item: any) => {
      referenceArray.push({
        id: `${idPrefix}_${item["wp:term_id"]}`,
        slug: item[slugKey],
        content_type: contentType,
      });
    });
  } else if (typeof data === "object") {
    referenceArray.push({
      id: `${idPrefix}_${data["wp:term_id"]}`,
      slug: data[slugKey],
      content_type: contentType,
    });
  }
  return referenceArray;
}

async function getAllreference(affix: string, packagePath: string, destinationStackId: string, projectId: string) {
  const srcFunc = 'getAllreference';
  try {
    await startDirReferences(destinationStackId);
    const alldata: any = await fs.promises.readFile(packagePath, "utf8");
    const alldataParsed = JSON.parse(alldata);
    const prefix = affix
      .replace(/^\d+/, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/(^_+)|(_+$)/g, "")
      .toLowerCase();

    const referenceTags =
      alldataParsed?.rss?.channel["wp:tag"] ??
      alldataParsed?.channel["wp:tag"] ??
      "";
    const referenceTerms =
      alldataParsed?.rss?.channel["wp:term"] ??
      alldataParsed?.channel["wp:term"] ??
      "";
    const referenceCategories =
      alldataParsed?.rss?.channel["wp:category"] ??
      alldataParsed?.channel["wp:category"] ??
      "";

    const referenceArray = [];
    const categories = prefix ? `${prefix}_categories` : "categories";
    const terms = prefix ? `${prefix}_terms` : "terms";
    const tag = prefix ? `${prefix}_tag` : "tag";

    referenceArray.push(
      ...processReferenceData(
        referenceCategories,
        "category",
        "wp:category_nicename",
        categories
      )
    );
    referenceArray.push(
      ...processReferenceData(referenceTerms, "terms", "wp:term_slug", terms)
    );
    referenceArray.push(
      ...processReferenceData(referenceTags, "tags", "wp:tag_slug", tag)
    );

    if (referenceArray.length > 0) {
      await saveReference(referenceArray, destinationStackId, projectId);
    }
    const message = getLogMessage(
      srcFunc,
      `All references processed successfully.`,
      {}
    )
    await customLogger(projectId, destinationStackId, 'info', message);

    // console.log("All references processed successfully.");
  } catch (error) {
    return {
      err: "error in processing references",
      error: error,
    };
  }
}
/************  End of References module functions *********/

/************  Chunks module functions start *********/
async function startingDirChunks(affix: string, destinationStackId: string) {

  entrySave = path.join(
    MIGRATION_DATA_CONFIG.DATA,
    destinationStackId,
    MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME
  );

  postFolderPath = path.join(
    entrySave,
    MIGRATION_DATA_CONFIG.POSTS_DIR_NAME,
    MIGRATION_DATA_CONFIG.POSTS_FOLDER_NAME
  );

  chunksDir = path.join(
    MIGRATION_DATA_CONFIG.DATA,
    destinationStackId,
    MIGRATION_DATA_CONFIG.CHUNKS_DIR_NAME
  );

  try {
    await fs.promises.access(postFolderPath);
  } catch {
    // Directory doesn't exist, create it
    await fs.promises.mkdir(postFolderPath, { recursive: true });
  }
  try {
    await fs.promises.access(chunksDir);
  } catch {
    // Directory doesn't exist, create it
    await fs.promises.mkdir(chunksDir, { recursive: true });
  }
}

async function splitJsonIntoChunks(arrayData: any[]) {
  try {
    let chunkData = [];
    let chunkIndex = 1;
    const postIndex: any = {};

    for (let i = 0; i < arrayData.length; i++) {
      arrayData[i].title = arrayData[i].title === "" ? "NA" : arrayData[i].title
      chunkData.push(arrayData[i]);

      if (
        chunkData.length >= 100 ||
        (i === arrayData.length - 1 && chunkData.length > 0)
      ) {
        // Write chunk data to file
        const chunkFilePath = path.join(chunksDir, `post-${chunkIndex}.json`);
        await writeFileAsync(chunkFilePath, chunkData, 4);

        postIndex[chunkIndex] = `post-${chunkIndex}.json`;

        // Reset chunk data
        chunkData = [];
        chunkIndex++;
      }
    }

    await writeFileAsync(path.join(postFolderPath, "index.json"), {"1": "en-us.json"}, 4);
  } catch (error) {
    return {
      err: "Error while splitting JSON into chunks:",
      error: error,
    };
  }
}

async function extractChunks(affix: string, packagePath: string, destinationStackId: string, projectId: string) {
  const srcFunc = "extractChunks";
  try {
    await startingDirChunks(affix, destinationStackId);

    const alldata: any = await fs.promises.readFile(packagePath, "utf8");
    const alldataParsed = JSON.parse(alldata);
    const posts =
      alldataParsed?.rss?.channel["item"] ??
      alldataParsed?.channel["item"] ??
      "";

    if (posts && posts.length > 0) {
      await splitJsonIntoChunks(posts);
      const message = getLogMessage(
        srcFunc,
        `Post chunks creation completed`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
      // console.log("Post chunks creation completed.");
    } else {
      const message = getLogMessage(
        srcFunc,
        `No posts found.`,
        {},
      )
      await customLogger(projectId, destinationStackId, 'info', message);
      // console.error("No posts found.");
    }
  } catch (error) {
    const message = getLogMessage(
      srcFunc,
      `Error while creating post chunks.`,
      {},
      error
    )
    await customLogger(projectId, destinationStackId, 'error', message);
    // console.error(error);
    return;
  }
}
/************  end of chunks module functions *********/

/************  authors module functions start *********/
async function startingDirAuthors(affix: string) {
  const authorFolderName = MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME;

  authorsFolderPath = path.join(entrySave, authorFolderName, "en-us");
  authorsFilePath = path.join(
    authorsFolderPath,
    MIGRATION_DATA_CONFIG.AUTHORS_FILE_NAME
  );
  try {
    await fs.promises.access(authorsFolderPath);
  } catch {
    // Directory doesn't exist, create it
    await fs.promises.mkdir(authorsFolderPath, { recursive: true });
    await fs.promises.writeFile(authorsFilePath, "{}");
  }
}

const filePath = false;
async function saveAuthors(authorDetails: any[], destinationStackId: string, projectId: string) {
  const srcFunc = "saveAuthors";
  try {
    

    const authordata = authorDetails.reduce(
      (acc: { [key: string]: any }, data) => {
        const uid = `authors_${data["wp:author_id"] || data["wp:author_login"]
          }`;

        const title = data["wp:author_login"] || `Authors - ${data["wp:author_id"]}`;
        const url = `/${title.toLowerCase().replace(/ /g, "_")}`;
          let customId = idCorrector(uuidv4())
        acc[customId] = {
          uid: customId,
          title: title,
          url: url,
          email: data["wp:author_email"],
          first_name: data["wp:author_first_name"],
          last_name: data["wp:author_last_name"],
        };

        return acc;
      },
      {}
    );
    await writeFileAsync(authorsFilePath, authordata, 4);
    await writeFileAsync(path.join(authorsFolderPath, "index.json"), {"1": "en-us.json"}, 4);
    const message = getLogMessage(
      srcFunc,
      `${authorDetails.length} Authors exported successfully`,
      {}
    )
    await customLogger(projectId, destinationStackId, 'info', message);
    // console.log(authorDetails.length, " Authors exported successfully");
    // console.log(`${authorDetails.length} Authors exported successfully`);
  } catch (error) {
    const message = getLogMessage(
      srcFunc,
      `Error while saving authors`,
      {},
      error
    )
    await customLogger(projectId, destinationStackId, 'error', message);
    // console.error("error while saving authors", error);
  }
}
async function getAllAuthors(affix: string, packagePath: string,destinationStackId: string, projectId: string) {
  const srcFunc = "getAllAuthors";
  try {
    await startingDirAuthors(affix);
    const alldata: any = await fs.promises.readFile(packagePath, "utf8");
    const alldataParsed = JSON.parse(alldata);
    const authors: any =
      alldataParsed?.rss?.channel?.["wp:author"] ??
      alldataParsed?.channel?.["wp:author"] ??
      "";

    if (authors && authors.length > 0) {
      if (!filePath) {
        await saveAuthors(authors, destinationStackId, projectId);
      } else {
        const authorIds = fs.existsSync(filePath)? fs.readFileSync(filePath, "utf-8").split(",")
          : [];

        if (authorIds.length > 0) {
          const authorDetails = authors.filter((author: any) =>
            authorIds.includes(author["wp:author_id"])
          );

          if (authorDetails.length > 0) {
            await saveAuthors(authorDetails, destinationStackId, projectId);
          }
        }
      }
    } else if (typeof authors === "object") {
      if (
        !filePath ||
        (fs.existsSync(filePath) &&
          fs
            .readFileSync(filePath, "utf-8")
            .split(",")
            .includes(authors["wp:author_id"]))
      ) {
        await saveAuthors([authors], destinationStackId, projectId);
      } else {
        const message = getLogMessage(
          srcFunc,
          `No authors UID found`,
          {}
        )
        await customLogger(projectId, destinationStackId, 'info', message);
        // console.log("\nNo authors UID found");
      }
    } else {
      const message = getLogMessage(
        srcFunc,
        `No authors found`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
      // console.log("\nNo authors found");
    }
  } catch (error) {
    const message = getLogMessage(
      srcFunc,
      `Error while getting authors`,
      {},
      error
    )
    await customLogger(projectId, destinationStackId, 'error', message);
    // console.log("error while getting authors", error);
  }
}
/************  end of authors module functions *********/


/************  terms module functions start *********/
async function startingDirTerms(affix: string) {
  termsFolderPath = path.join(
    entrySave,
    MIGRATION_DATA_CONFIG.TERMS_DIR_NAME, "en-us"
  );
  try {
    await fs.promises.access(termsFolderPath);
  } catch {
    // Directory doesn't exist, create it
    await fs.promises.mkdir(termsFolderPath, { recursive: true });
    await fs.promises.writeFile(
      path.join(termsFolderPath, MIGRATION_DATA_CONFIG.TERMS_FILE_NAME),
      "{}"
    );
  }
}

async function saveTerms(termsDetails: any[], destinationStackId: string, projectId: string) {
  const srcFunc = "saveTerms";
  try {
    const termsFilePath = path.join(
      termsFolderPath,
      MIGRATION_DATA_CONFIG.TERMS_FILE_NAME
    );
    const termsdata = termsDetails.reduce(
      (acc: { [key: string]: any }, data) => {
        const { id, term_name, term_taxonomy = "", term_slug } = data;
        const uid = `terms_${id}`;
        const title = term_name ?? `Terms - ${id}`;
        const url = `/${title.toLowerCase().replace(/ /g, "_")}`; 

        let customId = idCorrector(uuidv4())
        acc[customId] = {
          uid:customId,
          title,
          url,
          taxonomy: term_taxonomy,
          slug: term_slug,
        };

        return acc;
      },
      {}
    );

    await writeFileAsync(termsFilePath, termsdata, 4);
    await writeFileAsync(path.join(termsFolderPath, "index.json"), {"1": "en-us.json"}, 4);

    const message = getLogMessage(
      srcFunc,
      `${termsDetails.length} Terms exported successfully`,
      {}
    )
    await customLogger(projectId, destinationStackId, 'info', message);
    // console.log(`${termsDetails.length} Terms exported successfully`);
  } catch (error) {
    const message = getLogMessage(
      srcFunc,
      `Error saving terms`,
      {},
      error
    )
    await customLogger(projectId, destinationStackId, 'error', message);
    // console.error("Error saving terms:", error);
    throw error;
  }
}

async function getAllTerms(affix: string, packagePath: string, destinationStackId:string, projectId: string) {
  const srcFunc = "getAllTerms";
  try {
    await startingDirTerms(affix);
    const alldata: any = await fs.promises.readFile(packagePath, "utf8");
    const alldataParsed = JSON.parse(alldata);
    const terms =
      alldataParsed?.rss?.channel["wp:term"] ||
      alldataParsed?.channel["wp:term"] ||
      "";

    if (!terms || terms.length === 0) {
      const message = getLogMessage(
        srcFunc,
        `No terms found`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
      // console.log("\nNo terms found");
      return;
    }
    const termsArray = Array.isArray(terms) ? terms.map((term) => ({
        id: term["wp:term_id"],
        term_name: term["wp:term_name"],
        term_slug: term["wp:term_slug"],
        term_taxonomy: term["wp:term_taxonomy"],
      }))
      : [
        {
          id: terms["wp:term_id"],
          term_name: terms["wp:term_name"],
          term_slug: terms["wp:term_slug"],
          term_taxonomy: terms["wp:term_taxonomy"],
        },
      ];

    await saveTerms(termsArray, destinationStackId, projectId);
  } catch (error) {
    const message = getLogMessage(
      srcFunc,
      `Error retrieving terms`,
      {},
      error
    )
    await customLogger(projectId, destinationStackId, 'error', message);
    // console.error("Error retrieving terms:", error);
  }
}

/************  end of terms module functions *********/

/************  tags module functions start *********/
async function startingDirTags(affix: string) {
  tagsFolderPath = path.join(
    entrySave,
    MIGRATION_DATA_CONFIG.TAG_DIR_NAME, "en-us"
  );
  try {
    await fs.promises.access(tagsFolderPath);
  } catch {
    // Directory doesn't exist, create it
    await fs.promises.mkdir(tagsFolderPath, { recursive: true });
    await fs.promises.writeFile(
      path.join(tagsFolderPath, MIGRATION_DATA_CONFIG.TAG_FILE_NAME),
      "{}"
    );
  }
}

async function saveTags(tagDetails: any[], destinationStackId: string, projectId: string) {
  const srcFunc = 'saveTags';
  try {
    const tagsFilePath = path.join(
      tagsFolderPath,
      MIGRATION_DATA_CONFIG.TAG_FILE_NAME
    );
    const tagdata = tagDetails.reduce((acc: { [key: string]: any }, data) => {
      const { id, tag_name, tag_slug, description = "" } = data;
      const uid = `tags_${id}`;
      const title = tag_name ?? `Tags - ${id}`;
     // const url = `/tags/${uid}`;
      const url = `/${title.toLowerCase().replace(/ /g, "_")}`;
      let customId = idCorrector(uuidv4())
      acc[customId] = {
        uid: customId,
        title,
        url,
        slug: tag_slug,
        description,
      };

      return acc;
    }, {});
    await writeFileAsync(tagsFilePath, tagdata, 4);
    await writeFileAsync(path.join(tagsFolderPath, "index.json"), {"1": "en-us.json"}, 4);
    const message = getLogMessage(
      srcFunc,
      `${tagDetails.length}, Tags exported successfully`,
      {}
    )
    await customLogger(projectId, destinationStackId, 'info', message);

    // console.log(`${tagDetails.length}`, " Tags exported successfully");
  } catch (error) {
    const message = getLogMessage(
      srcFunc,
      `Error saving tags`,
      {},
      error
    )
    await customLogger(projectId, destinationStackId, 'error', message);
    throw error;
  }
}
async function getAllTags(affix: string, packagePath: string, destinationStackId:string, projectId: string) {
  const srcFunc = "getAllTags";
  try {
    await startingDirTags(affix);
    const alldata: any = await fs.promises.readFile(packagePath, "utf8");
    const alldataParsed = JSON.parse(alldata);
    const tags =
      alldataParsed?.rss?.channel?.["wp:tag"] ||
      alldataParsed?.channel?.["wp:tag"] ||
      "";

    if (!tags || tags.length === 0) {
      const message = getLogMessage(
        srcFunc,
        `No tags found`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
      // console.log("\nNo tags found");
      return;
    }
    const tagsArray = Array.isArray(tags) ? tags.map((taginfo) => ({
        id: taginfo["wp:term_id"],
        tag_name: taginfo["wp:tag_name"],
        tag_slug: taginfo["wp:tag_slug"],
        description: taginfo["wp:tag_description"],
      }))
      : [
        {
          id: tags["wp:term_id"],
          tag_name: tags["wp:tag_name"],
          tag_slug: tags["wp:tag_slug"],
          description: tags["wp:tag_description"],
        },
      ];

    await saveTags(tagsArray, destinationStackId, projectId);
  } catch (error) {
    const message = getLogMessage(
      srcFunc,
      `Error retrieving tags`,
      {},
      error
    )
    await customLogger(projectId, destinationStackId, 'error', message);
    // console.error("Error retrieving tags:", error);
    throw error;
  }
}
/************  end of tags module functions *********/

/************  categories module functions start *********/
async function startingDirCategories(affix: string) {
  categoriesFolderPath = path.join(
    entrySave,
    MIGRATION_DATA_CONFIG.CATEGORIES_DIR_NAME, "en-us"
  );

  try {
    await fs.promises.access(categoriesFolderPath);
  } catch {
    // Directory doesn't exist, create it
    await fs.promises.mkdir(categoriesFolderPath, { recursive: true });
    await fs.promises.writeFile(
      path.join(
        categoriesFolderPath,
        MIGRATION_DATA_CONFIG.CATEGORIES_FILE_NAME
      ),
      "{}"
    );
  }
}

const convertHtmlToJson = (htmlString: any) => {
  const dom = new JSDOM(htmlString.replace(/&amp;/g, "&"));
  const htmlDoc = dom.window.document.querySelector("body");
  return htmlToJson(htmlDoc);
};

function parentCategories(data: any) {
  const parentId: any = fs.readFileSync(
    path.join(referencesFolder, MIGRATION_DATA_CONFIG.REFERENCES_FILE_NAME),
    "utf8"
  );

  const parentIdParsed = JSON.parse(parentId);
  const catParent: any = [];
  const getParent = data["parent"];

  Object.keys(parentIdParsed).forEach((key) => {
    if (getParent === parentIdParsed[key].slug) {
      catParent.push({
        uid: parentIdParsed[key].uid,
        _content_type_uid: parentIdParsed[key].content_type,
      });
    }
  });

  return catParent;
}
async function saveCategories(categoryDetails: any[], destinationStackId:string, projectId: string) {
  const srcFunc = 'saveCategories';
  try {
    const categorydata = categoryDetails.reduce(
      (acc: { [key: string]: any }, data) => {
        const uid = `category_${data["id"]}`;
        const title = data["title"] ? data["title"].replace(/&amp;/g, "&")
          : `Category - ${uid}`;
        const description = convertHtmlToJson(data["description"] || "");
        const nicename = data["nicename"] || "";

        let customId = idCorrector(uuidv4())

        // Accumulate category data
        acc[customId] = {
          uid: customId,
          title: title.toLowerCase(),
          url: "/" + title.toLowerCase().replace(/ /g, "_"),//+ uid.replace("_", "/"),
          nicename,
          description,
          parent: parentCategories(data), // Call parentCategories to populate the parent field
        };

        return acc;
      },
      {}
    );

    await writeFileAsync(
      path.join(
        categoriesFolderPath,
        MIGRATION_DATA_CONFIG.CATEGORIES_FILE_NAME
      ),
      categorydata,
      4
    );
    await writeFileAsync(path.join(categoriesFolderPath, "index.json"), {"1": "en-us.json"}, 4);

    const message = getLogMessage(
      srcFunc,
      `${categoryDetails.length} Categories exported successfully`,
      {}
    )
    await customLogger(projectId, destinationStackId, 'info', message);
    // console.log(
    //   `${categoryDetails.length}`,
    //   " Categories exported successfully"
    // );
  } catch (err) {
    const message = getLogMessage(
      srcFunc,
      "Error in saving categories.",
      {},
      err
    )
    await customLogger(projectId, destinationStackId, 'error', message);
    // console.error("Error in saving categories:", err);
  }
}
async function getAllCategories(affix: string, packagePath: string, destinationStackId:string, projectId: string) {
  const srcFunc = 'getAllCategories';
  try {
    await startingDirCategories(affix);
    const alldata: any = await fs.promises.readFile(packagePath, "utf8");
    const alldataParsed = JSON.parse(alldata);
    const categories =
      alldataParsed?.rss?.channel?.["wp:category"] ??
      alldataParsed?.channel?.["wp:category"] ??
      "";

    if (!categories || categories.length === 0) {
      const message = getLogMessage(
        srcFunc,
        `No categories found`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
      // console.log("\nNo categories found");
      return;
    }

    const categoriesArrray = Array.isArray(categories) ? 
    categories.map((categoryinfo) => ({
        id: categoryinfo["wp:term_id"],
        title: categoryinfo["wp:cat_name"],
        nicename: categoryinfo["wp:category_nicename"],
        description: categoryinfo["wp:category_description"],
        parent: categoryinfo["wp:category_parent"],
      }))
      : [
        {
          id: categories["wp:term_id"],
          title: categories["wp:cat_name"],
          nicename: categories["wp:category_nicename"],
          description: categories["wp:category_description"],
          parent: categories["wp:category_parent"],
        },
      ];

    await saveCategories(categoriesArrray, destinationStackId, projectId);
  } catch (err) {
    const message = getLogMessage(
      srcFunc,
      `"Error fetching categories:"`,
      {},
      err
    )
    await customLogger(projectId, destinationStackId, 'error', message);
  }
}
/************  end of categories module functions *********/

/************  Start of Posts module functions *********/

async function startingDirPosts() {
  postFolderPath = path.join(
    entrySave, MIGRATION_DATA_CONFIG.POSTS_DIR_NAME,
    MIGRATION_DATA_CONFIG.POSTS_FOLDER_NAME
  );
  //path.join(entrySave, affix ? affix+"_"+"terms": "terms");
  try {
    await fs.promises.access(postFolderPath);
  } catch {
    // Directory doesn't exist, create it
    await fs.promises.mkdir(postFolderPath, { recursive: true });
  }
}

function limitConcurrency(maxConcurrency: number) {
  let running = 0;
  const queue: any = [];

  function runNext() {
    if (running < maxConcurrency && queue.length > 0) {
      const task = queue.shift();
      running++;
      task().finally(() => {
        running--;
        runNext();
      });
      runNext();
    }
  }

  return async function limit(fn: any) {
    return new Promise((resolve, reject) => {
      queue.push(async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      runNext();
    });
  };
}
const limit = limitConcurrency(5);

async function featuredImageMapping(postid: string, post: any, postdata: any) {
  try {
    const assetsId = fs.readFileSync(
      path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE)
    );

    if (!post["wp:postmeta"] || !assetsId) return;

    const postmetaArray = Array.isArray(post["wp:postmeta"]) ? post["wp:postmeta"]
      : [post["wp:postmeta"]];

    const assetsDetails = postmetaArray
      .filter((meta) => meta["wp:meta_key"] === "_thumbnail_id")
      .map((meta) => {
        const attachmentid = `assets_${meta["wp:meta_value"]}`;
        return Object.values(assetsId).find(
          (asset: any) => asset.uid === attachmentid
        );
      })
      .filter(Boolean); // Filter out undefined matches

    if (assetsDetails.length > 0) {
      postdata[postid]["featured_image"] = assetsDetails;
    }
    return postdata;
  } catch (error) {
    console.error(error);
  }
}

const extractPostCategories = (categories: any) => {
  const postCategories: any = [],
    postTags: any = [],
    postTerms: any = [];

  const referenceId: any = fs.readFileSync(
    path.join(referencesFolder, MIGRATION_DATA_CONFIG.REFERENCES_FILE_NAME),
    "utf8"
  );
  const referenceDataParsed = JSON.parse(referenceId);
  const processCategory = (category: any) => {
    Object.keys(referenceDataParsed).forEach((key) => {
      if (category.attributes.nicename === referenceDataParsed[key].slug) {
        const contentType = referenceDataParsed[key].content_type;
        if (contentType.endsWith("terms")) {
          postTerms.push({ uid: key, _content_type_uid: contentType });
        } else if (contentType.endsWith("tag")) {
          postTags.push({ uid: key, _content_type_uid: contentType });
        } else if (contentType.endsWith("categories")) {
          postCategories.push({ uid: key, _content_type_uid: contentType });
        }
      }
    });
  };

  if (Array.isArray(categories)) {
    categories.forEach(processCategory);
  } else if (categories && categories["$"]?.["domain"] !== "category") {
    // console.info(categories, "------===");
    processCategory(categories);
  }

  return { postCategories, postTags, postTerms };
};

const extractPostAuthor = (authorTitle: any) => {
  const postAuthor: any = [];

  const processedAffix =  "authors";
  const authorId: any = fs.readFileSync(authorsFilePath);
  const authorDataParsed = JSON.parse(authorId);

  Object.keys(authorDataParsed).forEach((key) => {
    if (authorTitle.split(",").join("") === authorDataParsed[key].title) {
      postAuthor.push({ uid: key, _content_type_uid: processedAffix });
    }
  });

  return postAuthor;
};

async function processChunkData(
  chunkData: any,
  filename: string,
  isLastChunk: boolean
) {
  const postdata: any = {};
  try {
    const writePromises = [];

    const typeArray = [
      "page",
      "wp_global_styles",
      "wp_block",
      "attachment",
      "amp_validated_url",
    ];
    const statusArray = ["publish", "inherit"];
    const isValidPostType = (postType: string) => !typeArray.includes(postType);
    const isValidStatus = (status: string) => statusArray.includes(status);

    // iterate over data of each file
    for (const data of chunkData) {
      writePromises.push(
        limit(async () => {
          // necessary validations
          if (!isValidPostType(data["wp:post_type"])) return;
          if (!isValidStatus(data["wp:status"])) return;

          // get categories, tags, terms array
          const { postCategories, postTags, postTerms } = extractPostCategories(
            data["category"]
          );

          // get author array
          const postAuthor = extractPostAuthor(data["dc:creator"]);

          const dom = new JSDOM(
            data["content:encoded"]
              .replace(/<!--.*?-->/g, "")
              .replace(/&lt;!--?\s+\/?wp:.*?--&gt;/g, ""),
            { virtualConsole }
          );
          const htmlDoc = dom.window.document.querySelector("body");
          const jsonValue = htmlToJson(htmlDoc);
          const postDate = new Date(data["wp:post_date_gmt"]).toISOString();

          const base = blog_base_url.split("/").filter(Boolean);
          const blogname = base[base.length - 1];
          const url = data["link"].split(blogname)[1];
          const title = data["title"] ?? `Posts - ${data["wp:post_id"]}`
          let customId = idCorrector(uuidv4())
          postdata[customId] = {
            title: data["title"] ?? `Posts - ${data["wp:post_id"]}`,
            uid: customId,
            url: "/"+title.toLowerCase().replace(/ /g, "_"),
            date: postDate,
            full_description: jsonValue,
            excerpt: data["excerpt:encoded"]
              .replace(/<!--.*?-->/g, "")
              .replace(/&lt;!--?\s+\/?wp:.*?--&gt;/g, ""),
            author: postAuthor,
            category: postCategories,
            terms: postTerms,
            tag: postTags,
          };
          await featuredImageMapping(
            `posts_${data["wp:post_id"]}`,
            data,
            postdata
          );

          await writeFileAsync(
            path.join(postFolderPath, filename),
            postdata,
            4
          );
        })
      );
    }
    
    // Wait for all write promises to complete and store the results
    const results: any = await Promise.all(writePromises);
    // check if all promises resolved successfully
    const allSuccess = results.every(
      (result: any) => typeof result !== "object" || result?.success
    );

    if (isLastChunk && allSuccess) {
      console.info("last data");
    }
    return postdata
  } catch (error) {
    console.error(error);
    console.error("Error saving posts", error);
    return { success: false, message: error };
  }
}

async function extractPosts( packagePath: string, destinationStackId: string, projectId: string) {
  const srcFunc = "extractPosts";
  try {
    await startingDirPosts();
    const alldata: any = await fs.promises.readFile(packagePath, "utf8");
    const alldataParsed = JSON.parse(alldata);
    blog_base_url =
      alldataParsed?.rss?.channel["wp:base_blog_url"] ||
      alldataParsed?.channel["wp:base_blog_url"] ||
      "";

    const chunkFiles = fs.readdirSync(chunksDir);
    const lastChunk = chunkFiles[chunkFiles.length - 1];
    let postdataCombined: any = {};
    // Read and process all files in the directory except the first one
    for (const filename of chunkFiles) {
      const filePath = path.join(chunksDir, filename);
      const data: any = fs.readFileSync(filePath);
      const chunkData = JSON.parse(data);

      // Check if the current chunk is the last chunk
      const isLastChunk = filename === lastChunk;

      // Process the current chunk
      const chunkPostData = await processChunkData(chunkData, filename, isLastChunk);
      postdataCombined = { ...postdataCombined, ...chunkPostData };
      const message = getLogMessage(
        srcFunc,
        `${filename.split(".").slice(0, -1).join(".")} has been successfully transformed.`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);

    }
    await writeFileAsync(
      path.join(postFolderPath, "en-us.json"),
      postdataCombined,
      4
    );
    return;
  } catch (error) {
    const message = getLogMessage(
      srcFunc,
      `error while transforming the posts.`,
      {},
      error
    )
    await customLogger(projectId, destinationStackId, 'error', message);
    return;
  }
}

/************  end of Posts module functions *********/

/************  Start of Global fields module functions *********/
async function copyFolder(src: string, dest: string) {
  try {
    // Create the destination folder if it doesn't exist
    await fs.promises.mkdir(dest, { recursive: true });

    // Read all items in the source folder
    const items = await fs.promises.readdir(src, { withFileTypes: true });

    for (const item of items) {
      const srcPath = path.join(src, item.name);
      const destPath = path.join(dest, item.name);

      // If the item is a directory, recursively copy its contents
      if (item.isDirectory()) {
        await copyFolder(srcPath, destPath);
      } else {
        // If the item is a file, copy it to the destination
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  } catch (err) {
    const message = getLogMessage(
      "copyFolder",
      `Error copying folder from ${src} to ${dest}.`,
      {},
      err
    )
    await customLogger("projectId", dest, 'error', message);
    // console.error(`Error copying folder from ${src} to ${dest}:`, err);
  }
}
async function extractGlobalFields(destinationStackId: string, projectId: string) {
  const srcFunc = "extractGlobalFields";
  const sourcePath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "upload-api",
    "migration-wordpress"
  );
  const destinationPath = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId);

  const foldersToCopy = ["locales", "global_fields", "extensions"];

  for (const folder of foldersToCopy) {
    const sourceFolderPath = path.join(sourcePath, folder);
    const destinationFolderPath = path.join(destinationPath, folder);

    try {
      await copyFolder(sourceFolderPath, destinationFolderPath);
      const message = getLogMessage(
        srcFunc,
        `Successfully copied ${folder}`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
    } catch (err) {
      const message = getLogMessage(
        srcFunc,
        `Error copying ${folder}.`,
        {},
        err
      )
      await customLogger(projectId, destinationStackId, 'error', message);
      // console.error(`Error copying ${folder}:`, err);
    }
  }
}
/************  end of Global fields module functions *********/

export const wordpressService = {
  getAllAssets,
  createAssetFolderFile,
  getAllreference,
  extractChunks,
  getAllAuthors,
  // extractContentTypes,
  getAllTerms,
  getAllTags,
  getAllCategories,
  extractPosts,
  extractGlobalFields,
};
