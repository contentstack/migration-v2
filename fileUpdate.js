const fs = require('fs');
const path = require('path');
const { cliux, messageHandler } = require('@contentstack/cli-utilities');

const isEmpty = (value) => value === null || value === undefined ||
  (typeof value === 'object' && Object.keys(value).length === 0) ||
  (typeof value === 'string' && value.trim().length === 0);

const envFilePath = path.resolve(path.join('upload-api', '.env'));

const ensureDirectoryExists = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('📂 Created missing directory:', dir);
  }
};

const readEnvFile = () => {
  const vars = {};
  if (fs.existsSync(envFilePath)) {
    const content = fs.readFileSync(envFilePath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          vars[trimmed.substring(0, eqIndex)] = trimmed.substring(eqIndex + 1);
        }
      }
    }
  }
  return vars;
};

const writeEnvFile = (newVars) => {
  ensureDirectoryExists(envFilePath);
  const existing = readEnvFile();
  const merged = { ...existing, ...newVars };
  const lines = Object.entries(merged).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(envFilePath, lines.join('\n') + '\n', 'utf8');
};

const inquireRequireFieldValidation = (input) => {
  if (isEmpty(input)) {
    return messageHandler.parse('Please enter the path');
  }
  if (!fs.existsSync(input)) {
    return messageHandler.parse('The specified path does not exist. Please enter a valid path.');
  }
  return true;
};

const XMLMigration = async () => {
  const typeOfcms = await cliux.inquire({
    choices: ['sitecore', 'contentful', 'wordpress', 'aem', 'drupal'],
    type: 'list',
    name: 'value',
    message: 'Choose the option to proceed with your legacy CMS:'
  });

  if (typeof typeOfcms !== 'string') {
    console.log('⚠️ Error: Expected a string for typeOfcms but got an object.');
    return;
  }

  const envVars = { CMS_TYPE: typeOfcms };

  if (typeOfcms === 'drupal') {
    console.log('\nDrupal uses a MySQL database connection. Please provide your database details:');

    envVars.MYSQL_HOST = await cliux.inquire({
      type: 'input',
      message: 'Enter MySQL Host',
      name: 'mysqlHost',
      validate: (input) => isEmpty(input) ? 'Please enter the MySQL host' : true
    });
    envVars.MYSQL_USER = await cliux.inquire({
      type: 'input',
      message: 'Enter MySQL User',
      name: 'mysqlUser',
      validate: (input) => isEmpty(input) ? 'Please enter the MySQL user' : true
    });
    envVars.MYSQL_PASSWORD = await cliux.inquire({
      type: 'password',
      message: 'Enter MySQL Password (can be empty)',
      name: 'mysqlPassword'
    });
    envVars.MYSQL_DATABASE = await cliux.inquire({
      type: 'input',
      message: 'Enter MySQL Database Name',
      name: 'mysqlDatabase',
      validate: (input) => isEmpty(input) ? 'Please enter the MySQL database name' : true
    });
    const portInput = await cliux.inquire({
      type: 'input',
      message: 'Enter MySQL Port [3306]',
      name: 'mysqlPort'
    });
    envVars.MYSQL_PORT = portInput || '3306';

    envVars.DRUPAL_ASSETS_BASE_URL = await cliux.inquire({
      type: 'input',
      message: 'Enter Drupal Assets Base URL (e.g. https://example.com)',
      name: 'assetsBaseUrl'
    });
    envVars.DRUPAL_ASSETS_PUBLIC_PATH = await cliux.inquire({
      type: 'input',
      message: 'Enter Drupal Assets Public Path (e.g. sites/default/files)',
      name: 'assetsPublicPath'
    });

    envVars.CMS_LOCAL_PATH = 'sql';
  } else {
    const localPath = await cliux.inquire({
      type: 'input',
      message: 'Enter file path',
      name: 'filePath',
      validate: inquireRequireFieldValidation
    });
    if (typeof localPath === 'string') {
      envVars.CMS_LOCAL_PATH = localPath;
    } else {
      console.log('⚠️ Error: Expected a string for localPath but got an object.');
      return;
    }
  }

  writeEnvFile(envVars);
  console.log(`✅ Configuration written to ${envFilePath}`);
};

XMLMigration();
