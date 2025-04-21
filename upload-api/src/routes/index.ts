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
import { dbConnect, fileOperationLimiter } from '../helper';
import handleFileProcessing from '../services/fileProcessing';
import config from '../config/index';
import createMapper from '../services/createMapper';

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
    res.send('file uploaded sucessfully.');
  } catch (err) {
    console.error(err);
  }
});

// deepcode ignore NoRateLimitingForExpensiveWebOperation: <alredy implemetes>
router.get(
  '/validator',
  express.json(),
  fileOperationLimiter,
  async function (req: Request, res: Response) {
    try {
      const projectId: string | string[] = req?.headers?.projectid ?? '';
      const app_token: string | string[] = req?.headers?.app_token ?? '';
      const affix: string | string[] = req?.headers?.affix ?? 'csm';
      const cmsType = config?.cmsType?.toLowerCase();

      if (config?.isLocalPath) {
        const fileName = path.basename(config?.localPath || '');
        //const fileName = config?.localPath?.replace(/\/$/, "")?.split?.('/')?.pop?.();

        if (!fileName) {
          res.send('Filename could not be determined from the local path.');
        }

        if (fileName) {
          const name = fileName?.split?.('.')?.[0];
          const fileExt = fileName?.split('.')?.pop() ?? '';

          if (fileExt.includes('sql')) {
            try {
              if (await dbConnect(config?.mysql)) {
                console.log('🚀 ~ drupal');
                const filePath = path.join(
                  __dirname,
                  '..',
                  '..',
                  'extracted_files',
                  'mysqlConfig.json'
                );
                createMapper(filePath, projectId, app_token, affix, config);
                res.status(200).send('drupal db validated sucessfully.');
              } else {
                console.log('🚀 ~ could not connect with db');
                return res.status(500).json({
                  status: 'error',
                  message: 'Error could not connect with db',
                  file_details: config
                });
              }
            } catch (error: any) {
              console.log('🚀 ~ could not connect with db', error);
              return res.status(500).json({
                status: 'error',
                message: 'Error could not connect with db',
                file_details: config
              });
            }
          } else {
            const bodyStream = createReadStream(config?.localPath);

        bodyStream.on('error', (error: any) => {
          console.error(error);
          return res.status(500).json({
            status: "error",
            message: "Error reading file.",
            file_details: config
          });
        });
        if (fileExt === 'xml') {
          let xmlData = '';

          // Collect the data from the stream as a string
          bodyStream.on('data', (chunk) => {
            if (typeof chunk !== 'string' && !Buffer.isBuffer(chunk)) {
              throw new Error('Expected chunk to be a string or a Buffer');
            } else {
              // Convert chunk to string (if it's a Buffer)
              xmlData += chunk.toString();
            }
          });

          // When the stream ends, process the XML data
          bodyStream.on('end', async () => {
            if (!xmlData) {
              throw new Error('No data collected from the stream.');
            }

            const data = await handleFileProcessing(fileExt, xmlData, cmsType, name);
            res.status(data?.status || 200).json(data);
            if (data?.status === 200) {
              const filePath = path.join(__dirname, '..', '..', 'extracted_files', `${name}.json`);
              createMapper(filePath, projectId, app_token, affix, config);
            }
          });
        }
        else {
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
            const data = await handleFileProcessing(fileExt, zipBuffer, cmsType, name);
            res.status(data?.status || 200).json(data);
            if (data?.status === 200) {
              const filePath = path.join(__dirname, '..', '..', 'extracted_files', name);
              createMapper(filePath, projectId, app_token, affix, config);
            }
          });
        }
      }
    } else {
      const params = {
        Bucket: config?.awsData?.bucketName,
        Key: config?.awsData?.bucketKey
      };
      const getObjectCommand = new GetObjectCommand(params);
      // Get the object from S3
      const s3File = await client.send(getObjectCommand);
      //file Name From key
      const fileName = params?.Key?.split?.('/')?.pop?.() ?? '';
      //file ext from fileName
      const fileExt = fileName?.split?.('.')?.pop?.() ?? 'test';

      if (!s3File?.Body) {
        throw new Error('Empty response body from S3');
      }

      const bodyStream: Readable = s3File?.Body as Readable;

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

        const data = await handleFileProcessing(fileExt, zipBuffer, cmsType, fileName);
        res.json(data);
        res.send('file valited sucessfully.');
        const filePath = path.join(__dirname, '..', '..', 'extracted_files', fileName);
        console.log("🚀 ~ bodyStream.on ~ filePath:", filePath)
        createMapper(filePath, projectId, app_token, affix, config);
      });
    }
  }
  catch (err: any) {
    console.error('🚀 ~ router.get ~ err:', err);
  }
);

router.get('/config', async function (req: Request, res: Response) {
  res.json(config);
});

// Exported the router
export default router;
