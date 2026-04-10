import configData from './index.json';

interface Config {
  plan: {
    dropdown: {
      optionLimit: number;
    };
  };
  cmsType: string;
  isLocalPath: boolean;
  awsData: {
    awsRegion: string;
    awsAccessKeyId: string;
    awsSecretAccessKey: string;
    awsSessionToken: string;
    bucketName: string;
    bucketKey: string;
  };
  mysql: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: string;
  };
  assetsConfig: {
    base_url: string;
    public_path: string;
  };
  localPath: string;
}

// Create config object with environment variable overrides
const config: Config = {
  ...configData,
  cmsType: process.env.CMS_TYPE || configData.cmsType,
  localPath: process.env.CONTAINER_PATH || configData.localPath,
  assetsConfig: {
    ...configData.assetsConfig,
    base_url: process.env.DRUPAL_ASSETS_BASE_URL || configData.assetsConfig.base_url,
    public_path: process.env.DRUPAL_ASSETS_PUBLIC_PATH || configData.assetsConfig.public_path,
  },
  mysql: {
    ...configData.mysql,
    host: process.env.MYSQL_HOST || configData.mysql.host,
    user: process.env.MYSQL_USER || configData.mysql.user,
    password: process.env.MYSQL_PASSWORD || configData.mysql.password,
    database: process.env.MYSQL_DATABASE || configData.mysql.database,
    port: process.env.MYSQL_PORT || configData.mysql.port,
  },
};

export default config;