import { cliux, messageHandler } from '@contentstack/cli-utilities';
import isEmpty from "lodash.isempty";


const migFunction = () => {
  console.log("test");
}

function inquireRequireFieldValidation(input: any): string | boolean {
  if (isEmpty(input)) {
    return messageHandler.parse('please entre the path');
  }
  return true;
}

async function typeSwitcher(type: any) {
  switch (type) {
    case "Aws S3": {
      const awsData: {
        awsRegion?: string;
        awsAccessKeyId?: string;
        awsSecretAccessKey?: string;
        isSessionToken?: string;
        awsSessionToken?: string;
      } = {}
      awsData.awsRegion = await cliux.inquire<string>({
        type: 'input',
        message: 'Entre the Aws Region',
        name: 'awsRegion',
        validate: inquireRequireFieldValidation
      });
      awsData.awsAccessKeyId = await cliux.inquire<string>({
        type: 'input',
        message: 'Entre the Aws Access Key Id',
        name: 'awsAccessKeyId',
        validate: inquireRequireFieldValidation
      });
      awsData.awsSecretAccessKey = await cliux.inquire<string>({
        type: 'input',
        message: 'Entre the Aws Secret Access Key',
        name: 'awsSecretAccessKey',
        validate: inquireRequireFieldValidation
      });
      awsData.isSessionToken = await cliux.inquire({
        choices: [
          'yes',
          'no',
        ],
        type: 'list',
        name: 'isSessionToken',
        message: 'Do you have Session Token',
      })
      if (awsData?.isSessionToken === "yes") {
        awsData.awsSessionToken = await cliux.inquire<string>({
          type: 'input',
          message: 'Entre the Aws Session Token',
          name: 'awsSessionToken',
          validate: inquireRequireFieldValidation
        });
      }
      return awsData;
    }
    case "Locale Path": {
      return await cliux.inquire<string>({
        type: 'input',
        message: 'Entre the file path',
        name: 'filePath',
        validate: inquireRequireFieldValidation
      });
    }
    default:
      return;
  }
}


async function XMLMigration() {
  const typeOfImport = await cliux.inquire({
    choices: [
      'Aws S3',
      'Locale Path',
      'Exit',
    ],
    type: 'list',
    name: 'value',
    message: 'Choose the option to proceed',
  });
  const data = await typeSwitcher(typeOfImport);
  console.log("🚀 ~ XMLMigration ~ data:", data)
}


// calling  the function 
XMLMigration()
