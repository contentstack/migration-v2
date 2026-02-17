export default {
  plan: {
    dropdown: { optionLimit: 100 }
  },
  cmsType: process.env.CMS_TYPE || 'cmsType',
  isLocalPath: true,
  awsData: {
    awsRegion: 'us-east-2',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsSessionToken: '',
    bucketName: '',
    bucketKey: ''
  },
  mysql: {
    host: 'host_name',
    user: 'user_name',
    password: '',
    database: 'database_name',
    port: 'port_number'
  },
  assetsConfig: {
    base_url: process.env.DRUPAL_ASSETS_BASE_URL || 'drupal_assets_base_url', // Dynamic: Can be any domain, with/without trailing slash
    public_path: process.env.DRUPAL_ASSETS_PUBLIC_PATH || 'drupal_assets_public_path' // Dynamic: Can be any path, with/without slashes
  },
  localPath: process.env.CONTAINER_PATH || 'localPath'
};
