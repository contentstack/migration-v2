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

const vocabularyConfig = MIGRATION_DATA_CONFIG.modules.taxonomy;
const vocabularyFolderPath = path.resolve(
    MIGRATION_DATA_CONFIG.data,
    MIGRATION_DATA_CONFIG.entryfolder,
    vocabularyConfig.dirName
  );
  const limit = 100;

/**
 * Create folders and files
 */

  if (!fs.existsSync(vocabularyFolderPath)) {
    mkdirp.sync(vocabularyFolderPath);
    helper.writeFile(path.join(vocabularyFolderPath, vocabularyConfig.fileName));
  }


async function putTaxonomy(categorydetails) {
  try {
    const categorydata = await helper.readFile(
      path.join(vocabularyFolderPath, vocabularyConfig.fileName)
    );

    categorydetails.forEach((data) => {
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
    await helper.writeFile(
      path.join(vocabularyFolderPath, vocabularyConfig.fileName),
      JSON.stringify(categorydata, null, 4)
    );
  } catch (error) {
    console.error('Error in putTaxonomy:', error);
    throw error;
  }
}

async function getTaxonomyTermData(connection, skip) {
  const query = `${MIGRATION_DATA_CONFIG["mysql-query"]["taxonomy_term_data"]} limit ${skip}, ${limit}`;

  return new Promise((resolve, reject) => {
    connection.connect(); 

    connection.query(query, async (error, rows) => {
      if (error) {
        console.error('Error retrieving taxonomy data:', error);
        connection.end();
        return reject(error);
      }

      if (rows.length > 0) {
        try {
          await putTaxonomy(rows);
          resolve();
        } catch (e) {
          console.error('Error in putTaxonomy:', e);
          reject(e);
        }
      } else {
        console.log('No taxonomy data found');
        resolve();
      }
      
    });
  });
}

async function getTaxonomyCount(connection, taxonomycount) {
  const tasks = [];
  for (let i = 0; i < taxonomycount; i += limit) {
    tasks.push(() => getTaxonomyTermData(connection, i));
  }

  try {
    await Promise.all(tasks.map(task => task()));
  } catch (error) {
    console.error('Error in getTaxonomyCount:', error);
    throw error;
  }
}

async function extractTaxonomy(config) {
  const connection = helper.connect(config?.mysql); 

  try {
    connection.connect();

    const query = MIGRATION_DATA_CONFIG["mysql-query"]["taxonomyCount"];
    connection.query(query, async (error, rows) => {
      if (error) {
        console.error('Failed to get taxonomy count:', error);
        connection.end();
        throw error;
      }

      const taxonomycount = rows[0].taxonomycount;
      if (taxonomycount > 0) {
        await getTaxonomyCount(connection, taxonomycount);
      } else {
        console.log('No taxonomy data found');
      }
      connection.end(); 
    });
  } catch (error) {
    console.error('Error in start:', error);
    connection.end();
    throw error;
  }
}
module.exports = extractTaxonomy;
