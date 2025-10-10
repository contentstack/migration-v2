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
  assetsConfig: {
    base_url: process.env.DRUPAL_ASSETS_BASE_URL || 'https://www.rice.edu/', // Dynamic: Can be any domain, with/without trailing slash
    public_path: process.env.DRUPAL_ASSETS_PUBLIC_PATH || 'sites/g/files/bxs2566/files' // Dynamic: Can be any path, with/without slashes
  },
  localPath: process.env.CONTAINER_PATH || 'sql'
};
