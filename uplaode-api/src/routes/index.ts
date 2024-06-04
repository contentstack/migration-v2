import path from 'path';
import multer from 'multer';
import { Readable } from 'stream';
import express, { Router, Request, Response } from 'express';
import { createReadStream, createWriteStream } from 'fs';
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  UploadPartCommand
} from '@aws-sdk/client-s3';
import { client } from '../services/aws/client';
import { fileOperationLimiter } from '../helper';
import handleFileProcessing from '../services/fileProcessing';
import createSitecoreMapper from '../controllers/sitecore';
import config from '../config/index';

const router: Router = express.Router();
// Use memory storage to avoid saving the file locally
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Define your routes
router.post('/upload', upload.single('file'), async function (req: Request, res: Response) {
  try {
    //the object key for the S3 bucket
    const objectKey = `project/${req?.file?.originalname}`;

    if (req?.file?.buffer) {
      // Create a readable stream from the buffer
      const fileStream = new Readable();
      // Add file data to the stream
      fileStream.push(req.file.buffer);
      fileStream.push(null);
      console.info('🚀 ~ router.post ~ fileStream:', fileStream);

      //multipart upload session in S3
      const createMultipartUploadCommand = new CreateMultipartUploadCommand({
        Bucket: 'migartion-test',
        Key: objectKey
      });

      // Send the command to AWS S3 to initialize the multipart upload
      const { UploadId } = await client.send(createMultipartUploadCommand);
      // 10 MB chunk size (adjust as needed)
      const chunkSize = 10 * 1024 * 1024;
      let partNumber = 1;
      const partETags: any[] = [];

      while (true) {
        const chunk = fileStream.read(chunkSize);

        if (!chunk) {
          break;
        }
        //send a command to upload the current part to S3
        const uploadPartCommand = new UploadPartCommand({
          Bucket: 'migartion-test',
          Key: objectKey,
          UploadId,
          PartNumber: partNumber,
          Body: chunk
        });

        const { ETag } = await client.send(uploadPartCommand);
        partETags?.push({ ETag, PartNumber: partNumber });
        console.info(`Uploaded part ${partNumber} with ETag: ${ETag}`);
        partNumber++;
      }

      // After all parts are uploaded, complete the multipart upload
      const completeMultipartUploadCommand = new CompleteMultipartUploadCommand({
        Bucket: 'migartion-test',
        Key: objectKey,
        UploadId,
        MultipartUpload: {
          Parts: partETags
        }
      });

      // Send the command to finalize the upload
      await client.send(completeMultipartUploadCommand);
    }
    //successful upload
    res.send('file uplaoded sucessfully.');
  } catch (err) {
    console.error(err);
  }
});

// deepcode ignore NoRateLimitingForExpensiveWebOperation: <alredy implemetes>
router.get('/validator', express.json(), fileOperationLimiter, async function (req: Request, res: Response) {
  try {
    const projectId: string | string[] = req?.body?.projectId ?? "";
    const app_token: string | string[] = req?.headers?.app_token ?? "";
    const cmsType = config?.cmsType?.toLowerCase();

    if (config?.isLocalPath) {
      const fileName = config?.localPath?.split?.('/')?.pop?.();
      if (!fileName) {
        res.send('Filename could not be determined from the local path.');
      }

      if (fileName) {
        const name = fileName?.split?.('.')?.[0];
        const fileExt = fileName?.split('.')?.pop() ?? '';
        const bodyStream = createReadStream(config?.localPath);

        bodyStream.on('error', (error: any) => {
          console.error(error);
          return res.status(500).json({
            status: "error",
            message: "Error reading file.",
            file_details: config
          });
        });

        // Create a writable stream to save the downloaded zip file
        let zipBuffer = Buffer.alloc(0);

        // Collect the data from the stream into a buffer
        bodyStream.on('data', (chunk) => {
          if (!Buffer.isBuffer(chunk)) {
            throw new Error('Expected chunk to be a Buffer');
          } else {
            zipBuffer = Buffer.concat([zipBuffer, chunk]);
          }
        });

        //buffer fully stremd
        bodyStream.on('end', async () => {
          if (!zipBuffer) {
            throw new Error('No data collected from the stream.');
          }
          const data = await handleFileProcessing(fileExt, zipBuffer, cmsType);
          res.json(data);
          if (data?.status === 200) {
            const filePath = path.join(__dirname, '../../extracted_files', name);
            createSitecoreMapper(filePath, projectId, app_token)
          }
        });
        return;
      }
    } else {
      const params = {
        Bucket: config?.awsData?.bucketName,
        Key: config?.awsData?.buketKey
      };
      const getObjectCommand = new GetObjectCommand(params);
      // Get the object from S3
      const s3File = await client.send(getObjectCommand);
      //file Name From key
      const fileName = params?.Key?.split?.('/')?.pop?.() ?? '';
      //file ext from fileName
      const fileExt = fileName?.split?.('.')?.pop?.() ?? 'test';

      if (!s3File.Body) {
        throw new Error('Empty response body from S3');
      }

      const bodyStream: Readable = s3File.Body as Readable;

      // Create a writable stream to save the downloaded zip file
      const zipFileStream = createWriteStream(`${fileName}`);

      // // Pipe the S3 object's body to the writable stream
      bodyStream.pipe(zipFileStream);

      // Create a writable stream to save the downloaded zip file
      let zipBuffer: Buffer | null = null;

      // Collect the data from the stream into a buffer
      bodyStream.on('data', (chunk) => {
        if (zipBuffer === null) {
          zipBuffer = chunk;
        } else {
          zipBuffer = Buffer.concat([zipBuffer, chunk]);
        }
      });

      //buffer fully stremd
      bodyStream.on('end', async () => {
        if (!zipBuffer) {
          throw new Error('No data collected from the stream.');
        }

        const data = await handleFileProcessing(fileExt, zipBuffer, cmsType);
        res.json(data);
        res.send('file valited sucessfully.');
        const filePath = path.join(__dirname, '../../extracted_files', fileName);
        console.log("🚀 ~ bodyStream.on ~ filePath:", filePath)
        // createSitecoreMapper(filePath, projectId, app_token)
      });
    }

  } catch (err: any) {
    console.error('🚀 ~ router.get ~ err:', err);
  }
});

router.get('/config', async function (req: Request, res: Response) {
  res.json(config);
});

// Exported the router
export default router;
