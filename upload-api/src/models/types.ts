export interface Config {
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
  localPath: string;
  isSQL: boolean;
  mysql: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: string;
  };
  drupalAssetsUrl: {
    base_url: string;
    public_path: string;
  };
}