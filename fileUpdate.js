const fs = require('fs');
const path = require('path');
const { cliux, messageHandler } = require('@contentstack/cli-utilities');
const isEmpty = (value) => value === null || value === undefined ||
  (typeof value === 'object' && Object.keys(value).length === 0) ||
  (typeof value === 'string' && value.trim().length === 0);;
const config = {
  plan: {
    dropdown: { optionLimit: 100 }
  },
  cmsType: null,
  isLocalPath: true,
  awsData: {
    awsRegion: 'us-east-2',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsSessionToken: '',
    bucketName: 'migartion-test',
    buketKey: 'project/package 45.zip'
  },
  localPath: null
};

const configFilePath = path.resolve(path?.join?.('upload-api', 'src', 'config', 'index.ts'));

const ensureDirectoryExists = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('📂 Created missing directory:', dir);
  }
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

const typeSwitcher = async (type) => {
  switch (type) {
    case 'Aws S3': {
      const awsData = {
        awsRegion: await cliux.inquire({
          type: 'input',
          message: 'Enter AWS Region',
          name: 'awsRegion',
          validate: inquireRequireFieldValidation
        }),
        awsAccessKeyId: await cliux.inquire({
          type: 'input',
          message: 'Enter AWS Access Key Id',
          name: 'awsAccessKeyId',
          validate: inquireRequireFieldValidation
        }),
        awsSecretAccessKey: await cliux.inquire({
          type: 'input',
          message: 'Enter AWS Secret Access Key',
          name: 'awsSecretAccessKey',
          validate: inquireRequireFieldValidation
        }),
      };
      const isSessionToken = await cliux.inquire({
        choices: ['yes', 'no'],
        type: 'list',
        name: 'isSessionToken',
        message: 'Do you have a Session Token?'
      });
      if (isSessionToken === 'yes') {
        awsData.awsSessionToken = await cliux.inquire({
          type: 'input',
          message: 'Enter AWS Session Token',
          name: 'awsSessionToken',
          validate: inquireRequireFieldValidation
        });
      }
      return awsData;
    }
    case 'Locale Path': {
      return await cliux.inquire({
        type: 'input',
        message: 'Enter file path',
        name: 'filePath',
        validate: inquireRequireFieldValidation
      });
    }
    default:
      console.log('⚠️ Invalid type provided');
      return;
  }
};

const XMLMigration = async () => {
  const typeOfcms = await cliux.inquire({
    choices: ['sitecore', 'contentful'],
    type: 'list',
    name: 'value',
    message: 'Choose the option to proceed'
  });

  const data = await typeSwitcher('Locale Path');
  if (typeof typeOfcms === 'string') {
    config.cmsType = typeOfcms;
  } else {
    console.log('⚠️ Error: Expected a string for typeOfcms but got an object.');
  }
  if (typeof data === 'string') {
    config.localPath = data;
  } else {
    console.log('⚠️ Error: Expected a string for localPath but got an object.');
  }
  ensureDirectoryExists(configFilePath);
  fs.writeFileSync(configFilePath, `export default ${JSON.stringify(config, null, 2)};`, 'utf8');
};

XMLMigration();
