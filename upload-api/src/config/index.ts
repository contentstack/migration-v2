export default {
  plan: {
    dropdown: { optionLimit: 100 } // Defines the maximum number of dropdown options allowed. Default is 100.
  },

  // CMS Type
  cmsType: '', // Specifies the type of CMS being used, can be changed based on the project.

  // Local Path Indicator
  //   - If true, the migration files will be accessed from the local system.
  //   - If false, AWS S3 will be used for migration files.
  isLocalPath: true, // A boolean flag to determine if the provided path is local.

  // Local Path Configuration
  //   - Required when `isLocalPath` is true.
  //   - Example: '/upload-api/extracted_files/package 45.zip'
  localPath: '', // - The file path where extracted migration files are stored locally.

  // AWS Configuration (Optional)
  // - This is used only when `isLocalPath` is set to false
  //   and no package path is provided inside `localPath`.
  awsData: {
    awsRegion: '', // Specifies the AWS region. Default is 'us-east-2'.
    awsAccessKeyId: '', // The access key ID for AWS authentication.
    awsSecretAccessKey: '', // The secret access key for AWS authentication.
    awsSessionToken: '', // The session token used for temporary AWS authentication.
    bucketName: '', // The name of the AWS S3 bucket used for storing migration files. Default is 'migration-test'.
    bucketKey: '' // The specific key (file path) within the S3 bucket. Default is 'project/package 45.zip'.
  }
};
