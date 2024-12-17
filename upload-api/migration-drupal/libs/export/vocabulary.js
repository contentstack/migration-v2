const mkdirp = require('mkdirp');
const path = require('path');
const fs = require('fs');
const { JSDOM } = require("jsdom");
const { htmlToJson } = require("@contentstack/json-rte-serializer");
/**
 * Internal module Dependencies.
 */
const helper = require("../utils/helper");
const { MIGRATION_DATA_CONFIG } = require('../../constants/index')

const vocabularyConfig = MIGRATION_DATA_CONFIG.modules.vocabulary;
const vocabularyFolderPath = path.resolve(
  MIGRATION_DATA_CONFIG.data,
  MIGRATION_DATA_CONFIG.entryfolder,
  vocabularyConfig.dirName
)
const limit = 100;

/**
 * Create folders and files
 */
if (!fs.existsSync(vocabularyFolderPath)) {
  mkdirp.sync(vocabularyFolderPath);
  helper.writeFile(path.join(vocabularyFolderPath, vocabularyConfig.fileName));
}

async function putVocabulary(vocabulary) {
  const vocabularyData = helper.readFile(
    path.join(vocabularyFolderPath, vocabularyConfig.fileName)
  );

  vocabulary.forEach((data) => {
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

  helper.writeFile(
    path.join(vocabularyFolderPath, "en-us.json"),
    JSON.stringify(vocabularyData, null, 4)
  );
}

async function getAllVocabularies(connection, skip) {
  const query = `${MIGRATION_DATA_CONFIG["mysql-query"]["vocabulary"]} limit ${skip}, ${limit}`;

  return new Promise((resolve, reject) => {
    connection.query(query, (error, rows) => {
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

async function getVocabulariesCount(connection, vocabularycount) {
  const _getVocabularyTasks = [];
  for (let i = 0; i < vocabularycount; i += limit) {
    _getVocabularyTasks.push(() => getAllVocabularies(connection, i));
  }

  try {
    await Promise.all(_getVocabularyTasks.map((task) => task()));
    connection.end();
  } catch (error) {
    console.log("something wrong while exporting vocabularies:", error);
    throw error;
  }
}

async function extractVocabulary(config) {
  console.log("Exporting vocabulary...");

  const connection = helper.connect(config?.mysql);

  const query = MIGRATION_DATA_CONFIG["mysql-query"]["vocabularyCount"];
  const vocabularyCount = await new Promise((resolve, reject) => {
    connection.query(query, (error, rows) => {
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
  } else {
    console.log("no vocabulary found");
    connection.end();
  }
}


module.exports = extractVocabulary;
