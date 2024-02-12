import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config";

const S3 = new S3Client({
  region: config.AWS_REGION,
  useAccelerateEndpoint: true,
});

export const initialize = async (
  region: string,
  orgId: string,
  userId: string,
  projectId: string,
  fileName: string
) =>
  S3.send(
    new CreateMultipartUploadCommand({
      Bucket: config.UPLOAD_BUCKET,
      Key: `${region}/${orgId}_${userId}/${projectId}/${fileName}`,
    })
  );

export const preSignedUrls = async (
  fileKey: string,
  fileId: string,
  parts: number
) =>
  (
    await Promise.all(
      Array.from({ length: parts }, (_: any, i: number) => i + 1).map(
        (i: number) =>
          getSignedUrl(
            S3,
            new UploadPartCommand({
              Bucket: config.UPLOAD_BUCKET,
              Key: fileKey,
              UploadId: fileId,
              PartNumber: i,
            }),
            { expiresIn: config.UPLOAD_URL_EXPIRES }
          )
      )
    )
  ).map((url: string, i: number) => ({
    signedUrl: url,
    PartNumber: i + 1,
  }));

export const finalize = async (fileKey: string, fileId: string, parts: any[]) =>
  S3.send(
    new CompleteMultipartUploadCommand({
      Bucket: config.UPLOAD_BUCKET,
      Key: fileKey,
      UploadId: fileId,
      MultipartUpload: {
        Parts: [...parts].sort(
          (p1: any, p2: any) => p1.PartNumber - p2.PartNumber
        ),
      },
    })
  );
