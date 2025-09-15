export default {
  plan: {
    dropdown: { optionLimit: 100 }
  },
  cmsType: process.env.CMS_TYPE || 'drupal',
  isLocalPath: false,
  awsData: {
    awsRegion: 'us-east-2',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsSessionToken: '',
    bucketName: '',
    bucketKey: ''
  },
  isSQL: true,
  mysql: {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'riceuniversity1',
    port: '3306'
  },
  drupalAssetsUrl: {
    base_url: "",
    public_path: "",
  },
  localPath: process.env.CONTAINER_PATH || 'sql',
};