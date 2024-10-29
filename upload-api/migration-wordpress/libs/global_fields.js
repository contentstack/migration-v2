const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

function extractGlobalFields() {
  const sourcePath = path.join(__dirname, '../');
  const destinationPath = path.join(process.cwd(), config.data);
  const foldersToCopy = ['locales', 'global_fields', 'extensions'];
  foldersToCopy.forEach((folder) => {
    const sourceFolderPath = `${sourcePath}/${folder}`;
    const destinationFolderPath = `${destinationPath}/${folder}`;

    try {
      fs.copySync(sourceFolderPath, destinationFolderPath);
      console.log(`Successfully created ${folder}`);
    } catch (err) {
      console.error(`Error copying ${folder}: ${err}`);
    }
  });
}

module.exports = extractGlobalFields;
