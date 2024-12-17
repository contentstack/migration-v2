export default {
  plan: {
    dropdown: { optionLimit: 100 }
  },
  cmsType: 'Drupal',
  isLocalPath: true,
  awsData: {
    awsRegion: 'us-east-2',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsSessionToken: '',
    bucketName: 'migartion-test',
    buketKey: 'project/package 45.zip'
  },
  mysql: {
    host: '127.0.0.1',
    user: 'drupaluser',
    password: 'root',
    database: 'drupaldb'
  },
  localPath: 'sql' //package 45.zip' test.sql '/home/gaurishn/Documents/contentstack/package 45.sql' //
  // localPath: '/Users/umesh.more/Documents/ui-migration/migration-v2-node-server/upload-api/extracted_files/package 45.zip'
};
