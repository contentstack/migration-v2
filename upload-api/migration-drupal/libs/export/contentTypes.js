const mkdirp = require('mkdirp');
const path = require('path');
const fs = require('fs');
const _ = require("lodash");
const phpUnserialize = require("phpunserialize");

const chalk = require("chalk");

/**
 * Internal module Dependencies.
 */
const helper = require("../utils/helper");

//const contenttypesConfig = config.modules.contentTypes;
const contenttypesConfig = {
  "dirName": "content_types",
  "fileName": "contenttype.json",
  "masterfile": "contenttypes.json",
  "schemaFile": "schema.json",
  "validKeys": [
    "title",
    "uid",
    "schema",
    "options",        
    "description"
  ]
};

const { MIGRATION_DATA_CONFIG } = require('../../constants/index')

const contentTypesFolderPath = path.resolve(
  "./cmsMigrationData",
  contenttypesConfig.dirName
);

const validKeys = contenttypesConfig.validKeys;
/**
 * Create folders and files
 */
mkdirp.sync(contentTypesFolderPath);

if (!fs.existsSync(contentTypesFolderPath)) {
  mkdirp.sync(contentTypesFolderPath);
  helper.writeFile(
    path.join(contentTypesFolderPath, contenttypesConfig.fileName)
  );
}

const { drupalMapper } = require("./contentstackMapper");


async function extractContentTypes(config) {
  console.log("Exporting content-types...");
  
  try {
    await getContentTypes(config);
    console.log("Updated priority and reference/file field of Content Types.");
  } catch (error) {
    console.log("error in extractContentTypes",error);
  }
}

async function getContentTypes(config) {
  const connection = helper.connect(config?.mysql); 
  const detailsData = [];

  return new Promise((resolve, reject) => {
    const query = MIGRATION_DATA_CONFIG["mysql-query"]["ct_mapped"];
    
    connection.query(query, async (error, rows) => {
      if (error) {
        connection.end();
        return reject(error);
      }

      rows.forEach(row => {
        const convDetails = phpUnserialize(row.data);
        detailsData.push({
          field_label: convDetails?.label,
          description: convDetails?.description,
          field_name: convDetails?.field_name,
          content_types: convDetails?.bundle,
          type: convDetails?.field_type,
          handler: convDetails?.settings?.handler,
          reference: convDetails?.settings?.handler_settings?.target_bundles,
          min: convDetails?.settings?.min,
          max: convDetails?.settings?.max,
          default_value: convDetails?.default_value[0]?.value,
        });
      });

      if (detailsData.length > 0) {
        await putContentTypes(detailsData, rows.length);
      }
      connection.end();
      resolve();
    });
  });
}

async function putContentTypes(contentDetails, contentTypeCount) {
  const contentTypes = [];
  const uniqueContentTypes = Object.keys(_.keyBy(contentDetails, "content_types"));

  uniqueContentTypes.forEach((data) => {
    const allKeys = _.filter(contentDetails, { content_types: data });
    const schema = [...drupalMapper(allKeys, uniqueContentTypes)];
    const contentTypeTitle = data.split("_").join(" ");
    
    const main = {
      title: contentTypeTitle,
      uid: data,
      schema,
      description: `Schema for ${contentTypeTitle}`,
      options: {
        is_page: true,
        singleton: false,
        sub_title: [],
        title: `title`,
        url_pattern: "/:title",
        url_prefix: `/${contentTypeTitle.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase()}/`,
      },
    };
    contentTypes.push(main);
  });

  const entry = { content_types: contentTypes };

  await putField(entry, contentTypes.length);
}

async function putField(entry, count) {
  const authors = helper.readFile(path.join(__dirname, "../authors.json"));
  const taxonomy = helper.readFile(path.join(__dirname, "../taxonomy.json"));
  const vocabulary = helper.readFile(path.join(__dirname, "../vocabulary.json"));

  helper.writeFile(path.join(contentTypesFolderPath, "taxonomy.json"), JSON.stringify(taxonomy, null, 4));
  helper.writeFile(path.join(contentTypesFolderPath, "vocabulary.json"), JSON.stringify(vocabulary, null, 4));
  helper.writeFile(path.join(contentTypesFolderPath, "authors.json"), JSON.stringify(authors, null, 4));
  
  entry.content_types.unshift(authors, vocabulary, taxonomy);
  const totalCount = count + 3;

  const schema = []
  for (let i = 0; i < totalCount; i++) {
    const contentType = {};  

   validKeys.forEach((key) => {
      contentType[key] = entry.content_types[i][key];
    });
    schema.push(contentType)
    helper.writeFile(
      path.join(contentTypesFolderPath, `${contentType["uid"]}.json`),
      JSON.stringify(contentType, null, 4)
    );
    console.log("ContentType", chalk.green(`${contentType["uid"]}`), "created successfully");
  }
  await helper.writeFileAsync(
    path.join(contentTypesFolderPath, contenttypesConfig.schemaFile), schema, 4  );
}


module.exports = extractContentTypes
