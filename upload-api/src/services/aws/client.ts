import { S3Client } from '@aws-sdk/client-s3';
import config from '../../config';

interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

interface S3ClientConfig {
  region: string;
  credentials: AWSCredentials;
}
//process.env.AWS_REGION ??
//process.env.AWS_ACCESS_KEY_ID ??
//process.env.AWS_SECRET_ACCESS_KEY ??
//process.env.AWS_SESSION_TOKEN ??
const clientConfig: S3ClientConfig = {
  region: config?.awsData?.awsRegion,
  credentials: {
    accessKeyId: config?.awsData?.awsAccessKeyId,
    secretAccessKey: config?.awsData?.awsSecretAccessKey,
    sessionToken: config?.awsData?.awsSessionToken
  }
};

// This relies on a Region being set up in your local AWS config.
const client = new S3Client(clientConfig);

export { client };
