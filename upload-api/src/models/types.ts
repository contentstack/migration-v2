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
      buketKey: string;
    };
    localPath: string;
  }