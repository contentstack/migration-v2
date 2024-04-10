import express, { Router, Request, Response } from 'express';
import { createReadStream, createWriteStream } from 'fs';
import JSZip from 'jszip';
import multer from 'multer';
import { Readable } from 'stream';
import { CompleteMultipartUploadCommand, CreateMultipartUploadCommand, UploadPartCommand } from '@aws-sdk/client-s3';
import { client } from '../services/aws/client';
import validator from '../validators';
import config from '../config/index'
import getBuketObject from '../controllers/awsBucket';
import { getFileName } from '../helper';


const router: Router = express.Router();
// Use memory storage to avoid saving the file locally
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Define your routes
router.post('/upload', upload.single('file'), async function (req: Request, res: Response) {
  try {
    const objectKey = `project/${req?.file?.originalname}`;
    if (req?.file?.buffer) {
      const fileStream = new Readable();
      fileStream.push(req.file.buffer);
      fileStream.push(null);
      console.info('🚀 ~ router.post ~ fileStream:', fileStream);
      const createMultipartUploadCommand = new CreateMultipartUploadCommand({
        Bucket: 'migartion-test',
        Key: objectKey,
      });
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

        const uploadPartCommand = new UploadPartCommand({
          Bucket: 'migartion-test',
          Key: objectKey,
          UploadId,
          PartNumber: partNumber,
          Body: chunk,
        });

        const { ETag } = await client.send(uploadPartCommand);
        partETags?.push({ ETag, PartNumber: partNumber });
        console.info(`Uploaded part ${partNumber} with ETag: ${ETag}`);
        partNumber++;
      }


      const completeMultipartUploadCommand = new CompleteMultipartUploadCommand({
        Bucket: 'migartion-test',
        Key: objectKey,
        UploadId,
        MultipartUpload: {
          Parts: partETags,
        },
      });
      await client.send(completeMultipartUploadCommand);
    }
    res.send('file uplaoded sucessfully.');
  } catch (err) {
    console.error(err)
  }
});

router.post('/validator', express.json(), async function (req: Request, res: Response) {
  try {
    let bodyStream: Readable = null;
    const params = {
      Bucket: config?.awsData?.bucketName,
      Key: config?.awsData?.buketKey,
    };
    if (config?.isLocalPath) {
      params.Key = config?.localPath;
      bodyStream = createReadStream(config?.localPath) as Readable;
    } else {
      bodyStream = await getBuketObject(params) as Readable;
    }
    const fileDetails = getFileName(params);
    const zipFileStream = createWriteStream(`${fileDetails?.fileName}`);
    // Pipe the S3 object's body to the writable stream
    bodyStream?.pipe?.(zipFileStream);

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
      // Use jszip to unzip the downloaded file
      if (fileExt === "zip") {
        const zip = new JSZip();
        await zip.loadAsync(zipBuffer);
        validator({ data: zip, type: "sitecore" });
        console.log('Zip file contents extracted.');
      } else {
        // if file is not zip
        // Convert the buffer to a string assuming it's UTF-8 encoded
        const jsonString = Buffer?.from?.(zipBuffer)?.toString?.('utf8');
        console.info('🚀 ~ bodyStream.on ~ jsonString:', jsonString);
      }
      res.send('file valited sucessfully.');
    });
  } catch (err: any) {
    console.error('🚀 ~ router.get ~ err:', err);
  }
});

router.get('/config', async function (req: Request, res: Response) {
  res.json(config);
});

// Exported the router
export default router;
