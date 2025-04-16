import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
//import _ from "lodash";
import { MIGRATION_DATA_CONFIG } from "../constants/index.js";
import jsdom from "jsdom";
import { htmlToJson, jsonToHtml } from "@contentstack/json-rte-serializer";
import customLogger from "../utils/custom-logger.utils.js";
import { getLogMessage } from "../utils/index.js";
import { Advanced } from "../models/FieldMapper.js";
import { v4 as uuidv4 } from "uuid";
import { orgService } from "./org.service.js";

const { JSDOM } = jsdom;
const virtualConsole = new jsdom.VirtualConsole();
// Get the current file's path
const __filename = fileURLToPath(import.meta.url);

// Get the current directory
const __dirname = path.dirname(__filename);

const { DATA, EXPORT_INFO_FILE } = MIGRATION_DATA_CONFIG

//const slugRegExp = /[^a-z0-9_-]+/g;
let assetsSave = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME
);
let referencesFolder = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.REFERENCES_DIR_NAME
);
let contentTypeFolderPath = path.join(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.CONTENT_TYPES_DIR_NAME
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

interface FieldMapping {
  id: string;
    projectId: string;
    uid: string;
    otherCmsField: string;
    otherCmsType: string;
    contentstackField: string;
    contentstackFieldUid: string;
    contentstackFieldType: string;
    isDeleted: boolean;
    backupFieldType: string;
    refrenceTo: { uid: string; title: string };
    advanced: Advanced;
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

//helper function to convert entries with content type
async function mapContentTypeToEntry(contentType: any, data: any) {
  const result: { [key: string]: any } = {};
  for (const field of contentType?.fieldMapping || []) {
    const fieldValue = data?.[field?.uid] ?? null;
    let formattedValue ;
    switch (field?.contentstackFieldType) {
      case "single_line_text":
      case "text":
        formattedValue = fieldValue;
        break;
      case "html":
        formattedValue =
          fieldValue && typeof fieldValue === "object"
            ? await convertJsonToHtml(fieldValue)
            : fieldValue;
        break;
      case "json":    
          try {
            formattedValue = typeof fieldValue !== 'object' ? await convertHtmlToJson(fieldValue) : fieldValue;
          } catch (err) {
            console.error(`Error converting HTML to JSON for field ${field?.uid}:`, err);
            formattedValue = null;
          }
        break;
      case "reference":
        formattedValue = getParent(data,data[field.uid]);
        break;
      default:
        formattedValue = fieldValue;
    }
    if(field?.advanced?.multiple){
      formattedValue = Array.isArray(formattedValue) ? formattedValue : [formattedValue];
    }

    result[field?.contentstackFieldUid] = formattedValue;
  }

  return result;
}

// helper functions
async function writeFileAsync(filePath: string, data: any, tabSpaces: number) {
  filePath = path.resolve(filePath);
  data =
    typeof data == "object" ? JSON.stringify(data, null, tabSpaces)
      : data || "{}";
  await fs.promises.writeFile(filePath, data, "utf-8");
}

async function writeOneFile(indexPath: string, fileMeta: any) {
    fs.writeFile(indexPath, JSON.stringify(fileMeta), (err) => {
      if (err) {
        console.error('Error writing file: 3', err);
      }
    });
  }

  const getKeys = (obj: Record<string, any>): string[] => { //Function to fetch all the locale codes
    return Object.keys(obj);
  };

/************  Locale module functions start *********/
  
  const createLocale = async (req: any, destinationStackId: string, projectId: string, project: any) => {
    const srcFunc = 'createLocale';
    try {
      const baseDir = path.join(MIGRATION_DATA_CONFIG.DATA, destinationStackId);
      const localeSave = path.join(baseDir, MIGRATION_DATA_CONFIG.LOCALE_DIR_NAME);
      const allLocalesResp = await orgService.getLocales(req)
      const masterLocale = Object?.keys?.(project?.master_locale ?? LOCALE_MAPPER?.masterLocale)?.[0];
      const msLocale: any = {};
      const uid = uuidv4();
      msLocale[uid] = {
        "code": masterLocale,
        "fallback_locale": null,
        "uid": uid,
        "name": allLocalesResp?.data?.locales?.[masterLocale] ?? ''
      }
      const message = getLogMessage(
        srcFunc,
        `Master locale ${masterLocale} has been successfully transformed.`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
      const allLocales: any = {};
      for (const [key, value] of Object.entries(project?.locales ?? LOCALE_MAPPER.locales)) {
        const localeUid = uuidv4();
        if (key !== 'masterLocale' && typeof value === 'string') {
          allLocales[localeUid] = {
            "code": key,
            "fallback_locale": masterLocale,
            "uid": localeUid,
            "name": allLocalesResp?.data?.locales?.[key] ?? ''
          }
          const message = getLogMessage(
            srcFunc,
            `locale ${value} has been successfully transformed.`,
            {}
          )
          await customLogger(projectId, destinationStackId, 'info', message);
        }
      }
      const masterPath = path.join(localeSave, MIGRATION_DATA_CONFIG.LOCALE_MASTER_LOCALE);
      const allLocalePath = path.join(localeSave, MIGRATION_DATA_CONFIG.LOCALE_FILE_NAME);
      fs.access(localeSave, async (err) => {
        if (err) {
          fs.mkdir(localeSave, { recursive: true }, async (err) => {
            if (!err) {
              await writeOneFile(masterPath, msLocale);
              await writeOneFile(allLocalePath, allLocales);
            }
          })
        } else {
          await writeOneFile(masterPath, msLocale);
          await writeOneFile(allLocalePath, allLocales);
        }
      })
    } catch (err) {
      const message = getLogMessage(
        srcFunc,
        `error while Createing the locales.`,
        {},
        err
      )
      await customLogger(projectId, destinationStackId, 'error', message);
    }
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
      const fileContent = await fs.promises.readFile(assetsJsonPath, "utf8");
      assetData = JSON.parse(fileContent);
    } catch {
      // assets.json doesn't exist, create it
      await fs.promises.writeFile(assetsJsonPath, "{}");
      return;
    }

    try {
      await fs.promises.access(assetsSchemaJsonPath);
      // Read assets.json data
      const fileContent = await fs.promises.readFile(assetsSchemaJsonPath, "utf8");
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

function toCheckUrl(url : string, baseSiteUrl: string) {

  const validPattern = /^(https?:\/\/|www\.)/;
  return validPattern.test(url)
    ? url
    : `${baseSiteUrl}${url.replace(/^\/+/, "")}`;
}

async function saveAsset(assets: any, retryCount: number, affix: string, destinationStackId: string, projectId: string, baseSiteUrl:string) {
  const srcFunc = 'saveAsset';
  const url = encodeURI(toCheckUrl(assets["wp:attachment_url"],baseSiteUrl));
  const name = url.split("/").pop() || "";

  let description =
    assets["description"] ||
    assets["content:encoded"] ||
    assets["excerpt:encoded"] ||
    "";
  description =
    description.length > 255 ? description.slice(0, 255) : description;

  const parent_uid = affix ? "wordpressasset" : null;

  const customId = `assets_${assets["wp:post_id"]}`
  
  const assetPath = path.resolve(
    assetsSave, "files",
    customId,
    name
  );

  if (fs.existsSync(assetPath)) {
    console.error(`Asset already present: ${customId}`);
    return assets["wp:post_id"];
  }
  // else{
  //   fs.mkdirSync(
  //     path.resolve(
  //       assetPath
  //     )
  //   );
  // }

  try {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    fs.mkdirSync(
      path.resolve(assetsSave, "files", customId),
      { recursive: true }
    );

    fs.writeFileSync(path.resolve(assetsSave, "files", customId,name), response.data);

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
      return await saveAsset(assets, 1, affix, destinationStackId, projectId, baseSiteUrl);
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

async function getAsset(attachments: any[], affix: string, destinationStackId: string, projectId: string, baseSiteUrl:string) {
  const BATCH_SIZE = 5; // 5 promises at a time
  const results = [];
  
  for (let i = 0; i < attachments?.length; i += BATCH_SIZE) {
    const batch = attachments?.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.allSettled(
      batch?.map(async (data) => {
        await saveAsset(data, 0, affix, destinationStackId, projectId, baseSiteUrl)
      })
    );
    results?.push(...batchResults);
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
    const baseSiteUrl =
    alldataParsed?.rss?.channel?.["wp:base_site_url"] ||
    alldataParsed?.channel?.["wp:base_site_url"];
    const assets: Asset[] =
      alldataParsed?.rss?.channel?.item ?? alldataParsed?.channel?.item;
    // await writeFileAsync(path.join(assetsSave, MIGRATION_DATA_CONFIG.ASSETS_FILE_NAME), assets, 4);
    if (!assets || assets?.length === 0) {
      const message = getLogMessage(
        "createAssetFolderFile",
        `No assets found.`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
      // console.log("No assets found", projectId);
      return;
    }

    const attachments = assets?.filter(
      ({ "wp:post_type": postType }) => postType === "attachment"
    );
    if (attachments?.length > 0) {
      await getAsset(attachments, affix, destinationStackId, projectId,baseSiteUrl);
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
        name: 'wordpressasset',
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
    const categories = "categories";
    const terms =  "terms";
    const tag =  "tag";
   
    referenceArray.push(
      ...processReferenceData(
        referenceCategories,
        "category",
        "wp:category_",
        categories
      )
    );
    referenceArray.push(
      ...processReferenceData(referenceTerms, "terms", "wp:term_slug", terms)
    );
    referenceArray.push(
      ...processReferenceData(referenceTags, "tag", "wp:tag_slug", tag)
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
async function startingDirAuthors(
    affix: string,
    ct: string,
    master_locale: string,
    locales: object
  ) {
    const localeKeys = getKeys(locales);
    const authorFolderName = ct || MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME;
  
    authorsFolderPath = path.join(entrySave, authorFolderName, master_locale);
    authorsFilePath = path.join(authorsFolderPath, `${master_locale}.json`);
  
    try {
      await fs.promises.access(authorsFolderPath);
    } catch {
      await fs.promises.mkdir(authorsFolderPath, { recursive: true });
      await fs.promises.writeFile(authorsFilePath, "{}");
    }
  
    // Read master data once
    let masterData = "{}";
    try {
      masterData = await fs.promises.readFile(authorsFilePath, "utf-8");
    } catch (err) {
      console.error("Error reading master author file:", err);
    }
  
    for (const loc of localeKeys) {
      if (loc === master_locale) continue;
  
      const localeFolderPath = path.join(entrySave, authorFolderName, loc);
      const localeFilePath = path.join(localeFolderPath, `${loc}.json`);
  
      try {
        await fs.promises.mkdir(localeFolderPath, { recursive: true });
        await fs.promises.writeFile(localeFilePath, masterData);
      } catch (err) {
        console.error(`Error creating/writing file for locale ${loc}:`, err);
      }
    }
  }

const filePath = false;
async function saveAuthors(authorDetails: any[], destinationStackId: string, projectId: string, contentType: any, master_locale:string, locales:object) {
    const srcFunc = "saveAuthors";
    const localeKeys = getKeys(locales)
    try {
  
      const authordata: { [key: string]: any } = {};
  
      for (const data of authorDetails) {
        const uid = `authors_${data["wp:author_id"] || data["wp:author_login"]}`;
        const title = data["wp:author_login"] || `Authors - ${data["wp:author_id"]}`;
        const url = `/${title.toLowerCase().replace(/ /g, "_")}`;
        const customId = idCorrector(uid);
  
        const authordataEntry: any = {
          uid: uid,
          title: data["wp:author_login"],
          url: url,
          email: data["wp:author_email"],
          first_name: data["wp:author_first_name"],
          last_name: data["wp:author_last_name"],
        };
  
        authordata[customId] = {
          ...authordata[customId],
          uid: customId,
          ...( await mapContentTypeToEntry(contentType, authordataEntry)),
        };
        authordata[customId].publish_details = [];
  
        const message = getLogMessage(
          srcFunc,
          `Entry title ${data["wp:author_login"]} (authors) in the ${master_locale} locale has been successfully transformed.`,
          {}
        );
  
        await customLogger(projectId, destinationStackId, 'info', message);
      }
      await writeFileAsync(authorsFilePath, authordata, 4);
      await writeFileAsync(
        path.join(authorsFolderPath, "index.json"),
        { "1": `${master_locale}.json` },
          4
          );
          // Write index.json in other locale folders (not master)
for (const loc of localeKeys) {
    if (loc === master_locale) continue;
  
    const localeFolderPath = path.join(entrySave, MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME, loc);
    const indexPath = path.join(localeFolderPath, "index.json");
  
    try {
      await fs.promises.writeFile(
        indexPath,
        JSON.stringify({ "1": `${loc}.json` }, null, 4)
      );
    } catch (err) {
      console.error(`Error writing index.json for locale ${loc}:`, err);
    }
  }
  
  
      const message = getLogMessage(
        srcFunc,
        `${authorDetails?.length} Authors exported successfully`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
    } catch (error) {
      const message = getLogMessage(
        srcFunc,
        `Error while saving authors`,
        {},
        error
      )
      await customLogger(projectId, destinationStackId, 'error', message);
    }
  }
async function getAllAuthors(affix: string, packagePath: string,destinationStackId: string, projectId: string,contentTypes:any, keyMapper:any, master_locale:string, project:any) {
  const srcFunc = "getAllAuthors";
  const ct:any = keyMapper?.["authors"];
  const contenttype = contentTypes?.find((item:any)=> item?.otherCmsUid === 'authors')
  try {
    await startingDirAuthors(affix, ct, master_locale, project?.locales);
    const alldata: any = await fs.promises.readFile(packagePath, "utf8");
    const alldataParsed = JSON.parse(alldata);
    const authors: any =
      alldataParsed?.rss?.channel?.["wp:author"] ??
      alldataParsed?.channel?.["wp:author"] ??
      "";

    if (authors && authors.length > 0) {
      if (!filePath) {
        await saveAuthors(authors, destinationStackId, projectId,contenttype,master_locale, project?.locales);
      } else {
        const authorIds = fs.existsSync(filePath)? fs.readFileSync(filePath, "utf-8").split(",")
          : [];

        if (authorIds.length > 0) {
          const authorDetails = authors.filter((author: any) =>
            authorIds.includes(author["wp:author_id"])
          );

          if (authorDetails.length > 0) {
            await saveAuthors(authorDetails, destinationStackId, projectId,contenttype,master_locale, project?.locales);
          }
        }
      }
    } else if (typeof authors === "object") {
      if (
        !filePath ||
        (fs.existsSync(filePath) &&
          fs
            .readFileSync(filePath, "utf8")
            .split(",")
            .includes(authors["wp:author_id"]))
      ) {
        await saveAuthors([authors], destinationStackId, projectId,contenttype, master_locale, project?.locales);
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

/************  contenttypes module functions start *********/
async function startingDirContentTypes(destinationStackId: string) {
  contentTypeFolderPath = path.join(
    MIGRATION_DATA_CONFIG.DATA,
    destinationStackId,
    MIGRATION_DATA_CONFIG.CONTENT_TYPES_DIR_NAME
  );
  try {
    await fs.promises.access(contentTypeFolderPath);
  } catch {
    // Directory doesn't exist, create it
    await fs.promises.mkdir(contentTypeFolderPath, { recursive: true });
    // await fs.promises.writeFile(
    //   path.join(
    //     contentTypeFolderPath,
    //     MIGRATION_DATA_CONFIG.CONTENT_TYPES_FILE_NAME
    //   ),
    //   "{}"
    // );
    await fs.promises.writeFile(
      path.join(
        contentTypeFolderPath,
        MIGRATION_DATA_CONFIG.CONTENT_TYPES_SCHEMA_FILE
      ),
      "{}"
    );
  }
}

// const generateUid = (suffix: string) =>
//   globalPrefix
//     ? `${globalPrefix
//         .replace(/^\d+/, "")
//         .replace(/[^a-zA-Z0-9]+/g, "_")
//         .replace(/(^_+)|(_+$)/g, "")
//         .toLowerCase()}_${suffix}`
//     : suffix;

// const generateTitle = (title: string) =>
//   globalPrefix ? `${globalPrefix} - ${title}` : title;

const generateSchema = (
  title: string,
  uid: string,
  fields: any[],
  options: any
) => ({
  title: title,
  uid: uid,
  schema: fields,
  description: `Schema for ${title}`,
  options,
});

const ContentTypesSchema = [
  {
    title: "Authors",
    uid: "authors",
    schema: [
      {
        display_name: "Title",
        uid: "title",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: true,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "URL",
        uid: "url",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: true,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        data_type: "text",
        display_name: "Email",
        uid: "email",
        field_metadata: {
          description: "",
          default_value: "",
          version: 1,
        },
        format: "",
        multiple: false,
        mandatory: false,
        unique: false,
        non_localizable: false,
      },
      {
        data_type: "text",
        display_name: "First Name",
        uid: "first_name",
        field_metadata: {
          description: "",
          default_value: "",
          version: 1,
        },
        format: "",
        multiple: false,
        mandatory: false,
        unique: false,
        non_localizable: false,
      },
      {
        data_type: "text",
        display_name: "Last Name",
        uid: "last_name",
        field_metadata: {
          description: "",
          default_value: "",
          version: 1,
        },
        format: "",
        multiple: false,
        mandatory: false,
        unique: false,
        non_localizable: false,
      },
      {
        data_type: "json",
        display_name: "Biographical Info",
        uid: "biographical_info",
        field_metadata: {
          allow_json_rte: true,
          embed_entry: true,
          description: "",
          default_value: "",
          multiline: false,
          rich_text_type: "advanced",
          options: [],
          ref_multiple_content_types: true,
        },
        format: "",
        error_messages: { format: "" },
        reference_to: ["sys_assets"],
        multiple: false,
        non_localizable: false,
        unique: false,
        mandatory: false,
      },
    ],
    options: {
      is_page: true,
      title: "title",
      sub_title: [],
      description: "list of authors",
      _version: 1,
      url_prefix: "/author/",
      url_pattern: "/:title",
      singleton: false,
    },
  },
  {
    title: "Categories",
    uid: "categories",
    schema: [
      {
        display_name: "Title",
        uid: "title",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "URL",
        uid: "url",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: true,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "Nicename",
        uid: "nicename",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        data_type: "json",
        display_name: "Description",
        uid: "description",
        field_metadata: {
          allow_json_rte: true,
          embed_entry: true,
          description: "",
          default_value: "",
          multiline: false,
          rich_text_type: "advanced",
          options: [],
          ref_multiple_content_types: true,
        },
        format: "",
        error_messages: { format: "" },
        reference_to: ["sys_assets"],
        multiple: false,
        non_localizable: false,
        unique: false,
        mandatory: false,
      },
      {
        data_type: "reference",
        display_name: "Parent",
        reference_to: ["categories"],
        field_metadata: {
          ref_multiple: false,
          ref_multiple_content_types: true,
        },
        uid: "parent",
        multiple: false,
        mandatory: false,
        unique: false,
        non_localizable: false,
      },
    ],
    options: {
      is_page: true,
      title: "title",
      sub_title: [],
      url_pattern: "/:title",
      _version: 1,
      url_prefix: "/category/",
      description: "List of categories",
      singleton: false,
    },
  },
  {
    title: "Tags",
    uid: "tags",
    schema: [
      {
        display_name: "Title",
        uid: "title",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "URL",
        uid: "url",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: true,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "Slug",
        uid: "slug",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        data_type: "text",
        display_name: "Description",
        uid: "description",
        field_metadata: {
          description: "",
          default_value: "",
          multiline: true,
          version: 1,
        },
        format: "",
        error_messages: { format: "" },
        mandatory: false,
        multiple: false,
        non_localizable: false,
        unique: false,
      },
    ],
    options: {
      is_page: true,
      title: "title",
      sub_title: [],
      url_pattern: "/:title",
      _version: 1,
      url_prefix: "/tags/",
      description: "List of tags",
      singleton: false,
    },
  },
  {
    title: "Terms",
    uid: "terms",
    schema: [
      {
        display_name: "Title",
        uid: "title",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "URL",
        uid: "url",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: true,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "Taxonomy",
        uid: "taxonomy",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "Slug",
        uid: "slug",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
    ],
    options: {
      is_page: true,
      title: "title",
      sub_title: [],
      url_pattern: "/:title",
      _version: 1,
      url_prefix: "/terms/",
      description: "Schema for Terms",
      singleton: false,
    },
  },
  {
    title: "Posts",
    uid: "posts",
    schema: [
      {
        display_name: "Title",
        uid: "title",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        display_name: "URL",
        uid: "url",
        data_type: "text",
        field_metadata: { _default: true, version: 1 },
        unique: true,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        data_type: "json",
        display_name: "Body",
        uid: "full_description",
        field_metadata: {
          allow_json_rte: true,
          embed_entry: true,
          description: "",
          default_value: "",
          multiline: false,
          rich_text_type: "advanced",
          options: [],
          ref_multiple_content_types: true,
        },
        format: "",
        error_messages: { format: "" },
        reference_to: ["sys_assets"],
        multiple: false,
        non_localizable: false,
        unique: false,
        mandatory: false,
      },
      {
        data_type: "text",
        display_name: "Excerpt",
        uid: "excerpt",
        field_metadata: {
          description: "",
          default_value: "",
          multiline: true,
          version: 1,
        },
        format: "",
        error_messages: { format: "" },
        mandatory: false,
        multiple: false,
        non_localizable: false,
        unique: false,
      },
      {
        data_type: "file",
        display_name: "Featured Image",
        uid: "featured_image",
        field_metadata: { description: "", rich_text_type: "standard" },
        unique: false,
        mandatory: false,
        multiple: true,
        non_localizable: false,
      },
      {
        data_type: "isodate",
        display_name: "Date",
        uid: "date",
        startDate: null,
        endDate: null,
        field_metadata: { description: "", default_value: {} },
        mandatory: false,
        multiple: false,
        non_localizable: false,
        unique: false,
      },
      {
        data_type: "reference",
        display_name: "Author",
        reference_to: ["authors"],
        field_metadata: {
          ref_multiple: true,
          ref_multiple_content_types: true,
        },
        uid: "author",
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        data_type: "reference",
        display_name: "Categories",
        reference_to: ["categories"],
        field_metadata: {
          ref_multiple: true,
          ref_multiple_content_types: true,
        },
        uid: "category",
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        data_type: "reference",
        display_name: "Terms",
        reference_to: ["terms"],
        field_metadata: {
          ref_multiple: true,
          ref_multiple_content_types: true,
        },
        uid: "terms",
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
      {
        data_type: "reference",
        display_name: "Tags",
        reference_to: ["tag"],
        field_metadata: {
          ref_multiple: true,
          ref_multiple_content_types: true,
        },
        uid: "tag",
        unique: false,
        mandatory: false,
        multiple: false,
        non_localizable: false,
      },
    ],
    options: {
      is_page: true,
      title: "title",
      sub_title: [],
      url_pattern: "/:year/:month/:title",
      _version: 1,
      url_prefix: "/blog/",
      description: "Schema for Posts",
      singleton: false,
    },
  },
];

async function extractContentTypes(projectId: string,destinationStackId: string) {
  try {
    await startingDirContentTypes(destinationStackId);
    const schemaJson = ContentTypesSchema.map(
      ({ title, uid, schema, options }) =>{
        const generated = generateSchema(title, uid, schema, options)
        return generated;
      }
        
    );
    // await writeFileAsync(
    //   path.join(
    //     contentTypeFolderPath,
    //     MIGRATION_DATA_CONFIG.CONTENT_TYPES_FILE_NAME
    //   ),
    //   schemaJson,
    //   4
    // );
    await writeFileAsync(
      path.join(
        contentTypeFolderPath,
        MIGRATION_DATA_CONFIG.CONTENT_TYPES_SCHEMA_FILE
      ),
      schemaJson,
      4
    );
    const message = getLogMessage(
      "extractContentTypes",
      `Succesfully created content_types`,
      {}
    )
    await customLogger(projectId, destinationStackId, 'info', message);
    
    return;
  } catch (error) {
    const message = getLogMessage(
      "extractContentTypes",
      `Error while creating content_types`,
      {},
      error
    )
    await customLogger(projectId, destinationStackId, 'error', message);
    return ;
  }
}

/************  end of contenttypes module functions *********/

/************  terms module functions start *********/
async function startingDirTerms(
    affix: string,
    ct: string,
    master_locale: string,
    locales: object
  ) {
    const localeKeys = getKeys(locales);
    const termsFolderName = ct || MIGRATION_DATA_CONFIG.TERMS_DIR_NAME;
  
    // Master locale folder and file
    termsFolderPath = path.join(entrySave, termsFolderName, master_locale);
    const masterFilePath = path.join(termsFolderPath, `${master_locale}.json`);
  
    try {
      await fs.promises.access(termsFolderPath);
    } catch {
      await fs.promises.mkdir(termsFolderPath, { recursive: true });
      await fs.promises.writeFile(masterFilePath, "{}");
    }
  
    // Read data from the master locale file
    let masterData = "{}";
    try {
      masterData = await fs.promises.readFile(masterFilePath, "utf-8");
    } catch (err) {
      console.error("Error reading master locale file:", err);
    }
  
    // Other locale folders and files
    for (const loc of localeKeys) {
      if (loc === master_locale) continue;
  
      const localeFolderPath = path.join(entrySave, termsFolderName, loc);
      const localeFilePath = path.join(localeFolderPath, `${loc}.json`);
  
      try {
        await fs.promises.mkdir(localeFolderPath, { recursive: true });
        await fs.promises.writeFile(localeFilePath, masterData);
      } catch (err) {
        console.error(`Error creating/writing file for locale ${loc}:`, err);
      }
    }
  }

async function saveTerms(termsDetails: any[], destinationStackId: string, projectId: string, contentType:any,master_locale: string, locales:object) {
  const localeKeys = getKeys(locales)
    const srcFunc = "saveTerms";
  try {
    const termsFilePath = path.join(
      termsFolderPath,
      `${master_locale}.json`
    );
    const termsdata: { [key: string]: any } = {};
    for (const data of termsDetails) {
      const { id } = data;
      const uid = `terms_${id}`;
      const customId = uid;
        // const title = name ?? `Terms - ${id}`;
        //const url = `/${title.toLowerCase().replace(/ /g, "_")}`; 


        termsdata[customId] = {
          ...termsdata[customId],
          uid: customId,
          ...(await mapContentTypeToEntry(contentType, data)),
        };
        termsdata[customId].publish_details = [];
    }

    await writeFileAsync(termsFilePath, termsdata, 4);
    await writeFileAsync(path.join(termsFolderPath, "index.json"), {"1": `${master_locale}.json`}, 4);

    for (const loc of localeKeys) {
        if (loc === master_locale) continue;
  
        const localeFolderPath = path.join(entrySave, MIGRATION_DATA_CONFIG.TERMS_DIR_NAME, loc);
        const indexPath = path.join(localeFolderPath, "index.json");
  
        try {
          await fs.promises.mkdir(localeFolderPath, { recursive: true });
          await writeFileAsync(
            indexPath,
            { "1": `${loc}.json` },
            4
          );
        } catch (err) {
          console.error(`Error creating index.json for ${loc}:`, err);
        }
      }
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

async function getAllTerms(affix: string, packagePath: string, destinationStackId:string, projectId: string, contentTypes:any, keyMapper:any,master_locale: string, project:any) {
  const srcFunc = "getAllTerms";
  const ct:any = keyMapper?.["terms"];
  const contenttype = contentTypes?.find((item:any)=> item?.otherCmsUid === 'terms')
  try {
    await startingDirTerms(affix, ct,master_locale, project?.locales);
    const alldata: any = await fs.promises.readFile(packagePath, "utf8");
    const alldataParsed = JSON.parse(alldata);
    const terms =
      alldataParsed?.rss?.channel?.["wp:term"] ||
      alldataParsed?.channel?.["wp:term"] ||
      "";

    if (!terms || terms?.length === 0) {
      const message = getLogMessage(
        srcFunc,
        `No terms found`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);
      // console.log("\nNo terms found");
      return;
    }
    
    const termsArray = Array.isArray(terms) ? terms.map((term) => {
       
      return {
        id: term["wp:term_id"],
        title: term["wp:term_name"],
        slug: term["wp:term_slug"],
        taxonomy: term["wp:term_taxonomy"],
      }
    })
      : [
        {
          id: terms["wp:term_id"],
          title: terms["wp:term_name"],
          slug: terms["wp:term_slug"],
          taxonomy: terms["wp:term_taxonomy"],
        },
      ];
    
    await saveTerms(termsArray, destinationStackId, projectId, contenttype,master_locale, project?.locales);
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
async function startingDirTags(
    affix: string,
    ct: string,
    master_locale: string,
    locales: object
  ) {
    const localeKeys = getKeys(locales);
  
    const tagsFolderName = ct || MIGRATION_DATA_CONFIG.TAG_DIR_NAME;
  
    // Master locale folder and file
    tagsFolderPath = path.join(entrySave, tagsFolderName, master_locale);
    const masterFilePath = path.join(tagsFolderPath, `${master_locale}.json`);
  
    try {
      await fs.promises.access(tagsFolderPath);
    } catch {
      await fs.promises.mkdir(tagsFolderPath, { recursive: true });
      await fs.promises.writeFile(masterFilePath, "{}");
    }
  
    // Read the data from the master locale JSON
    let masterData = "{}";
    try {
      masterData = await fs.promises.readFile(masterFilePath, "utf-8");
    } catch (err) {
      console.error("Error reading master locale file:", err);
    }
  
    // Create locale-specific folders and copy master data
    for (const loc of localeKeys) {
      if (loc === master_locale) continue;
  
      const localeFolderPath = path.join(entrySave, tagsFolderName, loc);
      const localeFilePath = path.join(localeFolderPath, `${loc}.json`);
  
  
      try {
        await fs.promises.mkdir(localeFolderPath, { recursive: true });
        await fs.promises.writeFile(localeFilePath, masterData);
      } catch (err) {
        console.error(`Error creating/writing file for locale ${loc}:`, err);
      }
    }
  }

async function saveTags(tagDetails: any[], destinationStackId: string, projectId: string, contenttype:any, master_locale: string, locales:object) {
    const localeKeys = getKeys(locales)
  const srcFunc = 'saveTags';
  try {
    const tagsFilePath = path.join(
      tagsFolderPath,
      `${master_locale}.json`
    );
    const tagsdata: { [key: string]: any } = {};
  
    for(const data of tagDetails) {
      const { id } = data;
      const uid = `tags_${id}`;
      //const title = `Tags - ${id}`;
     // const url = `/tags/${uid}`;
      //const url = `/${title.toLowerCase().replace(/ /g, "_")}`;
      const customId = idCorrector(uid);

      tagsdata[customId]={
        ...tagsdata[customId],
        uid:customId,
        ...( await mapContentTypeToEntry(contenttype,data)),
      };
      tagsdata[customId].publish_details = [];

    }
    await writeFileAsync(tagsFilePath, tagsdata, 4);
    await writeFileAsync(path.join(tagsFolderPath, "index.json"), {"1": `${master_locale}.json`}, 4);
         // Write index.json for all other locales
         for (const loc of localeKeys) {
           if (loc === master_locale) continue;
     
           const localeFolderPath = path.join(entrySave, MIGRATION_DATA_CONFIG.TAG_DIR_NAME, loc);
           const indexPath = path.join(localeFolderPath, "index.json");
     
           try {
             await fs.promises.mkdir(localeFolderPath, { recursive: true });
             await writeFileAsync(indexPath, { "1": `${loc}.json` }, 4);
           } catch (err) {
             console.error(`Error creating index.json for locale '${loc}' in tags:`, err);
           }
         }
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
async function getAllTags(affix: string, packagePath: string, destinationStackId:string, projectId: string,contentTypes:any, keyMapper:any, master_locale: string, project:any) {
  const srcFunc = "getAllTags";
  const ct:any = keyMapper?.["tag"];
  const contenttype = contentTypes?.find((item:any)=> item?.otherCmsUid === 'tag');

  try {
    await startingDirTags(affix, ct, master_locale, project?.locales);
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
        name: taginfo["wp:tag_name"],
        slug: taginfo["wp:tag_slug"],
        description: taginfo["wp:tag_description"],
        title:taginfo["wp:tag_name"]
      }))
      : [
        {
          id: tags["wp:term_id"],
          name: tags["wp:tag_name"],
          slug: tags["wp:tag_slug"],
          description: tags["wp:tag_description"],
          title:tags["wp:tag_name"]
        },
      ];

    await saveTags(tagsArray, destinationStackId, projectId, contenttype, master_locale, project?.locales);
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
async function startingDirCategories(
    affix: string,
    ct: string,
    master_locale: string,
    locales: object
  ) {
    const localeKeys = getKeys(locales);
  
    const categoryFolderName = ct || MIGRATION_DATA_CONFIG.CATEGORIES_DIR_NAME;
  
    // Create master locale folder and file
    categoriesFolderPath = path.join(entrySave, categoryFolderName, master_locale);
    const masterFilePath = path.join(categoriesFolderPath, `${master_locale}.json`);
  
    try {
      await fs.promises.access(categoriesFolderPath);
    } catch {
      await fs.promises.mkdir(categoriesFolderPath, { recursive: true });
      await fs.promises.writeFile(masterFilePath, "{}");
    }
  
    // Read master locale data
    let masterData = "{}";
    try {
      masterData = await fs.promises.readFile(masterFilePath, "utf-8");
    } catch (err) {
      console.error("Error reading master locale file:", err);
    }
  
    // Create locale-specific folders and files (excluding master)
    for (const loc of localeKeys) {
      if (loc === master_locale) continue;
  
      const localeFolderPath = path.join(entrySave, categoryFolderName, loc);
      const localeFilePath = path.join(localeFolderPath, `${loc}.json`);
  
  
      try {
        await fs.promises.mkdir(localeFolderPath, { recursive: true });
        await fs.promises.writeFile(localeFilePath, masterData);
      } catch (err) {
        console.error(`Error creating/writing file for locale ${loc}:`, err);
      }
    }
  }

const convertHtmlToJson = (htmlString: unknown): any => {
  if (typeof htmlString === 'string') {
    const dom = new JSDOM(htmlString.replace(/&amp;/g, "&"));
    const htmlDoc = dom.window.document.querySelector("body");
    return htmlToJson(htmlDoc);
  }

  return htmlString;
};

const convertJsonToHtml = async (json: any) => {
  const htmlValue = await jsonToHtml(json);
  return htmlValue;

}

function getParent(data: any,id: string) {
  const parentId: any = fs.readFileSync(
    path.join(referencesFolder, MIGRATION_DATA_CONFIG.REFERENCES_FILE_NAME),
    "utf8"
  );

  const parentIdParsed = JSON.parse(parentId);
  const catParent: any = [];
  const getParent = id;
  
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
async function saveCategories(categoryDetails: any[], destinationStackId:string, projectId: string, contenttype:any, master_locale:string, locales:object) {
  const srcFunc = 'saveCategories';
  const localeKeys = getKeys(locales);
  try {
    const categorydata: { [key: string]: any } = {}
    for(const data of categoryDetails){
     
        const uid = `category_${data["id"]}`;

        const customId = uid

        // Accumulate category data
        categorydata[customId]={
          ...categorydata[customId],
          uid:customId,
          ...(await mapContentTypeToEntry(contenttype,data)),
        }
        categorydata[customId].publish_details = [];
    }

    await writeFileAsync(
      path.join(
        categoriesFolderPath,
        MIGRATION_DATA_CONFIG.CATEGORIES_FILE_NAME
      ),
      categorydata,
      4
    );
    await writeFileAsync(path.join(categoriesFolderPath, "index.json"), {"1": `${master_locale}.json`}, 4);
        // Create index.json for other locales and write data for those locales
        for (const loc of localeKeys) {
            if (loc === master_locale) continue;
      
            const localeFolderPath = path.join(entrySave, MIGRATION_DATA_CONFIG.CATEGORIES_DIR_NAME, loc);
            const indexPath = path.join(localeFolderPath, "index.json");
      
            try {
              await fs.promises.writeFile(
                indexPath,
                JSON.stringify({ "1": `${loc}.json` }, null, 4)
              );
            } catch (err) {
              console.error(`Error writing index.json for locale ${loc}:`, err);
            }
          }

    const message = getLogMessage(
      srcFunc,
      `${categoryDetails?.length} Categories exported successfully`,
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
      `Error in saving categories. ${err}`,
      {},
      err
    )
    await customLogger(projectId, destinationStackId, 'error', message);
    // console.error("Error in saving categories:", err);
  }
}
async function getAllCategories(affix: string, packagePath: string, destinationStackId:string, projectId: string,contentTypes:any, keyMapper:any, master_locale: string, project:any) {
  const srcFunc = 'getAllCategories';
  const ct:any = keyMapper?.["categories"];
  const contenttype = contentTypes?.find((item:any)=> item?.otherCmsUid === 'categories');

  try {
    await startingDirCategories(affix, ct, master_locale, project?.locales);
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

    await saveCategories(categoriesArrray, destinationStackId, projectId, contenttype, master_locale, project.locales);
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

async function startingDirPosts(
    ct: string,
    master_locale: string,
    locales: object
  ) {
    const localeKeys = getKeys(locales);
    const postsFolderName = ct || MIGRATION_DATA_CONFIG.POSTS_DIR_NAME;
  
    // Create master locale folder and file
    postFolderPath = path.join(entrySave, postsFolderName, master_locale);
    const masterFilePath = path.join(postFolderPath, `${master_locale}.json`);
  
    try {
      await fs.promises.access(postFolderPath);
    } catch {
      await fs.promises.mkdir(postFolderPath, { recursive: true });
      await fs.promises.writeFile(masterFilePath, "{}");
    }
  
    // Read the master locale data
    let masterData = "{}";
    try {
      masterData = await fs.promises.readFile(masterFilePath, "utf-8");
    } catch (err) {
      console.error("Error reading master locale file:", err);
    }
  
    // Create folders and files for other locales
    for (const loc of localeKeys) {
      if (loc === master_locale) continue;
  
      const localeFolderPath = path.join(entrySave, postsFolderName, loc);
      const localeFilePath = path.join(localeFolderPath, `${loc}.json`);
  
  
      try {
        await fs.promises.mkdir(localeFolderPath, { recursive: true });
        await fs.promises.writeFile(localeFilePath, masterData);
      } catch (err) {
        console.error(`Error creating/writing file for locale ${loc}:`, err);
      }
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
    const filePath = path.join(process.cwd(), assetsSave, MIGRATION_DATA_CONFIG.ASSETS_SCHEMA_FILE);
   const fileContent = fs.readFileSync(filePath, 'utf8').trim();
  
   if (!fileContent) {
    throw new Error(`File ${filePath} is empty or missing`);
  }
    const assetsId = JSON?.parse(fileContent);
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
    
    if (assetsDetails?.length > 0) {
      postdata[postid]["featured_image"] = assetsDetails[0];
    }
    return postdata;
  } catch (error) {
    console.error(error);
  }
}

const extractPostCategories = (categories: any,) => {
  const postCategories: any = [],
    postTags: any = [],
    postTerms: any = [];

  const referenceId: any = fs.readFileSync(
    path.join(path.join(process.cwd(),referencesFolder, MIGRATION_DATA_CONFIG.REFERENCES_FILE_NAME)),
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
    processCategory(categories);
  }

  return { postCategories, postTags, postTerms };
};

const extractPostAuthor = (authorTitle: any) => {
  const postAuthor: any = [];

  const processedAffix =  "authors";
  const authorId: any = fs.readFileSync(path.join(process.cwd(),authorsFilePath));
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
  isLastChunk: boolean,
  contenttype: any
) {
  const postdata: any = {};
  const formattedPosts: any = {};
  let postdataCombined = {}
  
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
          const postDate = new Date(data["wp:post_date_gmt"])?.toISOString();

          const base = blog_base_url?.split("/")?.filter(Boolean);
          const blogname = base[base?.length - 1];
          const url = data["link"]?.split(blogname)[1];
          //const title = data["title"] ?? `Posts - ${data["wp:post_id"]}`;
          const uid = `posts_${data["wp:post_id"]}`
          const customId = idCorrector(uid)
          postdata[customId] = {
            title: data["title"] || `Posts - ${data["wp:post_id"]}`,
            uid: customId,
            url: url,
            date: postDate,
            full_description: jsonValue,
            excerpt: data["excerpt:encoded"]
              .replace(/<!--.*?-->/g, "")
              .replace(/&lt;!--?\s+\/?wp:.*?--&gt;/g, ""),
            author: postAuthor,
            category: postCategories,
            terms: postTerms,
            tag: postTags,
            featured_image: '',
            publish_details:[]
          };
        
         
          for (const [key, value] of Object.entries(postdata as {[key: string]: any})) {
            const customId = idCorrector(value?.uid);
            formattedPosts[customId] = {
              ...formattedPosts[customId],
              uid: customId,
              ...(await mapContentTypeToEntry(contenttype, value)),
            };
            formattedPosts[customId].publish_details = [];
          }
          const formatted_posts =  await featuredImageMapping(
            `posts_${data["wp:post_id"]}`,
            data,
            formattedPosts
          );
          postdataCombined = { ...postdataCombined, ...formatted_posts };

          // await writeFileAsync(
          //   path.join(postFolderPath, filename),
          //   postdata,
          //   4
          // );
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

    return postdataCombined
  } catch (error) {
    console.error(error);
    console.error("Error saving posts", error);
    return { success: false, message: error };
  }
}

async function extractPosts( packagePath: string, destinationStackId: string, projectId: string,contentTypes:any, keyMapper:any, master_locale: string, project:any) {
  const srcFunc = "extractPosts";
  const ct:any = keyMapper?.["posts"];
  const contenttype = contentTypes?.find((item:any)=> item?.otherCmsUid === 'posts');

  try {
    await startingDirPosts(ct, master_locale, project?.locales);
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
      const chunkPostData = await processChunkData(chunkData, filename, isLastChunk, contenttype);
      postdataCombined = { ...postdataCombined, ...chunkPostData };
      const message = getLogMessage(
        srcFunc,
        `${filename.split(".").slice(0, -1).join(".")} has been successfully transformed.`,
        {}
      )
      await customLogger(projectId, destinationStackId, 'info', message);

    }
    await writeFileAsync(
      path.join(postFolderPath, `${master_locale}.json`),
      postdataCombined,
      4
    );
    await writeFileAsync(
      path.join(postFolderPath, "index.json"),
      { "1": `${master_locale}.json` },
        4
        );
    // Save index.json for other locales
     const localeKeys = getKeys(project?.locales);
     const postsFolderName = ct || MIGRATION_DATA_CONFIG.POSTS_DIR_NAME;
     for (const loc of localeKeys) {
       if (loc === master_locale) continue;
 
       const localeFolderPath = path.join(entrySave, postsFolderName, loc);
       const indexPath = path.join(localeFolderPath, "index.json");
 
       try {
         await fs.promises.writeFile(
           indexPath,
           JSON.stringify({ "1": `${loc}.json` }, null, 4)
         );
       } catch (err) {
         console.error(`Error writing index.json for locale ${loc}:`, err);
       }
     }
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
  const destinationPath = path.join(MIGRATION_DATA_CONFIG.DATA, MIGRATION_DATA_CONFIG.DATA);

  const foldersToCopy = ["locales"]; //, "global_fields", "extensions"

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

const createVersionFile = async (destinationStackId: string, projectId: string) => {
  try {
    await writeFileAsync(path?.join?.(DATA, destinationStackId, EXPORT_INFO_FILE),
      {
        contentVersion: 2,
        logsPath: "",
      }, 4)
      const message = getLogMessage(
        "createVersionFile",
        `Version File created`,
        {}
      );
      await customLogger(projectId, destinationStackId, "info", message);
  } catch (err) {
    const message = getLogMessage(
      "createVersionFile",
      `Error writing file: ${err}`,
      {},
      err
    )
    await customLogger(projectId, destinationStackId, 'error', message);
  }
};

export const wordpressService = {
  getAllAssets,
  createAssetFolderFile,
  getAllreference,
  extractChunks,
  getAllAuthors,
  extractContentTypes,
  getAllTerms,
  getAllTags,
  getAllCategories,
  extractPosts,
  extractGlobalFields,
  createVersionFile
};