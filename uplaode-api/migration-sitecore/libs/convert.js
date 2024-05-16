/**
 * External module Dependencies.
 */
/* eslint-disable @typescript-eslint/no-var-requires */
const mkdirp = require("mkdirp");
const path = require("path");
const fs = require("fs"),
const parseString = require("xml2js").parseString,
const read = require("fs-readdir-recursive");
/**
 * Internal module Dependencies.
 */
const helper = require("../utils/helper");
const config = {
  "data": "./sitecoreMigrationData",
  "backup": "./backupMigrationData",
  "xml_filename": "",
  "sitecore_folder": "",
  "json_file": "",
  "json_filename": "data.json",
  "table_prefix": "wp_",
  "entryfolder": "entries",
}
/**
 * Create folders and files if they are not created
 */



function ExtractFiles(sitecore_folder) {
  const xml_folder = read(sitecore_folder)
  if (!fs.existsSync(path.join(process.cwd(), config.data))) {
    mkdirp.sync(path.join(process.cwd(), config.data));
    for (let i = 0; i < xml_folder.length; i++) {
      const xml_data = `${sitecore_folder}/`.concat(xml_folder[i])
      const json_data = xml_data.replace('/xml', '')
      if (!fs.existsSync(path.resolve(json_data, config.json_filename))) {
        parseString(helper.readXMLFile(xml_data), { explicitArray: false }, function (err, result) {
          if (err) {
            console.error("failed to parse xml: ", err);
          } else {
            const filePath = path.join(json_data, config?.json_filename)
            fs.writeFileSync(`${filePath}.json`, JSON.stringify(result, null, 4), "utf-8");
          }
        })
      } else {
        fs.unlink(path.resolve(json_data, config.json_filename), (err) => {
          if (err) throw err;
        });
      }
    }
  } else {
    for (let i = 0; i < xml_folder.length; i++) {
      if (xml_folder?.[i]?.includes?.("/xml")) {
        const xml_data = `${sitecore_folder}/${xml_folder?.[i]}`
        const json_data = xml_data.replace('/xml', '')
        if (!fs.existsSync(path.resolve(json_data, config.json_filename))) {
          parseString(helper.readXMLFile(xml_data), { explicitArray: false }, function (err, result) {
            if (err) {
              console.error("failed to parse xml: ", err);
            } else {
              const filePath = path.join(json_data, config?.json_filename)
              fs.writeFileSync(filePath, JSON.stringify(result, null, 4), "utf-8");
            }
          })
        } else {
          fs.unlink(path.resolve(json_data, config.json_filename), (err) => {
            if (err) {
              console.log(err)
              throw err
            }
            console.log('File was deleted');
          });
        }
      }
    }
  }
}




module.exports = ExtractFiles;