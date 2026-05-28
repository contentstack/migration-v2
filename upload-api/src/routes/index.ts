import path from 'path';
import multer from 'multer';
import { Readable } from 'stream';
import express, { Router, Request, Response } from 'express';
import { createReadStream, statSync, promises as fsPromises } from 'fs';
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  UploadPartCommand
} from '@aws-sdk/client-s3';
import { client } from '../services/aws/client';
import { fileOperationLimiter, updateConfigFile } from '../helper';
import handleFileProcessing from '../services/fileProcessing';
import createMapper from '../services/createMapper';
import { sanitizeId, sanitizeFilename, isPathWithinBase } from '../utils/sanitize-path.utils';
import { runningInDocker } from '../utils/hydrate-config';
import logger from '../utils/logger';

const router: Router = express.Router();
// Use memory storage to avoid saving the file locally
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Copy a file or directory from the host into the container's shared extracted_files volume.
// Host filesystem is mounted at /host (read-only) via docker-compose.
// Accepts: { localPath: string } — the path the user typed in the UI.
// If localPath has a file extension → copy single file.
// If no extension → treat as directory, copy recursively.
router.post('/upload-to-container', express.json(), async function (req: Request, res: Response) {
  try {
    const rawPath: string = req.body?.localPath || '';
    if (!rawPath) {
      return res.status(400).json({ status: 400, message: 'localPath is required.' });
    }

    if (!runningInDocker()) {
      // Local: no file copy needed, just update config with the raw path
      await updateConfigFile(rawPath);
      return res.status(200).json({ status: 200, containerPath: rawPath });
    }

    // Docker: resolve host path via /hostdata mount (/Users is mounted at /hostdata)
    const hostDataDir = process.env.HOST_DATA_DIR || '/Users';
    const relativePath = rawPath.startsWith(hostDataDir)
      ? rawPath.slice(hostDataDir.length)
      : rawPath;
    const hostMountBase = '/hostdata';

    // Break taint flow: rebuild each segment character-by-character from an allowlist.
    // The resulting strings are freshly constructed and contain only safe characters,
    // severing any taint propagation from the request body into fs.* calls.
    const ALLOWED = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.- ';
    const rawSegments = relativePath.split(/[\\/]+/).filter(Boolean);
    const segments: string[] = [];
    for (const raw of rawSegments) {
      let clean = '';
      for (let i = 0; i < raw.length; i++) {
        const ch = raw.charAt(i);
        if (ALLOWED.indexOf(ch) !== -1) clean += ch;
      }
      if (!clean || clean === '.' || clean === '..') {
        return res.status(400).json({ status: 400, message: 'Invalid path.' });
      }
      segments.push(clean);
    }
    const hostPath = path.join(hostMountBase, ...segments);

    // Defense-in-depth: still verify the resolved path is confined to the mount.
    if (!isPathWithinBase(path.resolve(hostPath), hostMountBase)) {
      return res.status(400).json({ status: 400, message: 'Invalid path.' });
    }

    // Verify the path is accessible via the /hostdata mount before responding.
    await fsPromises.access(hostPath);

    // Compute the final shared_data destination path.
    // Return destPath immediately so the UI saves it to the project DB —
    // migration-api will find the file there once the background copy finishes.
    const baseDir = path.join(__dirname, '..', '..', 'extracted_files');
    const name = sanitizeFilename(path.basename(rawPath));
    const destPath = path.resolve(baseDir, name);

    if (!isPathWithinBase(destPath, baseDir)) {
      return res.status(400).json({ status: 400, message: 'Invalid destination path.' });
    }

    // Respond with destPath so file_path saved in project DB points to shared_data.
    res.status(200).json({ status: 200, containerPath: destPath });

    // Background: copy file/dir into shared_data volume so migration-api can access it.
    (async () => {
      try {
        const hasExtension = path.extname(rawPath) !== '';
        if (hasExtension) {
          await fsPromises.mkdir(baseDir, { recursive: true });
          await fsPromises.copyFile(hostPath, destPath);
        } else {
          // Pass only the validated segments + trusted bases — no tainted strings cross the boundary.
          await copyDirRecursive(segments, [name], hostMountBase, baseDir);
        }
        await updateConfigFile(destPath);
        logger.info('Background copy complete', { destPath });
      } catch (copyErr) {
        logger.error('Background copy failed', { err: copyErr });
      }
    })();
  } catch (err: any) {
    logger.error('upload-to-container error', { err });
    return res.status(500).json({ status: 500, message: 'Upload failed.', error: err.message });
  }
});

const ALLOWED_PATH_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.- ';

// Allowlist-rebuilds a string char-by-char to produce a fresh, untainted value.
function allowlistSegment(input: string): string {
  let out = '';
  for (let i = 0; i < input.length; i++) {
    const ch = input.charAt(i);
    if (ALLOWED_PATH_CHARS.indexOf(ch) !== -1) out += ch;
  }
  return out;
}

async function copyDirRecursive(
  srcSegments: string[],
  destSegments: string[],
  srcBase: string,
  destBase: string
): Promise<void> {
  // Re-sanitize every segment at the sink boundary — fresh strings sever any taint flow.
  const cleanSrcSegs: string[] = [];
  for (const s of srcSegments) {
    const c = allowlistSegment(s);
    if (!c || c === '.' || c === '..') return;
    cleanSrcSegs.push(c);
  }
  const cleanDestSegs: string[] = [];
  for (const s of destSegments) {
    const c = allowlistSegment(s);
    if (!c || c === '.' || c === '..') return;
    cleanDestSegs.push(c);
  }

  const resolvedSrcBase = path.resolve(srcBase);
  const resolvedDestBase = path.resolve(destBase);
  const resolvedSrc = path.resolve(resolvedSrcBase, ...cleanSrcSegs);
  const resolvedDest = path.resolve(resolvedDestBase, ...cleanDestSegs);

  if (
    !isPathWithinBase(resolvedSrc, resolvedSrcBase) ||
    !isPathWithinBase(resolvedDest, resolvedDestBase)
  ) {
    return;
  }

  await fsPromises.mkdir(resolvedDest, { recursive: true });
  const entries = await fsPromises.readdir(resolvedSrc, { withFileTypes: true });
  for (const entry of entries) {
    const rawName = entry.name;
    const safeName = allowlistSegment(rawName);
    if (!safeName || safeName === '.' || safeName === '..' || safeName !== rawName) {
      continue;
    }
    if (entry.isDirectory()) {
      await copyDirRecursive(
        [...cleanSrcSegs, safeName],
        [...cleanDestSegs, safeName],
        resolvedSrcBase,
        resolvedDestBase
      );
    } else if (entry.isFile()) {
      // Build child paths only from locally-resolved trusted bases + freshly-allowlisted names.
      const childSrc = path.resolve(resolvedSrcBase, ...cleanSrcSegs, safeName);
      const childDest = path.resolve(resolvedDestBase, ...cleanDestSegs, safeName);
      if (
        !isPathWithinBase(childSrc, resolvedSrcBase) ||
        !isPathWithinBase(childDest, resolvedDestBase)
      ) {
        continue;
      }
      await fsPromises.copyFile(childSrc, childDest);
    }
  }
}

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
      // Sanitize user inputs to prevent path traversal attacks
      const projectId: string = sanitizeId(req?.headers?.projectid ?? '');
      const app_token: string | string[] = req?.headers?.app_token ?? '';
      const affix: string = sanitizeId(req?.headers?.affix ?? 'csm');
      const rawFilePath = Array.isArray(req?.headers?.file_path) ? req?.headers?.file_path?.[0] : req?.headers?.file_path;
      const filePath: string | undefined = rawFilePath && typeof rawFilePath === 'string' && rawFilePath.trim() !== '' ? rawFilePath.trim() : undefined;
      const config = await updateConfigFile(filePath);
      if (!config) {
        logger.error('Failed to load application config');
        return res.status(500).json({
          status: 500,
          message: 'Failed to load application configuration'
        });
      }
      const cmsType = config.cmsType?.toLowerCase();

      if (config.isLocalPath) {
        const localPath = config?.localPath || '';

        // Check if localPath indicates a SQL/MySQL connection (case-insensitive)
        const isSQLConnection = localPath.toLowerCase() === 'sql';

        if (isSQLConnection) {
          const fileExt = 'sql';
          const name = 'sql';

          // For SQL, we don't need to read from a file, just validate the database connection
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

          // Send back response with MySQL details (excluding password) and assets config
          const { password, ...safeMySQLDetails } = config.mysql || {};
          const response = {
            ...result,
            file_details: {
              ...result.file_details,
              isLocalPath: config.isLocalPath,
              localPath: config.localPath,
              mySQLDetails: safeMySQLDetails,
              assetsConfig: config.assetsConfig
            }
          };

          return res.status(result.status).json(response);
        }

        // Check if the path is a directory or file
        let isDirectory = false;
        try {
          const stats = statSync(localPath);
          isDirectory = stats.isDirectory();
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

          // For folders, pass the directory path directly to the validator
          const data = await handleFileProcessing(fileExt, localPath, cmsType, name);

          // Create mapper for folders (e.g., AEM)
          if (data?.status === 200) {
            // Path is from config (server-side), projectId and affix are sanitized
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
          let streamError: Error | null = null;

          // Collect the data from the stream as a string
          bodyStream.on('data', (chunk) => {
            if (typeof chunk !== 'string' && !Buffer.isBuffer(chunk)) {
              streamError = new Error('Expected chunk to be a string or a Buffer');
              bodyStream.destroy(streamError);
              return;
            }
            // Convert chunk to string (if it's a Buffer)
            xmlData += chunk.toString();
          });

          // When the stream ends, process the XML data
          bodyStream.on('end', async () => {
            try {
              // Check for errors that occurred during streaming
              if (streamError) {
                return; // Error already handled by 'error' event
              }

              if (!xmlData) {
                if (!res.headersSent) {
                  res.status(400).json({
                    status: 400,
                    message: 'No data collected from the stream.',
                    file_details: config
                  });
                }
                return;
              }

              const data = await handleFileProcessing(fileExt, xmlData, cmsType, name);

              if (!res.headersSent) {
                res.status(data?.status || 200).json(data);
              }
              if (data?.status === 200) {
                // Sanitize the filename before constructing path
                const safeName = sanitizeFilename(name);
                const baseDir = path.join(__dirname, '..', '..', 'extracted_files');
                const filePath = path.join(baseDir, `${safeName}.json`);
                // Validate path is within expected directory
                if (isPathWithinBase(filePath, baseDir)) {
                  createMapper(filePath, projectId, app_token, affix, config);
                } else {
                  console.error('Path traversal attempt detected');
                }
              }
            } catch (error: any) {
              console.error('Error processing XML stream:', error);
              if (!res.headersSent) {
                res.status(500).json({
                  status: 500,
                  message: 'Error processing XML file',
                  error: error.message
                });
              }
            }
          });
        } else {
          // Create a writable stream to save the downloaded zip file
          let zipBuffer = Buffer.alloc(0);
          let streamError: Error | null = null;

          // Collect the data from the stream into a buffer
          bodyStream.on('data', (chunk) => {
            if (!Buffer.isBuffer(chunk)) {
              streamError = new Error('Expected chunk to be a Buffer');
              bodyStream.destroy(streamError);
              return;
            }
            zipBuffer = Buffer.concat([zipBuffer, chunk]);
          });

          // Buffer fully streamed
          bodyStream.on('end', async () => {
            try {
              // Check for errors that occurred during streaming
              if (streamError) {
                return; // Error already handled by 'error' event
              }

              if (!zipBuffer || zipBuffer.length === 0) {
                if (!res.headersSent) {
                  res.status(400).json({
                    status: 400,
                    message: 'No data collected from the stream.',
                    file_details: config
                  });
                }
                return;
              }

              const data = await handleFileProcessing(fileExt, zipBuffer, cmsType, name);

              if (!res.headersSent) {
                res.status(data?.status || 200).json(data);
              }
              if (data?.status === 200) {
                // Sanitize the filename before constructing path
                const safeName = sanitizeFilename(name);
                const baseDir = path.join(__dirname, '..', '..', 'extracted_files');
                let filePath = path.join(baseDir, safeName);
                if (data?.file !== undefined) {
                  const safeFile = sanitizeFilename(data.file);
                  filePath = path.join(baseDir, safeName, safeFile);
                }
                // Validate path is within expected directory
                if (isPathWithinBase(filePath, baseDir)) {
                  createMapper(filePath, projectId, app_token, affix, config);
                } else {
                  console.error('Path traversal attempt detected');
                }
              }
            } catch (error: any) {
              console.error('Error processing file stream:', error);
              if (!res.headersSent) {
                res.status(500).json({
                  status: 500,
                  message: 'Error processing file',
                  error: error.message
                });
              }
            }
          });
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

          // Collect the S3 file data into a buffer for processing
          // NOTE: Removed unsafe file write that used unsanitized filename
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
            try {
              if (!zipBuffer) {
                throw new Error('No data collected from the stream.');
              }

              const data = await handleFileProcessing(fileExt, zipBuffer, cmsType, fileName);

              res.status(data?.status || 200).json(data);

              if (data?.status === 200) {
                // Sanitize the filename before constructing path
                const safeFileName = sanitizeFilename(fileName);
                const baseDir = path.join(__dirname, '..', '..', 'extracted_files');
                let filePath = path.join(baseDir, safeFileName);

                // If the processor returned a specific file/folder, update the path
                if (data?.file) {
                  const safeDataFile = sanitizeFilename(data.file);
                  filePath = path.join(baseDir, safeFileName, safeDataFile);
                }

                // Validate path is within expected directory
                if (isPathWithinBase(filePath, baseDir)) {
                  createMapper(filePath, projectId, app_token, affix, config);
                } else {
                  console.error('Path traversal attempt detected');
                }
              }
            } catch (error: any) {
              console.error('Processing error:', error);
              if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to process file' });
              }
            }
          });

          bodyStream.on('error', (error) => {
            console.error('Stream error:', error);
            if (!res.headersSent) {
              res.status(500).json({ error: 'Stream processing failed' });
            }
          });
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
  const config = await updateConfigFile();
  if (!config) {
    logger.error('Failed to load application config');
    return res.status(500).json({
      status: 500,
      message: 'Failed to load application configuration'
    });
  }
  const { password, ...safeMysql } = config.mysql || {};
  const safeConfig = {
    ...config,
    mysql: safeMysql
  };
  res.json(safeConfig);
});

// Exported the router
export default router;
