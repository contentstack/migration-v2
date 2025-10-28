import path from 'path';
import multer from 'multer';
import { Readable } from 'stream';
import express, { Router, Request, Response } from 'express';
import { createReadStream, createWriteStream, statSync } from 'fs';
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  UploadPartCommand
} from '@aws-sdk/client-s3';
import { client } from '../services/aws/client';
import { fileOperationLimiter, getDbConnection } from '../helper';
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

      console.log('=== VALIDATOR REQUEST DEBUG ===');
      console.log('CMS Type:', cmsType);
      console.log('config.isLocalPath:', config?.isLocalPath);
      console.log('config.isSQL:', config?.isSQL);
      console.log('config.localPath:', config?.localPath);
      console.log('');
      console.log('=== LOGIC FLOW ===');
      console.log(
        'Priority 1: isLocalPath =',
        config?.isLocalPath,
        '→',
        config?.isLocalPath ? 'USE LOCAL PATH (file or folder)' : 'Skip to next check'
      );
      if (!config?.isLocalPath) {
        console.log(
          'Priority 2: isSQL =',
          config?.isSQL,
          '→',
          config?.isSQL ? 'USE SQL CONNECTION' : 'USE AWS S3'
        );
      }
      console.log('');

      if (config?.isLocalPath) {
        console.log('✓ Using LOCAL PATH mode');
        console.log('  Ignoring isSQL and AWS settings...');
        console.log('');
        const localPath = config?.localPath || '';

        // Check if the path is a directory or file
        let isDirectory = false;
        try {
          const stats = statSync(localPath);
          isDirectory = stats.isDirectory();
          console.log('Path is directory:', isDirectory);
        } catch (error) {
          console.error('Error accessing local path:', error);
          return res.status(500).json({
            status: 'error',
            message: 'Error accessing local path.',
            file_details: config
          });
        }

        // Handle directory paths (e.g., for AEM folder structure)
        if (isDirectory) {
          const fileExt = 'folder';
          const name = path.basename(localPath);

          console.log('Processing as folder - fileExt:', fileExt, 'name:', name);

          // For folders, pass the directory path directly to the validator
          const data = await handleFileProcessing(fileExt, localPath, cmsType, name);

          console.log('📤 ROUTES - Folder validation result received from handleFileProcessing:');
          console.log('  data.file_details.isSQL:', data?.file_details?.isSQL);
          console.log('  data.file_details.isLocalPath:', data?.file_details?.isLocalPath);
          console.log('  data.file_details.cmsType:', data?.file_details?.cmsType);
          console.log('');
          console.log('📦 SENDING RESPONSE TO UI:');
          console.log('  ✓ Status:', data?.status || 200);
          console.log('  ✓ Message:', data?.message);
          console.log('  ✓ file_details.isLocalPath:', data?.file_details?.isLocalPath);
          console.log('  ✓ file_details.isSQL:', data?.file_details?.isSQL);
          console.log('  ✓ file_details.cmsType:', data?.file_details?.cmsType);
          console.log('  ✓ file_details.localPath:', data?.file_details?.localPath);
          console.log('');

          // Create mapper for folders (e.g., AEM)
          if (data?.status === 200) {
            console.log('🔧 Creating mapper for folder/directory...');
            console.log('  Calling createMapper with localPath:', localPath);
            createMapper(localPath, projectId, app_token, affix, config);
          }

          return res.status(data?.status || 200).json(data);
        }

        // Handle file paths
        const fileName = path.basename(localPath);

        if (!fileName) {
          return res.send('Filename could not be determined from the local path.');
        }

        const name = fileName?.split?.('.')?.[0];
        const fileExt = fileName?.split('.')?.pop() ?? '';

        console.log('Processing as file - fileExt:', fileExt, 'name:', name);

        const bodyStream = createReadStream(localPath);

        bodyStream.on('error', (error: any) => {
          console.error('Error reading file stream:', error);
          return res.status(500).json({
            status: 'error',
            message: 'Error reading file.',
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

            console.log('📦 SENDING XML VALIDATION RESPONSE TO UI:');
            console.log('  ✓ Status:', data?.status || 200);
            console.log('  ✓ Message:', data?.message);
            console.log('  ✓ file_details.isLocalPath:', data?.file_details?.isLocalPath);
            console.log('  ✓ file_details.isSQL:', data?.file_details?.isSQL);
            console.log('  ✓ file_details.cmsType:', data?.file_details?.cmsType);
            console.log('');

            res.status(data?.status || 200).json(data);
            if (data?.status === 200) {
              const filePath = path.join(__dirname, '..', '..', 'extracted_files', `${name}.json`);
              createMapper(filePath, projectId, app_token, affix, config);
            }
          });
        } else {
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
            const data = await handleFileProcessing(fileExt, zipBuffer, cmsType, name);

            console.log('📦 SENDING FILE VALIDATION RESPONSE TO UI:');
            console.log('  ✓ Status:', data?.status || 200);
            console.log('  ✓ Message:', data?.message);
            console.log('  ✓ file_details.isLocalPath:', data?.file_details?.isLocalPath);
            console.log('  ✓ file_details.isSQL:', data?.file_details?.isSQL);
            console.log('  ✓ file_details.cmsType:', data?.file_details?.cmsType);
            console.log('');

            res.status(data?.status || 200).json(data);
            if (data?.status === 200) {
              let filePath = path.join(__dirname, '..', '..', 'extracted_files', name);
              if (data?.file !== undefined) {
                filePath = path.join(__dirname, '..', '..', 'extracted_files', name, data?.file);
              }
              createMapper(filePath, projectId, app_token, affix, config);
            }
          });
        }
      } else {
        console.log('✗ isLocalPath is FALSE, checking next priority...');
        console.log('');

        if (config?.isSQL) {
          console.log('✓ Using SQL CONNECTION mode');
          console.log('  Ignoring AWS settings...');
          console.log('');

          const fileExt = 'sql';
          const name = 'sql';

          // For SQL files, we don't need to read from S3, just validate the database connection
          const result = await handleFileProcessing(fileExt, null, cmsType, name);
          if (!result) {
            console.error('File processing returned no result');
            return res.status(500).json({
              status: 500,
              message: 'File processing failed to return a result',
              file_details: config
            });
          }

          // Only create mapper if validation was successful (status 200)
          if (result.status === 200) {
            const filePath = '';
            createMapper(filePath, projectId, app_token, affix, config);
          }

          // Ensure we're sending back the complete file_details
          const response = {
            ...result,
            file_details: {
              ...result.file_details,
              isSQL: config.isSQL,
              mySQLDetails: config.mysql, // Changed from mysql to mySQLDetails
              assetsConfig: config.assetsConfig
            }
          };

          console.log('📦 SENDING SQL VALIDATION RESPONSE TO UI:');
          console.log('  ✓ Status:', result.status);
          console.log('  ✓ Message:', response?.message);
          console.log('  ✓ file_details.isLocalPath:', response?.file_details?.isLocalPath);
          console.log('  ✓ file_details.isSQL:', response?.file_details?.isSQL);
          console.log('  ✓ file_details.cmsType:', response?.file_details?.cmsType);
          console.log('  ✓ file_details.mysql.host:', response?.file_details?.mySQLDetails?.host);
          console.log(
            '  ✓ file_details.mysql.database:',
            response?.file_details?.mySQLDetails?.database
          );
          console.log('');

          return res.status(result.status).json(response);
        } else {
          console.log('✗ isSQL is FALSE, using final option...');
          console.log('✓ Using AWS S3 mode');
          console.log('');

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
            res.send('file validated successfully.');
            let filePath = path.join(__dirname, '..', '..', 'extracted_files', fileName);
            if (data?.file !== undefined) {
              filePath = path.join(__dirname, '..', '..', 'extracted_files', fileName, data?.file);
            }
            createMapper(filePath, projectId, app_token, affix, config);
          });
        }
      }
    } catch (err: any) {
      console.error('🚀 ~ router.get ~ err:', err);
      // Only send error response if no response has been sent yet
      if (!res.headersSent) {
        res.status(500).json({
          status: 500,
          message: 'Internal server error',
          error: err.message
        });
      }
    }
  }
);

router.get('/config', async function (req: Request, res: Response) {
  res.json(config);
});

// Exported the router
export default router;
