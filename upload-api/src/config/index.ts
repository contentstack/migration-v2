export default {
  plan: {
    dropdown: { optionLimit: 100 }
  },
  // CMS type configuration
  cmsType: process.env.CMS_TYPE || 'cmsType',
  isLocalPath: true,

  // AWS data configuration
  awsData: {
    awsRegion: 'us-east-2',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsSessionToken: '',
    bucketName: '',
    bucketKey: ''
  },

  // Drupal database configuration
  mysql: {
    host: process.env.MYSQL_HOST || 'host_name',
    user: process.env.MYSQL_USER || 'user_name',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'database_name',
    port: process.env.MYSQL_PORT || 'port_number'
  },

  // Drupal assets configuration
  assetsConfig: {
    base_url: process.env.DRUPAL_ASSETS_BASE_URL || 'drupal_assets_base_url',
    public_path: process.env.DRUPAL_ASSETS_PUBLIC_PATH || 'drupal_assets_public_path'
  },

  // Local path for the CMS data
  localPath: process.env.CMS_LOCAL_PATH || process.env.CONTAINER_PATH || 'your_local_cms_data_path',
};
