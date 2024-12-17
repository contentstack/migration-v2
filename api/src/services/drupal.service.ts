import fs, { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import read from "fs-readdir-recursive";
import { v4 as uuidv4 } from "uuid";
import _ from "lodash";
import { MIGRATION_DATA_CONFIG } from "../constants/index.js";
import {
  entriesFieldCreator,
  unflatten,
} from "../utils/entries-field-creator.utils.js";
import { orgService } from "./org.service.js";
import jsdom from "jsdom";
import { htmlToJson } from "@contentstack/json-rte-serializer";
import mysql from "mysql2";
import { unserialize } from "php-serialize";
import { getLogMessage } from "../utils/index.js";
import customLogger from "../utils/custom-logger.utils.js";
import { error } from "console";

const { JSDOM } = jsdom;
const virtualConsole = new jsdom.VirtualConsole();
// Get the current file's path
const __filename = fileURLToPath(import.meta.url);
// Get the current directory
const __dirname = path.dirname(__filename);

const {DATA,EXPORT_INFO_FILE} = MIGRATION_DATA_CONFIG

// helper functions
const idCorrector = ( id : any) => {
  const newId = id?.replace(/[-{}]/g, (match: any) => match === '-' ? '' : '')
  if (newId) {
    return newId?.toLowerCase()
  } else {
    return id
  }
}

async function writeFileAsync(filePath: string, data: any, tabSpaces: number) {
  filePath = path.resolve(filePath);
  data =
    typeof data == "object"
      ? JSON.stringify(data, null, tabSpaces)
      : data || "{}";
  await fs.promises.writeFile(filePath, data, "utf-8");
}

const checkFileExists = async (filePath: string) => {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
};

async function readFileAsync(filePath: string) {
  try {
    if (await checkFileExists(filePath)) {
      const fileContent = await fs.promises.readFile(filePath, "utf-8");
      return fileContent ? JSON.parse(fileContent) : {};
    }
    return {};
  } catch (error) {
    console.log("error while reading ", filePath)
    return {}
  }
  
}

function connect() {
  var connection = mysql.createConnection({
    host: MIGRATION_DATA_CONFIG["MYSQL"]["HOST"],
    user: MIGRATION_DATA_CONFIG["MYSQL"]["USER"],
    password: MIGRATION_DATA_CONFIG["MYSQL"]["PASSWORD"],
    database: MIGRATION_DATA_CONFIG["MYSQL"]["DATABASE"],
  });
  return connection;
}

async function initialDirSetUp(folderpath: string, filepath: string) {
  try {
    await fs.promises.access(folderpath);
  } catch {
    await fs.promises.mkdir(folderpath, { recursive: true });
    await fs.promises.writeFile(filepath, "{}");
    console.log(folderpath, "created!!!!");
  }
}

let localeFolderPath = path.resolve(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.LOCALE_DIR_NAME
);

let assetFolderPath = path.resolve(
  MIGRATION_DATA_CONFIG.DATA,
  MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME
);

let assetFilePath = path.join(
  assetFolderPath,
  MIGRATION_DATA_CONFIG.ASSETS_FILE_NAME
);

let logsFolderPath = path.resolve(MIGRATION_DATA_CONFIG.DATA, "logs");
let failedAssets: any = {};
let assetData: any = {};
let destination_stack_id: string;
let project_id: string;

const vocLimit = 100;
const refLimit = 100;
const postLimit = 5;
const chunkSize = 1048576;

const handleEntries = async (destinationStackId: string, projectId: string) => {
  console.log("handling entries");
  destination_stack_id = destinationStackId;
  const { DATA, ENTRIES_DIR_NAME } = MIGRATION_DATA_CONFIG;
  const entryFolderPath = path.join(DATA, destinationStackId, ENTRIES_DIR_NAME);
  await createCTFolders();
  let allEntries: any = await getAllFiles(entryFolderPath);
  console.log(allEntries, "allEntries.length created ->>", allEntries.length);

  for (let i = 0; i < allEntries.length; i++) {
    let commonFolderPath = entryFolderPath;
    let entryPath = allEntries[i];
    let differenceFilePath = path.relative(commonFolderPath, entryPath);

    const diffChecker = differenceFilePath.split(path.sep);

    if (diffChecker.length < 3) {
      let locale = entryPath.split("/").reverse()[0].split(".")[0];
      let content_type = entryPath.split("/").reverse()[1];
      try {
        await fs.promises.access(
          path.join(entryFolderPath, content_type, locale)
        );
      } catch {
        await fs.promises.mkdir(
          path.join(entryFolderPath, content_type, locale),
          { recursive: true }
        );
        console.log(
          "folder created ->>",
          path.join(entryFolderPath, content_type, locale)
        );
      }
      // makeDirectory(path.join(entryFolderPath, content_type, locale));
      let entryData = await readFileAsync(entryPath);
      let chunks: any = await makeChunksEntries(entryData);

      let refs: any = {};
      for (let i = 0; i < Object.keys(chunks).length; i++) {
        let chunkId = Object.keys(chunks)[i];
        refs[i + 1] = `${chunkId}-entries.json`;
        await writeFileAsync(
          path.join(
            entryFolderPath,
            content_type,
            locale,
            `${chunkId}-entries.json`
          ),

          {
            ...chunks[chunkId],
          },
          4
        );
      }
      await writeFileAsync(
        path.join(entryFolderPath, content_type, locale, "index.json"),
        refs,
        4
      );
    }
  }
};

const createCTFolders = async () => {
  const { DATA, ENTRIES_DIR_NAME } = MIGRATION_DATA_CONFIG;
  const entryFolderPath = path.join(
    DATA,
    destination_stack_id,
    ENTRIES_DIR_NAME
  );

  const CTs = fs.readdirSync(entryFolderPath);
  for (let i = 0; i < CTs.length; i++) {
    try {
      await fs.promises.access(path.join(entryFolderPath, CTs[i]));
    } catch {
      await fs.promises.mkdir(path.join(entryFolderPath, CTs[i]), {
        recursive: true,
      });
      console.log("folder created22 ->>", path.join(entryFolderPath, CTs[i]));
    }
  }
};

const makeChunksEntries = async (entryData: any) => {
  let currentChunkSize = 0;
  let currentChunkId = uuidv4();
  let chunks: any = {};
  for (
    let currentAssetId = 0;
    currentAssetId < Object.keys(entryData).length;
    currentAssetId += 1
  ) {
    let curAssetKey = Object.keys(entryData)[currentAssetId];

    let tempObj: any = {};
    tempObj[entryData[curAssetKey].uid] = entryData[curAssetKey];
    chunks[currentChunkId] = { ...chunks[currentChunkId], ...tempObj };

    currentChunkSize = Buffer.byteLength(
      JSON.stringify(chunks[currentChunkId]),
      "utf8"
    );
    if (currentChunkSize > chunkSize) {
      currentChunkId = uuidv4();
      currentChunkSize = 0;
      let tempObj: any = {};
      tempObj[entryData[curAssetKey].uid] = entryData[curAssetKey];
      chunks[currentChunkId] = tempObj;
    }
  }

  return chunks;
};

/************  contenttypes module functions starts *********/

const getAllFiles = async (folderPath: any, files: any = []) => {
  console.log("in get all files");
  console.log("folderPath", folderPath);

  const contents = fs.readdirSync(folderPath);
  console.log("contents", contents);
  console.log("files", files);
  contents.forEach((item) => {
    const itemPath = path.join(folderPath, item);
    const isDirectory = fs.statSync(itemPath).isDirectory();
    if (isDirectory) {
      getAllFiles(itemPath, files);
    } else {
      files.push(itemPath);
    }
  });
  return files;
};

const findSchema = async () => {
  const { DATA, CONTENT_TYPES_DIR_NAME } = MIGRATION_DATA_CONFIG;
  let contentTypeFolder = path.join(
    DATA,
    destination_stack_id,
    CONTENT_TYPES_DIR_NAME
  );
  try {
    await fs.promises.access(contentTypeFolder);
  } catch {
    await fs.promises.mkdir(contentTypeFolder, { recursive: true });
  }

  const allFiles = await getAllFiles(contentTypeFolder);
  const check = allFiles.find((item: any) => item.includes("schema.json"));
  let schema = [];
  if (!check) {
    for (let i = 0; i < allFiles.length; i++) {
      let data = await readFileAsync(allFiles[i]);
      schema.push(data);
      await writeFileAsync(
        path.join(contentTypeFolder, "schema.json"),
        schema,
        4
      );
    }
  }
};

const createSchemaFile = async (destinationStackId: string) => {
  destination_stack_id = destinationStackId;
  const { DATA, CONTENT_TYPES_DIR_NAME } = MIGRATION_DATA_CONFIG;
  fs.watch(
    path.join(DATA, destinationStackId, CONTENT_TYPES_DIR_NAME),
    (eventType, filename) => {
      if (eventType === "rename" && filename) {
        findSchema();
      }
    }
  );
};
/************  contenttypes module functions end *********/

/************  page module functions start *********/

async function putPosts(postsDetails: any, key: any, connection: any) {
  const {
    DATA,
    ASSETS_DIR_NAME,
    ASSETS_FILE_NAME,
    REFERENCES_DIR_NAME,
    REFERENCES_FILE_NAME,
    ENTRIES_DIR_NAME,
    TAXONOMY_DIR_NAME,
    TAXONOMY_FILE_NAME,
  } = MIGRATION_DATA_CONFIG;
  const assetId = readFileAsync(
    path.join(DATA, destination_stack_id, ASSETS_DIR_NAME, ASSETS_FILE_NAME)
  );
  const referenceId = readFileAsync(
    path.join(
      DATA,
      destination_stack_id,
      REFERENCES_DIR_NAME,
      REFERENCES_FILE_NAME
    )
  );
  const taxonomyId = readFileAsync(
    path.join(
      DATA,
      destination_stack_id,
      ENTRIES_DIR_NAME,
      TAXONOMY_DIR_NAME,
      TAXONOMY_FILE_NAME
    )
  );
  const entriesFolderPath = path.join(
    DATA,
    destination_stack_id,
    ENTRIES_DIR_NAME
  );
  const folderPath = path.join(entriesFolderPath, key, "en-us");

  await initialDirSetUp(folderPath, path.join(folderPath, "en-us.json"));
  let contentType: any =
    readFileAsync(path.join(folderPath, "en-us.json")) || "{}";

  const fieldNames = Object.keys(postsDetails[0]);
  const isoDate = new Date();
  const contentTypeQuery = MIGRATION_DATA_CONFIG["mysql-query"]["ct_mapped"];

  return new Promise((resolve, reject) => {
    connection.query(contentTypeQuery, async (error: any, rows: any) => {
      if (error) return reject(error);

      for (const row of rows) {
        const convDetails = unserialize(row.data);

        for (const data of postsDetails) {
          processPostData(
            data,
            convDetails,
            assetId,
            referenceId,
            taxonomyId,
            isoDate
          );
        }

        postsDetails.forEach((postDetail: any) => {
          const contentValue = createContentValue(postDetail, fieldNames);
          const contentKey = `content_type_entries_title_${postDetail.nid}`;
          contentType[contentKey] = contentValue;
        });
      }

      await writeFileAsync(path.join(folderPath, "en-us.json"), contentType, 4);
      resolve({ last: contentType });
    });
  });
}

// Processes individual post data fields
function processPostData(
  data: any,
  convDetails: any,
  assetId: any,
  referenceId: any,
  taxonomyId: any,
  isoDate: any
) {
  for (const [dataKey, value] of Object.entries(data)) {
    handleFieldData(
      data,
      dataKey,
      value,
      convDetails,
      assetId,
      referenceId,
      taxonomyId,
      isoDate
    );
  }
}

function handleFieldData(
  data: any,
  dataKey: any,
  value: any,
  convDetails: any,
  assetId: any,
  referenceId: any,
  taxonomyId: any,
  isoDate: any
) {
  // Handle different data field types here
  // e.g., file/image, reference, datetime/timestamp, boolean, comment, etc.
  if (convDetails.field_type === "file" || convDetails.field_type === "image") {
    if (
      dataKey === `${convDetails.field_name}_target_id` &&
      (convDetails.field_type === "file" || convDetails.field_type === "image")
    ) {
      if (
        `assets_${value}` in assetId &&
        dataKey === `${convDetails.field_name}_target_id` &&
        (convDetails.field_type === "file" ||
          convDetails.field_type === "image")
      ) {
        data[dataKey] = assetId[`assets_${value}`];
      } else {
        delete data[dataKey];
      }
    }
  }

  // for references
  if (convDetails.field_type === "entity_reference") {
    if (
      convDetails?.settings?.handler === "default:taxonomy_term" &&
      typeof value === "number" &&
      dataKey === `${convDetails.field_name}_target_id`
    ) {
      if (
        `taxonomy_${value}` in taxonomyId &&
        convDetails?.settings?.handler === "default:taxonomy_term" &&
        typeof value === "number"
      ) {
        data[dataKey] = [
          {
            uid: `taxonomy_${value}`,
            _content_type_uid: "taxonomy",
          },
        ];
      }
    }
    if (
      convDetails?.settings?.handler === "default:node" &&
      typeof value === "number" &&
      dataKey === `${convDetails.field_name}_target_id`
    ) {
      if (
        typeof value === "number" &&
        dataKey === `${convDetails.field_name}_target_id`
      ) {
        if (`content_type_entries_title_${value}` in referenceId) {
          data[dataKey] = [referenceId[`content_type_entries_title_${value}`]];
        }
      }
    }
  }

  // for datetime and timestamps
  if (
    convDetails.field_type === "datetime" ||
    convDetails.field_type === "timestamp"
  ) {
    if (`${convDetails.field_name}_value` === dataKey) {
      if (typeof value === "number") {
        const unixDate = new Date(value * 1000).toISOString();
        data[dataKey] = unixDate;
      } else {
        data[dataKey] = isoDate.toISOString(value);
      }
    }
  }

  if (convDetails.field_type === "boolean") {
    if (
      dataKey === `${convDetails.field_name}_value` &&
      typeof value === "number"
    ) {
      if (typeof value === "number" && value === 1) {
        data[dataKey] = true;
      } else if (typeof value === "number" && value === 0) {
        data[dataKey] = false;
      }
    }
  }

  if (convDetails.field_type === "comment") {
    if (
      dataKey === `${convDetails.field_name}_status` &&
      typeof value === "number"
    ) {
      data[dataKey] = `${value}`;
    }
  }

  if (value === null) {
    delete data[dataKey];
  }
}

function createContentValue(data: any, fieldNames: any) {
  const ctValue: any = {};
  let date;

  fieldNames.forEach((field: any) => {
    const isTaxonomyId = field.endsWith("_tid");
    const isUri = field.endsWith("_uri");
    const isValue = field.endsWith("_value");
    const isStatus = field.endsWith("_status");

    if (field === "created") {
      date = new Date(data[field] * 1000);
      ctValue[field] = date.toISOString();
    } else if (field === "uid_name") {
      ctValue[field] = [data[field]];
    } else if (isTaxonomyId) {
      ctValue[field] = [data[field]];
    } else if (field === "nid") {
      ctValue.uid = `content_type_entries_title_${data["nid"]}`;
    } else if (field === "langcode") {
      ctValue.locale = "en-us";
    } else if (isUri) {
      ctValue[field.replace("_uri", "")] = {
        title: data[field] || "",
        href: data[field] || "",
      };
    } else if (isValue) {
      if (/<\/?[a-z][\s\S]*>/i.test(data[field])) {
        const dom = new JSDOM(data[field]);
        const htmlDoc = dom.window.document.querySelector("body");
        const jsonValue = htmlToJson(htmlDoc);
        ctValue[field.replace("_value", "")] = jsonValue;
      } else {
        ctValue[field.replace("_value", "")] = data[field];
      }
    } else if (isStatus) {
      ctValue[field.replace("_status", "")] = data[field];
    } else {
      if (/<\/?[a-z][\s\S]*>/i.test(data[field])) {
        const dom = new JSDOM(data[field]);
        const htmlDoc = dom.window.document.querySelector("body");
        const jsonValue = htmlToJson(htmlDoc);
        ctValue[field] = jsonValue;
      } else {
        ctValue[field] = data[field];
      }
    }
  });

  return ctValue;
}

async function getQueryPost(pagename: any, skip: any, queryPageConfig: any) {
  const query = `${queryPageConfig["page"][pagename]} LIMIT ${skip}, ${postLimit}`;
  const connection = connect();
  return new Promise<void>((resolve, reject) => {
    connection.query(query, async (error: any, rows: any) => {
      if (error) return reject(error);

      if (rows.length > 0) {
        try {
          await putPosts(rows, pagename, connection);
          rows.forEach(async (row: any) => {
            const message = getLogMessage(
              "extractPosts",
              `info: Exporting entries for
              ${pagename}
              with uid
              ${row.nid}`,
              {}
            );
            await customLogger(
              project_id,
              destination_stack_id,
              "info",
              message
            );
          });
          resolve();
          connection.end();
        } catch (error) {
          reject(error);
          connection.end();
        }
      } else {
        const message = getLogMessage(
          "extractPosts",
          `no entries found for   ${pagename}`,
          {}
        );
        await customLogger(
          project_id,
          destination_stack_id,
          "info",
          message
        );      
        console.log("no entries found for", pagename);
        resolve();
        connection.end();
      }
    });
  });
}

async function getPageCountPost(pagename: any, queryPageConfig: any) {
  const query = queryPageConfig["count"][`${pagename}Count`];
  const connection = connect();
  return new Promise<void>((resolve, reject) => {
    connection.query(query, async (error: any, rowsCount: any) => {
      if (error) return reject(error);
      console.log("rowcount", rowsCount)
      console.log("total", rowsCount[0].countentry)

      const total = rowsCount[0].countentry;
      const pageTasks = [];

      for (let i = 0; i < total + postLimit; i += postLimit) {
        pageTasks.push(getQueryPost(pagename, i, queryPageConfig));
      }

      try {
        await Promise.all(pageTasks);
        resolve();
        connection.end();
      } catch (e) {
        reject(e);
        connection.end();
      }
    });
  });
}

// Starts the entire export process
async function extractPosts(destinationStackId: string, projectId: string) {
  console.log("Exporting entries...");
  destination_stack_id = destinationStackId;
  project_id = projectId;
  const message = getLogMessage("extractPosts", "exporting entries ", {});
  await customLogger(project_id, destination_stack_id, "info", message);
  const { DATA, QUERY_DIR_NAME, QUERY_FILE_NAME } = MIGRATION_DATA_CONFIG;
  const queryPageConfig = await readFileAsync(
    path.join(DATA, destinationStackId, QUERY_DIR_NAME, QUERY_FILE_NAME)
  );

  try {
    const pageNames = Object.keys(queryPageConfig.page);
    for (const key of pageNames) {
      console.log("@@@###########")
      console.log(key)
      
      await getPageCountPost(key, queryPageConfig);
      console.log("@@@###########")
    }
  } catch (error) {
    const message = getLogMessage(
      "extractPosts",
      "Error during exporting entries ",
      {}
    );
    await customLogger(project_id, destination_stack_id, "error", message);
    console.error("Error during export:", error);
  }
}

/************  page module functions start *********/

/************  Taxonomy module functions start *********/

async function putTaxonomy(categorydetails: any) {
  const vocabularyFolderPath = path.join(
    MIGRATION_DATA_CONFIG.DATA,
    destination_stack_id,
    MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME,
    MIGRATION_DATA_CONFIG.TAXONOMY_DIR_NAME
  );
  await initialDirSetUp(
    vocabularyFolderPath,
    path.join(vocabularyFolderPath, MIGRATION_DATA_CONFIG.TAXONOMY_FILE_NAME)
  );
  try {
    const categorydata = await readFileAsync(
      path.join(
        vocabularyFolderPath,
        MIGRATION_DATA_CONFIG.VOCABULARY_FILE_NAME
      )
    );

    categorydetails.forEach((data: any) => {
      const parent = data["parent"];
      let vocabularyRef = [
        {
          uid: `${data.vid}_${data.name
            .toLowerCase()
            .replace(/[^a-zA-Z0-9]/g, "_")}`,
          _content_type_uid: "vocabulary",
        },
      ];
      let taxonomyRef = [
        {
          uid: `taxonomy_${data["tid"]}`,
          _content_type_uid: "taxonomy",
        },
      ];

      let description = data["description"] || "";

      // Convert HTML description to JSON format (using JSDOM to parse HTML)
      const dom = new JSDOM(description.replace(/&amp;/g, "&"));
      const htmlDoc = dom.window.document.querySelector("body");
      const jsonValue = htmlToJson(htmlDoc);
      description = jsonValue;

      // Add the taxonomy data based on whether there is a parent
      if (parent !== 0 && parent !== undefined) {
        categorydata[`taxonomy_${data["tid"]}`] = {
          uid: `taxonomy_${data["tid"]}`,
          title: data["name"],
          description: description,
          vid: vocabularyRef,
          parent: taxonomyRef,
        };
      } else {
        categorydata[`taxonomy_${data["tid"]}`] = {
          uid: `taxonomy_${data["tid"]}`,
          title: data["name"],
          description: description,
          vid: vocabularyRef,
        };
      }
    });

    // Write the updated data back to the file
    await writeFileAsync(
      path.join(
        vocabularyFolderPath,
        MIGRATION_DATA_CONFIG.VOCABULARY_FILE_NAME
      ),
      categorydata,
      4
    );
  } catch (error) {
    console.error("Error in putTaxonomy:", error);
    throw error;
  }
}

async function getTaxonomyTermData(connection: any, skip: any) {
  const query = `${MIGRATION_DATA_CONFIG["mysql-query"]["taxonomy_term_data"]} limit ${skip}, ${refLimit}`;

  return new Promise<void>((resolve, reject) => {
    connection.connect();

    connection.query(query, async (error: any, rows: any) => {
      if (error) {
        console.error("Error retrieving taxonomy data:", error);
        connection.end();
        return reject(error);
      }

      if (rows.length > 0) {
        try {
          await putTaxonomy(rows);
          resolve();
        } catch (e) {
          console.error("Error in putTaxonomy:", e);
          reject(e);
        }
      } else {
        console.log("No taxonomy data found");
        resolve();
      }
    });
  });
}

async function getTaxonomyCount(connection: any, taxonomycount: any) {
  const tasks = [];
  for (let i = 0; i < taxonomycount; i += refLimit) {
    tasks.push(() => getTaxonomyTermData(connection, i));
  }

  try {
    await Promise.all(tasks.map((task) => task()));
  } catch (error) {
    console.error("Error in getTaxonomyCount:", error);
    throw error;
  }
}

async function extractTaxonomy(destinationStackId: string, projectId: string) {
  console.log("exporting Taxonomy");
  const connection = connect();
  destination_stack_id = destinationStackId;
  project_id = projectId;
  const message = getLogMessage("extractTaxonomy", "Exporting Taxonomy.", {});
  await customLogger(project_id, destination_stack_id, "info", message);
  try {
    connection.connect();

    const query = MIGRATION_DATA_CONFIG["mysql-query"]["taxonomyCount"];
    connection.query(query, async (error, rows: any) => {
      if (error) {
        console.error("Failed to get taxonomy count:", error);
        connection.end();
        throw error;
      }

      const taxonomycount = rows[0].taxonomycount;
      if (taxonomycount > 0) {
        await getTaxonomyCount(connection, taxonomycount);
        const message = getLogMessage(
          "extractTaxonomy",
          "exporting Taxonomy complete!!",
          {}
        );
        await customLogger(project_id, destination_stack_id, "info", message);
        console.log("exporting Taxonomy complete!!");
      } else {
        console.log("No taxonomy data found");
      }
      connection.end();
    });
  } catch (error) {
    const message = getLogMessage(
      "extractTaxonomy",
      "Error in exporting Taxonomy",
      {},
      error
    );
    await customLogger(project_id, destination_stack_id, "error", message);
    console.error("Error in start:", error);
    connection.end();
    throw error;
  }
}

/************  Taxonomy module functions END *********/

/************  Authors module functions start *********/

async function putAuthors(authordetails: any) {
  try {
    const assetIdRaw =
      (await fs.promises.readFile(
        path.join(
          MIGRATION_DATA_CONFIG.DATA,
          destination_stack_id,
          MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME,
          MIGRATION_DATA_CONFIG.ASSETS_FILE_NAME
        ),
        "utf-8"
      )) || "{}";

    const assetId = JSON.parse(assetIdRaw);
    let authordata: any = {};
    authordetails.forEach((data: any) => {
      console.log(data);
      if (data["name"] !== "") {
        const uid = `${data["uid"]}_${data["name"].toLowerCase()}`;
        let profileImage = assetId[`assets_${data["picture"]}`] || null;

        if (profileImage) {
          authordata[uid] = {
            uid: uid,
            title: data["name"],
            email: data["mail"],
            timezone: data["timezone"],
            admin_picture: profileImage,
          };
        } else {
          authordata[uid] = {
            uid: uid,
            title: data["name"],
            email: data["mail"],
            timezone: data["timezone"],
          };
        }
      }
    });

    const authorsFolderPath = path.resolve(
      MIGRATION_DATA_CONFIG.DATA,
      destination_stack_id,
      MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME,
      MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME,
      MIGRATION_DATA_CONFIG.AUTHORS_FILE_NAME
    );

    await writeFileAsync(authorsFolderPath, authordata, 4);
  } catch (error) {
    console.error("Failed to put authors:", error);
  }
}

function getAuthors(skip: any, connection: any) {
  return new Promise<void>((resolve, reject) => {
    const query = `${MIGRATION_DATA_CONFIG["mysql-query"]["authors"]} LIMIT ${skip}, ${refLimit}`;
    connection.query(query, (error: any, rows: any) => {
      if (error) {
        console.error("Error querying authors:", error);
        return reject(error);
      }

      if (rows.length > 0) {
        putAuthors(rows);
      }
      resolve();
    });
  });
}

async function getAllAuthors(userCount: any, connection: any) {
  const promises = [];
  for (let i = 0; i < userCount; i += refLimit) {
    promises.push(getAuthors(i, connection));
  }

  try {
    await Promise.all(promises);
  } catch (error) {
    const message = getLogMessage(
      "extractAuthors",
      "Failed to get all authors",
      {},
      error
    );
    await customLogger(project_id, destination_stack_id, "error", message);
    console.error("Failed to get all authors:", error);
  }
}

async function extractAuthors(destinationStackId: string, projectId: string) {
  destination_stack_id = destinationStackId;
  project_id = projectId;
  const authorsFolderPath = path.resolve(
    MIGRATION_DATA_CONFIG.DATA,
    destinationStackId,
    MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME,
    MIGRATION_DATA_CONFIG.AUTHORS_DIR_NAME
  );
  await initialDirSetUp(
    authorsFolderPath,
    path.join(authorsFolderPath, MIGRATION_DATA_CONFIG.AUTHORS_FILE_NAME)
  );
  const connection = connect();
  try {
    connection.connect();
    const query = MIGRATION_DATA_CONFIG["mysql-query"]["authorCount"];
    connection.query(query, async (error, rows: any) => {
      if (error) {
        console.error("Failed to get author count:", error);
        // connection.end();
        const message = getLogMessage(
          "extractAuthors",
          "Failed to get all authors",
          {},
          error
        );
        await customLogger(project_id, destination_stack_id, "error", message);
        return;
      }

      const userCount = rows[0]?.usercount || 0;
      if (userCount > 0) {
        await getAllAuthors(userCount, connection);
        const message = getLogMessage(
          "extractAuthors",
          "Exported Authors Successfully.",
          {}
        );
        await customLogger(project_id, destination_stack_id, "info", message);
      } else {
        console.log("No authors found.");
        connection.end();
      }
    });
  } catch (error) {
    console.error("Error during start:", error);
    connection.end();
  }
}

/************  Authors module functions start *********/

/************  Reference module functions start *********/

async function putPostsRef(postsdetails: any, key: any) {
  const { REFERENCES_DIR_NAME, REFERENCES_FILE_NAME } = MIGRATION_DATA_CONFIG;
  const referenceFilePath = path.join(
    MIGRATION_DATA_CONFIG.DATA,
    destination_stack_id,
    REFERENCES_DIR_NAME,
    REFERENCES_FILE_NAME
  );
  await initialDirSetUp(
    path.join(
      MIGRATION_DATA_CONFIG.DATA,
      destination_stack_id,
      REFERENCES_DIR_NAME
    ),
    referenceFilePath
  );

  let referenceData: any = await fs.promises.readFile(
    referenceFilePath,
    "utf-8"
  );
  referenceData = JSON.parse(referenceData);
  postsdetails.forEach((data: any) => {
    referenceData[`content_type_entries_title_${data.nid}`] = {
      uid: `content_type_entries_title_${data.nid}`,
      _content_type_uid: key,
    };
  });

  await writeFileAsync(referenceFilePath, referenceData, 4);
}

async function getQueryRef(
  connection: any,
  pagename: any,
  skip: any,
  queryPageConfig: any
) {
  const query = `${queryPageConfig["page"][pagename]} limit ${skip}, ${refLimit}`;

  return new Promise<void>((resolve, reject) => {
    connection.query(query, async (error: any, rows: any) => {
      if (error) {
        return reject(error);
      }

      if (rows.length > 0) {
        await putPostsRef(rows, pagename);
      }
      resolve();
    });
  });
}

async function getPageCount(
  connection: any,
  pagename: any,
  queryPageConfig: any
) {
  const total = 1;

  const tasks = [];
  for (let i = 0; i < total; i += refLimit) {
    tasks.push(() => getQueryRef(connection, pagename, i, queryPageConfig));
  }

  try {
    await Promise.all(tasks.map((task) => task()));
  } catch (error) {
    console.log(
      `something wrong while exporting references ${pagename}:`,
      error
    );
    connection.end();
    throw error;
  }
}

async function extractReferences(
  destinationStackId: string,
  projectId: string
) {
  const srcFunc = "extractReferences";
  const message = getLogMessage(srcFunc, "Exporting references...", {});
  await customLogger(projectId, destinationStackId, "info", message);
  project_id = projectId;
  destination_stack_id = destinationStackId;
  const { QUERY_DIR_NAME, QUERY_FILE_NAME } = MIGRATION_DATA_CONFIG;
  const connection = connect();
  const queryPageConfigRaw = await fs.promises.readFile(
    path.join(
      MIGRATION_DATA_CONFIG.DATA,
      destination_stack_id,
      QUERY_DIR_NAME,
      QUERY_FILE_NAME
    ),
    "utf-8"
  );
  const queryPageConfig = JSON.parse(queryPageConfigRaw);
  const pageQueries = queryPageConfig.page;

  const tasks = Object.keys(pageQueries).map(
    (pagename) => () => getPageCount(connection, pagename, queryPageConfig)
  );

  try {
    for (const task of tasks) {
      await task();
    }
    connection.end();
  } catch (error) {
    console.log("something went wrong while exporting references:", error);

    const message = getLogMessage(
      srcFunc,
      "something went wrong while exporting references:",
      {},
      error
    );
    await customLogger(projectId, destinationStackId, "error", message);
    connection.end();
    throw error;
  }
}
/************  Reference  module functions end *********/

/************  Vocabulary module functions start *********/

async function putVocabulary(vocabulary: any) {
  const vocabularyFolderPath = path.resolve(
    MIGRATION_DATA_CONFIG.DATA,
    destination_stack_id,
    MIGRATION_DATA_CONFIG.ENTRIES_DIR_NAME,
    MIGRATION_DATA_CONFIG.VOCABULARY_DIR_NAME,
    "en-us"
  );

  await initialDirSetUp(
    vocabularyFolderPath,
    path.join(vocabularyFolderPath, MIGRATION_DATA_CONFIG.VOCABULARY_FILE_NAME)
  ); //initialVocabularyDirSetUp(vocabularyFolderPath);
  const vocabularyData = await readFileAsync(
    path.join(vocabularyFolderPath, MIGRATION_DATA_CONFIG.VOCABULARY_FILE_NAME)
  );
  // const vocabularyData = JSON.parse(vocabularyDataRaw);

  vocabulary.forEach((data: any) => {
    let description = data["description"] || "";

    // Convert HTML RTE to JSON RTE
    const dom = new JSDOM(description.replace(/&amp;/g, "&"));
    const htmlDoc = dom.window.document.querySelector("body");
    const jsonValue = htmlToJson(htmlDoc);
    description = jsonValue;

    const uid = `${data.vid}_${data["title"]
      .toLowerCase()
      .replace(/[^a-zA-Z0-9]/g, "_")}`;
    vocabularyData[uid] = {
      uid,
      title: data["title"],
      description,
    };
  });

  await writeFileAsync(
    path.join(vocabularyFolderPath, MIGRATION_DATA_CONFIG.VOCABULARY_FILE_NAME),
    vocabularyData,
    4
  );
}

async function getAllVocabularies(connection: any, skip: number) {
  const query = `${MIGRATION_DATA_CONFIG["mysql-query"]["vocabulary"]} limit ${skip}, ${vocLimit}`;

  return new Promise<void>((resolve, reject) => {
    connection.query(query, (error: any, rows: any) => {
      if (error) {
        console.log("failed to get vocabulary: ", error);
        return reject(error);
      }

      if (rows.length > 0) {
        putVocabulary(rows);
      }
      resolve();
    });
  });
}

async function getVocabulariesCount(connection: any, vocabularycount: number) {
  const _getVocabularyTasks = [];
  for (let i = 0; i < vocabularycount; i += vocLimit) {
    _getVocabularyTasks.push(() => getAllVocabularies(connection, i));
  }

  try {
    await Promise.all(_getVocabularyTasks.map((task) => task()));
    connection.end();
  } catch (error) {
    const message = getLogMessage(
      "extractVocabulary",
      "something wrong while exporting vocabularies.",
      {},
      error
    );
    await customLogger(project_id, destination_stack_id, "error", message);
    console.log("something wrong while exporting vocabularies:", error);
    throw error;
  }
}

async function extractVocabulary(
  destinationStackId: string,
  projectId: string
) {
  const srcFunc = "extractVocabulary";
  console.log("Exporting vocabulary...");
  const message = getLogMessage(srcFunc, "Exporting vocabulary...", {});
  await customLogger(projectId, destinationStackId, "info", message);
  project_id = projectId;
  destination_stack_id = destinationStackId;

  const connection = connect();

  const query = MIGRATION_DATA_CONFIG["mysql-query"]["vocabularyCount"];
  const vocabularyCount: number = await new Promise((resolve, reject) => {
    connection.query(query, (error, rows: any) => {
      if (error) {
        console.log("failed to get vocabulary count: ", error);
        connection.end();
        return reject(error);
      }

      resolve(rows[0]["vocabularycount"]);
    });
  });

  if (vocabularyCount > 0) {
    await getVocabulariesCount(connection, vocabularyCount);

    const message = getLogMessage(
      srcFunc,
      "Exported vocabulary successfully",
      {}
    );
    await customLogger(projectId, destinationStackId, "info", message);
  } else {
    console.log("no vocabulary found");
    connection.end();
  }
}

/************  Vocabulary module functions ends *********/

/************  Assests module functions start *********/
// create initial dire and files for Assests
async function initialAssetsDirSetUp(destinationStackId: string) {
  logsFolderPath = path.resolve(
    MIGRATION_DATA_CONFIG.DATA,
    destinationStackId,
    "logs"
  );
  assetFolderPath = path.resolve(
    MIGRATION_DATA_CONFIG.DATA,
    destinationStackId,
    MIGRATION_DATA_CONFIG.ASSETS_DIR_NAME
  );

  assetFilePath = path.join(
    assetFolderPath,
    MIGRATION_DATA_CONFIG.ASSETS_FILE_NAME
  );

  // Create the logs directory if it doesn't exist
  try {
    await fs.promises.access(logsFolderPath);
  } catch {
    await fs.promises.mkdir(logsFolderPath, { recursive: true });
  }

  // Create the asset folder and asset.json if they don't exist
  try {
    await fs.promises.access(assetFolderPath);
  } catch {
    await fs.promises.mkdir(assetFolderPath, { recursive: true });
    await fs.promises.writeFile(assetFilePath, "{}");
  }
}

async function extractAssets(destinationStackId: string, projectId: string) {
  console.log("Exporting assets...");
  project_id = projectId;
  destination_stack_id = destinationStackId;
  const srcMethod = "extractAssets";
  const message = getLogMessage(srcMethod, `Exporting assets...`, {});
  await customLogger(project_id, destination_stack_id, "info", message);
  const connection = connect();
  const query = MIGRATION_DATA_CONFIG["mysql-query"]["assets"];
  await initialAssetsDirSetUp(destinationStackId);
  return new Promise<void>((resolve, reject) => {
    connection.connect();

    connection.query(query, async (error, rows: any[]) => {
      if (error) {
        connection.end();
        return reject(error);
      }

      try {
        if (rows.length > 0) {
          const tasks = rows.map((row) => saveAsset(row));

          await Promise.all(tasks); // Download all assets in parallel

          if (failedAssets.length > 0) {
            await retryFailedAssets(failedAssets); // Retry failed downloads
          }
          const message = getLogMessage(srcMethod, `All assets processed.`, {});
          await customLogger(project_id, destination_stack_id, "info", message);
          console.log("All assets processed.");
        } else {
          console.error("No assets found");
        }

        connection.end();
        resolve();
      } catch (err) {
        connection.end();
        reject(err);
      }
    });
  });
}

async function retryFailedAssets(assetIds: any) {
  if (assetIds.length === 0) return;

  const query = `${
    MIGRATION_DATA_CONFIG["mysql-query"]["assetsFID"]
  }(${assetIds.join()})`;
  const connection = connect();

  return new Promise<void>((resolve, reject) => {
    connection.connect();

    connection.query(query, async (error, rows: any[]) => {
      if (error) {
        connection.end();
        return reject(`Error querying assets for retry: ${error.message}`);
      }

      try {
        if (rows.length > 0) {
          const tasks = rows.map((row) => saveAsset(row)); // Save all assets in parallel

          await Promise.all(tasks); // Await the parallel tasks

          // Write updated asset and failed asset data to files
          await writeFileAsync(assetFilePath, assetData, 4);
          await writeFileAsync(
            path.join(logsFolderPath, "failed.json"),
            failedAssets,
            4
          );

          console.log("Retry for failed assets completed.");
        } else {
          console.error("No assets found for retry.");
        }

        connection.end();
        resolve(); 
      } catch (err) {
        connection.end();
        reject(`Error retrying failed assets: ${err}`); 
      }
    });
  });
}

async function saveAsset(assets: any) {
  const srcMethod = "extractAssets";

  let url = assets["uri"];
  try {
    const replaceValue =
      MIGRATION_DATA_CONFIG.BASE_URL + MIGRATION_DATA_CONFIG.PUBLIC_PATH;

    if (!url.startsWith("http")) {
      url = url
        .replace("public://", replaceValue)
        .replace("private://", replaceValue);
    }

    const name = assets["filename"];
    url = encodeURI(url);

    const assetDir = path.resolve(assetFolderPath, `assets_${assets["fid"]}`);
    const filePath = path.join(assetDir, name);

    if (fs.existsSync(filePath)) {
      return assets["fid"];
    } else {
      console.log(url);
      const response = await axios.get(url, { responseType: "arraybuffer" });

      await fs.promises.mkdir(assetDir, { recursive: true });
      await fs.promises.writeFile(filePath, response.data);

      assetData[`assets_${assets["fid"]}`] = {
        uid: `assets_${assets["fid"]}`,
        status: true,
        file_size: assets["filesize"],
        tag: [],
        filename: name,
        url: url,
        is_dir: false,
        parent_uid: null,
        _version: 1,
        title: name,
        publish_details: [],
      };

      if (failedAssets[`assets_${assets["fid"]}`]) {
        delete failedAssets[`assets_${assets["fid"]}`];
      }

      await writeFileAsync(assetFilePath, assetData, 4);
      const message = getLogMessage(
        srcMethod,
        `Successfully downloaded asset ${assets["fid"]} (${name})`,
        {}
      );
      await customLogger(project_id, destination_stack_id, "info", message);

      return `assets_${assets["fid"]}`;
    }
  } catch (error: any) {
    failedAssets[`assets_${assets["fid"]}`] = {
      failedUid: assets["fid"],
      name: assets["filename"],
      url: url,
      file_size: assets["filesize"],
      reason_for_error: error?.message,
    };

    await writeFileAsync(
      path.join(logsFolderPath, "failed.json"),
      failedAssets,
      4
    );
    console.error(
      `Failed to download asset ${assets["fid"]} (${assets["filename"]}): ${error}`
    );
    const message = getLogMessage(
      srcMethod,
      `Failed to download asset ${assets["fid"]} (${assets["filename"]})`,
      {},
      error
    );
    await customLogger(project_id, destination_stack_id, "error", message);

    if (!failedAssets.includes(`assets_${assets["fid"]}`)) {
      await retryFailedAssets([assets["fid"]]);
    }

    throw error;
  }
}

const moveAssets = async (folderNames: any, folderPath: string) => {
  let assetPath = path.join(folderPath, "files");
  try {
    await fs.promises.access(assetPath);
  } catch {
    await fs.promises.mkdir(assetPath, { recursive: true });
  }

  for (let i = 0; i < folderNames.length; i++) {
    let sourcePath = path.join(folderPath, folderNames[i]);
    let destinationPath = path.join(assetPath, folderNames[i]);
    fs.rename(sourcePath, destinationPath, (err) => {
      if (err) {
        console.error(`Error moving folder: ${err.message}`);
      } else {
        console.log("Folder moved successfully!");
      }
    });
  }
};

const createMetaData = async (assetData: any, folderPath: string) => {
  const assetValues = Object.values(assetData);
  const data = assetValues.map((item: any) => {
    return {
      uid: item.uid,
      url: item.url,
      filename: item.filename,
    };
  });
  await writeFileAsync(path.join(folderPath, "metadata.json"), data, 4);
};

const makeChunks = async (assetData: any) => {
  let currentChunkSize = 0;
  let currentChunkId = uuidv4();
  let chunks: any = {};
  for (
    let currentAssetId = 0;
    currentAssetId < Object.keys(assetData).length;
    currentAssetId += 1
  ) {
    let curAssetKey = Object.keys(assetData)[currentAssetId];

    let tempObj: any = {};
    tempObj[assetData[curAssetKey].uid] = assetData[curAssetKey];
    chunks[currentChunkId] = { ...chunks[currentChunkId], ...tempObj };

    currentChunkSize = Buffer.byteLength(
      JSON.stringify(chunks[currentChunkId]),
      "utf8"
    );

    if (currentChunkSize > chunkSize) {
      currentChunkId = uuidv4();
      currentChunkSize = 0;
      let tempObj: any = {};
      tempObj[assetData[curAssetKey].uid] = assetData[curAssetKey];
      chunks[currentChunkId] = tempObj;
    }
  }

  return chunks;
};

const renameFolder = async (oldFolderPath: string, newFolderPath: string) => {
  try {
    await fs.promises.rename(oldFolderPath, newFolderPath);
    console.log(`Folder renamed from ${oldFolderPath} to ${newFolderPath}`);
  } catch (error) {
    console.error(`Error renaming folder: ${error}`);
  }
};

const handleAssets = async (destinationStackId: string, projectId: string) => {
  console.log(`handlin assets!!!`);

  destination_stack_id = destinationStackId;
  const { DATA, ASSETS_DIR_NAME, ASSETS_FILE_NAME, ASSETS_SCHEMA_FILE } =
    MIGRATION_DATA_CONFIG;
  const assetDataFolderPath = path.join(
    DATA,
    destination_stack_id,
    ASSETS_DIR_NAME
  );
  const assetDataFilePath = path.join(assetDataFolderPath, ASSETS_FILE_NAME);
  const assetData = await readFileAsync(assetDataFilePath);

  const getAllAssetsEntries: any = await getAllFiles(assetDataFolderPath);
  console.log(`getAllAssetsEntries assets!!!`, getAllAssetsEntries.length);

  let indexFile: any = {};
  for (let i = 0; i < getAllAssetsEntries.length; i++) {
    let customID = idCorrector(uuidv4());
    let entryPath = getAllAssetsEntries[i];
    let content_type = entryPath.split("/").reverse()[1];
    if (content_type.startsWith("assets_")) {
      const asset = assetData[content_type];
      if (asset) {
        asset.uid = customID;
        asset.url = `/assets/${customID}`
        indexFile[customID] = asset;
      }
      await renameFolder(
        path.join(assetDataFolderPath, content_type),
        path.join(assetDataFolderPath, customID)
      );
    }
  }

  await writeFileAsync(
    path.join(DATA, destination_stack_id, ASSETS_DIR_NAME, ASSETS_SCHEMA_FILE),
    indexFile,
    4
  );

  let chunks = await makeChunks(indexFile);
  let refs: any = {};
  for (let i = 0; i < Object.keys(chunks).length; i++) {
    let chunkId = Object.keys(chunks)[i];
    refs[i + 1] = `${chunkId}-assets.json`;
    // refs[i + 1] = `index.json`;
    await writeFileAsync(
      path.join(
        DATA,
        destination_stack_id,
        ASSETS_DIR_NAME,
        `${chunkId}-assets.json`
      ),
      {
        ...chunks[chunkId],
      },
      4
    );
  }
  await writeFileAsync(
    path.join(DATA, destination_stack_id, ASSETS_DIR_NAME, ASSETS_FILE_NAME),
    refs,
    4
  );
  await createMetaData(indexFile, assetDataFolderPath);
  await moveAssets(Object.keys(indexFile), assetDataFolderPath);
};
/************  Assests module functions Ends *********/

/************  Locale module functions start *********/
// Ensure locale folder exists
async function initialLocaleDirSetUp(destinationStackId: string) {
  localeFolderPath = path.resolve(
    MIGRATION_DATA_CONFIG.DATA,
    destinationStackId,
    MIGRATION_DATA_CONFIG.LOCALE_DIR_NAME
  );
  try {
    await fs.promises.access(localeFolderPath);
  } catch {
    // Directory doesn't exist, create it
    await fs.promises.mkdir(localeFolderPath, { recursive: true });
    await fs.promises.writeFile(
      path.join(localeFolderPath, MIGRATION_DATA_CONFIG.LOCALE_FILE_NAME),
      "{}"
    );
    return;
  }
}

async function saveLocale(destinationStackId: string, projectId: string) {
  project_id = projectId;
  destination_stack_id = destinationStackId;
  const srcMethod = "saveLocale";
  const message = getLogMessage(srcMethod, `Creating locale file.`, {});
  await customLogger(project_id, destination_stack_id, "info", message);
  try {
    await initialLocaleDirSetUp(destinationStackId);
    const localeData =
      (await fs.promises.readFile(
        path.join(localeFolderPath, MIGRATION_DATA_CONFIG.LOCALE_FILE_NAME),
        "utf8"
      )) || "{}";
    const title = "locale_123";

    const localeJSON = JSON.parse(localeData);
    // Update locale JSON with the new locale data
    localeJSON[title] = {
      code: "en-us",
      name: "English - United States",
      fallback_locale: "",
      uid: `${title}`,
    };

    // Write updated locale JSON back to the file
    await writeFileAsync(
      path.join(localeFolderPath, MIGRATION_DATA_CONFIG.LOCALE_FILE_NAME),
      localeJSON,
      4
    );
    const message = getLogMessage(
      srcMethod,
      `Exported locale successfully`,
      {}
    );
    await customLogger(project_id, destination_stack_id, "info", message);
    return;
  } catch (error) {
    const message = getLogMessage(
      srcMethod,
      `Failed to save locale`,
      {},
      error
    );
    await customLogger(project_id, destination_stack_id, "error", message);
  }
}
/************  Locale module functions Ends *********/

/************  Query module functions Ends *********/
async function createQueryDirectoryAndFile(destinationStackId: string) {
  const queryFolderPath = path.resolve(
    MIGRATION_DATA_CONFIG.DATA,
    destinationStackId,
    MIGRATION_DATA_CONFIG.QUERY_DIR_NAME
  );

  try {
    try {
      await fs.promises.access(queryFolderPath);
    } catch (error) {
      await fs.promises.mkdir(queryFolderPath, { recursive: true });
      await fs.promises.writeFile(
        path.join(queryFolderPath, MIGRATION_DATA_CONFIG.QUERY_FILE_NAME),
        "{}"
      );
      return;
    }
  } catch (error) {
    console.error("Error in createQueryDirectoryAndFile:", error);
    return;
  }
}

// Function to get query based on provided data
async function getQuery(data1: any, connection: any) {
  const value = data1["field_name"];
  const handlerType = data1["content_handler"] || "invalid";
  const query = `SELECT *, '${handlerType}' as handler, '${data1["type"]}' as fieldType FROM node__${value}`;

  return new Promise((resolve, reject) => {
    connection.query(query, (error: any, rows: any, fields: any) => {
      if (error) return reject(error);

      const fdTable = fields.reduce((acc: any, field: any) => {
        const fieldName = field.name;
        if (
          fieldName.endsWith("_value") ||
          fieldName.endsWith("_fid") ||
          fieldName.endsWith("_tid") ||
          fieldName.endsWith("_status") ||
          fieldName.endsWith("_target_id") ||
          fieldName.endsWith("_uri")
        ) {
          return `node__${data1["field_name"]}.${fieldName}`;
        }

        return acc;
      }, null);
      console.log("fdTable", fdTable);
      resolve(fdTable);
    });
  });
}

async function putField(field: any, connection: any) {
  // const dir = path.join(process.cwd(), config.data, "query");
  const dir = path.join(
    MIGRATION_DATA_CONFIG.DATA,
    destination_stack_id,
    MIGRATION_DATA_CONFIG.QUERY_DIR_NAME
  );

  const select: any = {};
  const countQuery: any = {};
  const ct = Object.keys(_.keyBy(field, "content_types"));

  for (const data of ct) {
    const allKeys = _.filter(field, { content_types: data });
    const last = allKeys.map((data1) => `node__${data1["field_name"]}`);
    const queries = allKeys.map((data1) => getQuery(data1, connection));

    const result = await Promise.all(queries);

    const modifiedResult = result.map(
      (item: any) => `MAX(${item}) as ${item.split(".").pop()}`
    );
    // Construct the WHERE clause
    const joins = last.map(
      (key) => `LEFT JOIN ${key} ON ${key}.entity_id = node.nid`
    );
    joins.push("LEFT JOIN users ON users.uid = node.uid");
    const where = joins.join(" ");
    const type = `'${data}'`;
    // Ensure to always include the base fields for every type
    let baseQuery =
      "SELECT node.nid, MAX(node.title) AS title, MAX(node.langcode) AS langcode, MAX(node.created) as created, MAX(node.type) as type";
    // Add the modified results
    const resultDetail =
      modifiedResult.length > 0 ? `, ${modifiedResult.join(", ")}` : "";
    const queryData = `${baseQuery}${resultDetail} FROM node_field_data node ${where} WHERE node.type = ${type} GROUP BY node.nid`;

    const countPage = `SELECT count(distinct(node.nid)) as countentry FROM node_field_data node ${where} WHERE node.type = ${type}`;

    select[data] = queryData.replace(/,,/g, ",").replace(/, ,/g, ",");
    countQuery[`${data}Count`] = countPage;

    const main = { page: select, count: countQuery };
    await writeFileAsync(path.join(dir, "index.json"), main, 4);
  }
}

// Main function to start the extraction process
async function extractQuery(destinationStackId: string, projectId: string) {
  const srcFunc = "extractQuery";
  project_id = projectId;
  destination_stack_id = destinationStackId;
  await createQueryDirectoryAndFile(destinationStackId);
  const connection = connect();
  const detailsData: any[] = [];
  const query = MIGRATION_DATA_CONFIG["mysql-query"]["ct_mapped"];
  const message = getLogMessage(
    srcFunc,
    `Extraction of queries has begun.`,
    {}
  );
  await customLogger(projectId, destinationStackId, "info", message);
  return new Promise<void>((resolve, reject) => {
    connection.connect();

    connection.query(query, (error, rows: any[]) => {
      if (error) {
        connection.end();
        return reject(error);
      }

      rows.forEach((row) => {
        const convDetails: any = unserialize(row.data);
        detailsData.push({
          field_name: convDetails.field_name,
          content_types: convDetails.bundle,
          type: convDetails.field_type,
          content_handler: convDetails?.settings?.handler,
        });
      });

      if (detailsData.length > 0) {
        putField(detailsData, connection)
          .then(() => {
            connection.end();
            resolve();
          })
          .catch((err) => {
            connection.end();
            reject(err);
          });
      } else {
        connection.end();
        resolve();
      }
    });
  });
}
/************  Query module functions Ends *********/


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


export const drupalService = {
  extractQuery,
  saveLocale,
  extractAssets,
  extractVocabulary,
  extractReferences,
  extractAuthors,
  extractTaxonomy,
  extractPosts,
  handleAssets,
  handleEntries,
  createVersionFile
};
