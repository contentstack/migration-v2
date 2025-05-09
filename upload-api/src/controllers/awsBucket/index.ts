import { Readable } from 'stream';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { client } from '../../services/aws/client';

async function getBuketObject(params: { Key: string; Bucket: string }) {
  const getObjectCommand = new GetObjectCommand(params);
  // Get the object from S3
  const s3File = await client.send(getObjectCommand);
  if (!s3File.Body) {
    throw new Error('Empty response body from S3');
  }
  // Pipe the S3 object's body to the writable stream
  return s3File.Body as Readable;
}

export default getBuketObject;
