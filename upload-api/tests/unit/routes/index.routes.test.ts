import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

const {
  mockStatSync,
  mockCreateReadStream,
  mockClientSend,
  mockHandleFileProcessing,
  mockCreateMapper,
  mockConfig,
  mockFsAccess,
  mockFsCopyFile,
  mockFsCp,
  mockFsMkdir,
  mockFsReaddir,
  mockFsReadFile,
  mockParseXmlToJson,
  mockSaveJson,
  mockMergeWordpressJson,
  mockFilterMediaDocsToReferenced,
  mockRunningInDocker,
} = vi.hoisted(() => ({
  mockStatSync: vi.fn(),
  mockCreateReadStream: vi.fn(),
  mockClientSend: vi.fn(),
  mockHandleFileProcessing: vi.fn(),
  mockCreateMapper: vi.fn(),
  mockFsAccess: vi.fn(),
  mockFsCopyFile: vi.fn(),
  mockFsCp: vi.fn(),
  mockFsMkdir: vi.fn(),
  mockFsReaddir: vi.fn(),
  mockFsReadFile: vi.fn(),
  mockParseXmlToJson: vi.fn(),
  mockSaveJson: vi.fn(),
  mockMergeWordpressJson: vi.fn(),
  mockFilterMediaDocsToReferenced: vi.fn(),
  mockRunningInDocker: vi.fn(),
  mockConfig: {
    cmsType: 'wordpress',
    isLocalPath: true,
    localPath: 'sql',
    awsData: {
      awsRegion: 'us-east-2',
      bucketName: 'test-bucket',
      bucketKey: 'project/test.zip',
    },
    mysql: { host: 'localhost', user: 'root', password: 'pw', database: 'drupal', port: '3306' },
    assetsConfig: { base_url: 'http://test.com', public_path: '/files' },
    plan: { dropdown: { optionLimit: 100 } },
  } as any,
}));

vi.mock('fs', () => ({
  createReadStream: (...args: any[]) => mockCreateReadStream(...args),
  statSync: (...args: any[]) => mockStatSync(...args),
  promises: {
    access: (...args: any[]) => mockFsAccess(...args),
    copyFile: (...args: any[]) => mockFsCopyFile(...args),
    cp: (...args: any[]) => mockFsCp(...args),
    mkdir: (...args: any[]) => mockFsMkdir(...args),
    readdir: (...args: any[]) => mockFsReaddir(...args),
    readFile: (...args: any[]) => mockFsReadFile(...args),
  },
  default: {
    createReadStream: (...args: any[]) => mockCreateReadStream(...args),
    statSync: (...args: any[]) => mockStatSync(...args),
  },
}));

vi.mock('../../../src/utils/hydrate-config', () => ({
  runningInDocker: () => mockRunningInDocker(),
}));

vi.mock('../../../src/services/aws/client', () => ({
  client: { send: (...args: any[]) => mockClientSend(...args) },
}));

vi.mock('../../../src/helper', () => ({
  fileOperationLimiter: (_req: any, _res: any, next: any) => next(),
  deleteFolderSync: vi.fn(),
  updateConfigFile: vi.fn().mockImplementation(() => Promise.resolve(mockConfig)),
  parseXmlToJson: (...args: any[]) => mockParseXmlToJson(...args),
  saveJson: (...args: any[]) => mockSaveJson(...args),
  mergeWordpressJson: (...args: any[]) => mockMergeWordpressJson(...args),
  filterMediaDocsToReferenced: (...args: any[]) => mockFilterMediaDocsToReferenced(...args),
}));

vi.mock('../../../src/services/fileProcessing', () => ({
  default: (...args: any[]) => mockHandleFileProcessing(...args),
}));

vi.mock('../../../src/services/createMapper', () => ({
  default: (...args: any[]) => mockCreateMapper(...args),
}));

vi.mock('../../../src/config/index.json', () => ({ default: mockConfig }));

vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: vi.fn().mockImplementation(function (this: any, p: any) { Object.assign(this, p); }),
  CreateMultipartUploadCommand: vi.fn().mockImplementation(function (this: any, p: any) { Object.assign(this, p); }),
  UploadPartCommand: vi.fn().mockImplementation(function (this: any, p: any) { Object.assign(this, p); }),
  CompleteMultipartUploadCommand: vi.fn().mockImplementation(function (this: any, p: any) { Object.assign(this, p); }),
}));

function getHandler(router: any, method: string, routePath: string) {
  const layer = router.stack.find(
    (l: any) => l.route?.path === routePath && l.route?.methods?.[method]
  );
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${routePath} not found`);
  const handlers = layer.route.stack;
  return handlers[handlers.length - 1].handle;
}

function mockReq(overrides: any = {}) {
  return { headers: { projectid: 'proj-1', app_token: 'tk', affix: 'csm' }, ...overrides };
}

function mockRes() {
  return {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
}

async function waitFor(fn: () => boolean, ms = 300) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (fn()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe('routes/index', () => {
  let router: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    Object.assign(mockConfig, {
      cmsType: 'wordpress',
      isLocalPath: true,
      localPath: 'sql',
      awsData: { awsRegion: 'us-east-2', bucketName: 'test-bucket', bucketKey: 'project/test.zip' },
      mysql: { host: 'localhost', user: 'root', password: 'pw', database: 'drupal', port: '3306' },
      assetsConfig: { base_url: 'http://test.com', public_path: '/files' },
      plan: { dropdown: { optionLimit: 100 } },
    });
    const mod = await import('../../../src/routes/index');
    router = mod.default;
  });

  it('should export a router with 4 routes', () => {
    expect(router).toBeDefined();
    const routes = router.stack.filter((l: any) => l.route);
    expect(routes.length).toBe(4);
  });

  describe('GET /config', () => {
    it('should return config without mysql password', async () => {
      const handler = getHandler(router, 'get', '/config');
      const res = mockRes();
      await handler(mockReq(), res);

      expect(res.json).toHaveBeenCalledTimes(1);
      const sent = res.json.mock.calls[0][0];
      expect(sent.mysql.password).toBeUndefined();
      expect(sent.mysql.host).toBe('localhost');
      expect(sent.cmsType).toBe('wordpress');
    });
  });

  describe('POST /upload', () => {
    it('should upload file via multipart', async () => {
      const handler = getHandler(router, 'post', '/upload');
      mockClientSend
        .mockResolvedValueOnce({ UploadId: 'uid-1' })
        .mockResolvedValueOnce({ ETag: 'etag-1' })
        .mockResolvedValueOnce({});

      const req = mockReq({ file: { originalname: 'test.zip', buffer: Buffer.from('data') } });
      const res = mockRes();
      await handler(req, res);
      expect(res.send).toHaveBeenCalledWith('file uploaded sucessfully.');
    });

    it('should skip upload when no file buffer', async () => {
      const handler = getHandler(router, 'post', '/upload');
      const res = mockRes();
      await handler(mockReq({ file: null }), res);
      expect(res.send).toHaveBeenCalledWith('file uploaded sucessfully.');
      expect(mockClientSend).not.toHaveBeenCalled();
    });

    it('should handle upload S3 error', async () => {
      const handler = getHandler(router, 'post', '/upload');
      mockClientSend.mockRejectedValueOnce(new Error('S3 fail'));
      const res = mockRes();
      await handler(mockReq({ file: { originalname: 'f.zip', buffer: Buffer.from('x') } }), res);
    });
  });

  describe('GET /validator — SQL path', () => {
    it('should process SQL and create mapper on 200', async () => {
      mockConfig.localPath = 'sql';
      mockHandleFileProcessing.mockResolvedValue({ status: 200, message: 'OK', file_details: {} });

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      await handler(mockReq(), res);

      expect(mockHandleFileProcessing).toHaveBeenCalledWith('sql', null, 'wordpress', 'sql');
      expect(mockCreateMapper).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should not call mapper when status is not 200', async () => {
      mockConfig.localPath = 'SQL';
      mockHandleFileProcessing.mockResolvedValue({ status: 400, message: 'Bad', file_details: {} });

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      await handler(mockReq(), res);

      expect(mockCreateMapper).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 when file processing returns null', async () => {
      mockConfig.localPath = 'sql';
      mockHandleFileProcessing.mockResolvedValue(null);

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      await handler(mockReq(), res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should strip mysql password from SQL response', async () => {
      mockConfig.localPath = 'sql';
      mockHandleFileProcessing.mockResolvedValue({ status: 200, message: 'OK', file_details: {} });

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      await handler(mockReq(), res);

      const sent = res.json.mock.calls[0][0];
      expect(sent.file_details.mySQLDetails.password).toBeUndefined();
    });
  });

  describe('GET /validator — MySQL header parsing', () => {
    it('should parse mysql_* headers and pass trimmed mysqlDetails to updateConfigFile', async () => {
      mockConfig.localPath = 'sql';
      mockHandleFileProcessing.mockResolvedValue({ status: 200, message: 'OK', file_details: {} });
      const { updateConfigFile } = await import('../../../src/helper');

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      await handler(
        mockReq({
          headers: {
            projectid: 'proj-1',
            app_token: 'tk',
            affix: 'csm',
            file_path: 'sql',
            mysql_host: '  127.0.0.1  ',
            mysql_database: '  mydb  ',
            mysql_user: '  root  ',
          },
        }),
        res
      );

      expect(updateConfigFile).toHaveBeenCalledWith('sql', {
        host: '127.0.0.1',
        database: 'mydb',
        user: 'root',
      });
    });

    it('should use the first element when mysql_* headers are arrays', async () => {
      mockConfig.localPath = 'sql';
      mockHandleFileProcessing.mockResolvedValue({ status: 200, message: 'OK', file_details: {} });
      const { updateConfigFile } = await import('../../../src/helper');

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      await handler(
        mockReq({
          headers: {
            projectid: 'proj-1',
            app_token: 'tk',
            affix: 'csm',
            mysql_host: ['10.0.0.1', '10.0.0.2'],
            mysql_database: ['firstdb', 'seconddb'],
            mysql_user: ['admin', 'guest'],
          },
        }),
        res
      );

      expect(updateConfigFile).toHaveBeenCalledWith(undefined, {
        host: '10.0.0.1',
        database: 'firstdb',
        user: 'admin',
      });
    });

    it('should pass undefined mysql fields when headers are missing or blank', async () => {
      mockConfig.localPath = 'sql';
      mockHandleFileProcessing.mockResolvedValue({ status: 200, message: 'OK', file_details: {} });
      const { updateConfigFile } = await import('../../../src/helper');

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      await handler(
        mockReq({
          headers: { projectid: 'proj-1', app_token: 'tk', affix: 'csm', mysql_host: '   ' },
        }),
        res
      );

      expect(updateConfigFile).toHaveBeenCalledWith(undefined, {
        host: undefined,
        database: undefined,
        user: undefined,
      });
    });
  });

  describe('GET /validator — directory path', () => {
    it('merges a WordPress folder, extracts referenced media, and calls mapper on 200', async () => {
      mockConfig.localPath = '/tmp/content-dir';
      mockStatSync.mockReturnValue({ isDirectory: () => true });
      mockFsReaddir.mockResolvedValue(['posts.xml', 'media.xml']);
      mockFsReadFile.mockResolvedValue('<xml/>');
      // posts.xml → a content doc; media.xml → a pure-attachment (media library) doc.
      mockParseXmlToJson
        .mockResolvedValueOnce({ rss: { channel: { item: [{ 'wp:post_type': 'post' }] } } })
        .mockResolvedValueOnce({ rss: { channel: { item: [{ 'wp:post_type': 'attachment', 'wp:post_id': '12423' }] } } });
      mockFilterMediaDocsToReferenced.mockReturnValue({ docs: [{ rss: { channel: { item: [] } } }], kept: 1, dropped: 5 });
      mockMergeWordpressJson.mockReturnValue({ rss: { channel: { item: [] } } });
      mockSaveJson.mockResolvedValue(true);

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      await handler(mockReq(), res);

      // The media-library doc must be held aside and run through referenced-asset extraction, not merged whole.
      expect(mockFilterMediaDocsToReferenced).toHaveBeenCalled();
      expect(mockMergeWordpressJson).toHaveBeenCalled();
      expect(mockCreateMapper).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should not call mapper when the folder has no XML files', async () => {
      mockConfig.localPath = '/tmp/bad';
      mockStatSync.mockReturnValue({ isDirectory: () => true });
      mockFsReaddir.mockResolvedValue([]); // no .xml → 400

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      await handler(mockReq(), res);

      expect(mockCreateMapper).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return 500 on stat error', async () => {
      mockConfig.localPath = '/nonexistent';
      mockStatSync.mockImplementation(() => { throw new Error('ENOENT'); });

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      await handler(mockReq(), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
    });
  });

  describe('GET /validator — file path (XML)', () => {
    it('should process XML file stream', async () => {
      mockConfig.localPath = '/tmp/data.xml';
      mockStatSync.mockReturnValue({ isDirectory: () => false });

      const stream = new EventEmitter();
      mockCreateReadStream.mockReturnValue(stream);
      mockHandleFileProcessing.mockResolvedValue({ status: 200, message: 'Valid' });

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      handler(mockReq(), res);

      await new Promise((r) => setTimeout(r, 20));
      stream.emit('data', '<root>xml</root>');
      stream.emit('end');
      await waitFor(() => res.status.mock.calls.length > 0);

      expect(mockHandleFileProcessing).toHaveBeenCalledWith('xml', '<root>xml</root>', 'wordpress', 'data');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 400 when XML stream is empty', async () => {
      mockConfig.localPath = '/tmp/empty.xml';
      mockStatSync.mockReturnValue({ isDirectory: () => false });

      const stream = new EventEmitter();
      mockCreateReadStream.mockReturnValue(stream);

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      handler(mockReq(), res);

      await new Promise((r) => setTimeout(r, 20));
      stream.emit('end');
      await waitFor(() => res.status.mock.calls.length > 0);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should call createMapper for valid XML with 200', async () => {
      mockConfig.localPath = '/tmp/data.xml';
      mockStatSync.mockReturnValue({ isDirectory: () => false });

      const stream = new EventEmitter();
      mockCreateReadStream.mockReturnValue(stream);
      mockHandleFileProcessing.mockResolvedValue({ status: 200, message: 'OK' });

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      handler(mockReq(), res);

      await new Promise((r) => setTimeout(r, 20));
      stream.emit('data', '<root/>');
      stream.emit('end');
      await waitFor(() => res.json.mock.calls.length > 0);

      expect(mockCreateMapper).toHaveBeenCalled();
    });

    it('should handle XML processing error', async () => {
      mockConfig.localPath = '/tmp/data.xml';
      mockStatSync.mockReturnValue({ isDirectory: () => false });

      const stream = new EventEmitter();
      mockCreateReadStream.mockReturnValue(stream);
      mockHandleFileProcessing.mockRejectedValue(new Error('parse fail'));

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      handler(mockReq(), res);

      await new Promise((r) => setTimeout(r, 20));
      stream.emit('data', 'bad data');
      stream.emit('end');
      await waitFor(() => res.status.mock.calls.length > 0);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('GET /validator — file path (ZIP)', () => {
    it('should process ZIP file stream', async () => {
      mockConfig.localPath = '/tmp/data.zip';
      mockStatSync.mockReturnValue({ isDirectory: () => false });

      const stream = new EventEmitter();
      mockCreateReadStream.mockReturnValue(stream);
      mockHandleFileProcessing.mockResolvedValue({ status: 200, message: 'OK', file: 'inner' });

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      handler(mockReq(), res);

      await new Promise((r) => setTimeout(r, 20));
      stream.emit('data', Buffer.from('zipdata'));
      stream.emit('end');
      await waitFor(() => res.status.mock.calls.length > 0);

      expect(mockHandleFileProcessing).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockCreateMapper).toHaveBeenCalled();
    });

    it('should return 400 when ZIP stream is empty', async () => {
      mockConfig.localPath = '/tmp/data.zip';
      mockStatSync.mockReturnValue({ isDirectory: () => false });

      const stream = new EventEmitter();
      mockCreateReadStream.mockReturnValue(stream);

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      handler(mockReq(), res);

      await new Promise((r) => setTimeout(r, 20));
      stream.emit('end');
      await waitFor(() => res.status.mock.calls.length > 0);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle stream error', async () => {
      mockConfig.localPath = '/tmp/data.zip';
      mockStatSync.mockReturnValue({ isDirectory: () => false });

      const stream = new EventEmitter();
      mockCreateReadStream.mockReturnValue(stream);

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      handler(mockReq(), res);

      await new Promise((r) => setTimeout(r, 20));
      stream.emit('error', new Error('read error'));
      await waitFor(() => res.status.mock.calls.length > 0);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should handle ZIP processing error in end callback', async () => {
      mockConfig.localPath = '/tmp/data.zip';
      mockStatSync.mockReturnValue({ isDirectory: () => false });

      const stream = new EventEmitter();
      mockCreateReadStream.mockReturnValue(stream);
      mockHandleFileProcessing.mockRejectedValue(new Error('zip fail'));

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      handler(mockReq(), res);

      await new Promise((r) => setTimeout(r, 20));
      stream.emit('data', Buffer.from('zipdata'));
      stream.emit('end');
      await waitFor(() => res.status.mock.calls.length > 0);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('GET /validator — S3 path', () => {
    it('should process S3 file', async () => {
      mockConfig.isLocalPath = false;

      const bodyStream = new EventEmitter();
      mockClientSend.mockResolvedValue({ Body: bodyStream });
      mockHandleFileProcessing.mockResolvedValue({ status: 200, message: 'OK' });

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      handler(mockReq(), res);

      await new Promise((r) => setTimeout(r, 50));
      bodyStream.emit('data', Buffer.from('s3data'));
      bodyStream.emit('end');
      await waitFor(() => res.status.mock.calls.length > 0);

      expect(mockHandleFileProcessing).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle S3 with file-specific path', async () => {
      mockConfig.isLocalPath = false;

      const bodyStream = new EventEmitter();
      mockClientSend.mockResolvedValue({ Body: bodyStream });
      mockHandleFileProcessing.mockResolvedValue({ status: 200, message: 'OK', file: 'nested' });

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      handler(mockReq(), res);

      await new Promise((r) => setTimeout(r, 50));
      bodyStream.emit('data', Buffer.from('s3zip'));
      bodyStream.emit('end');
      await waitFor(() => res.status.mock.calls.length > 0);

      expect(mockCreateMapper).toHaveBeenCalled();
    });

    it('should handle empty S3 body', async () => {
      mockConfig.isLocalPath = false;
      mockClientSend.mockResolvedValue({ Body: null });

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      await handler(mockReq(), res);
      await new Promise((r) => setTimeout(r, 50));

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should handle S3 error', async () => {
      mockConfig.isLocalPath = false;
      mockClientSend.mockRejectedValue(new Error('S3 error'));

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      await handler(mockReq(), res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should handle S3 stream error event', async () => {
      mockConfig.isLocalPath = false;

      const bodyStream = new EventEmitter();
      mockClientSend.mockResolvedValue({ Body: bodyStream });

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      handler(mockReq(), res);

      await new Promise((r) => setTimeout(r, 50));
      bodyStream.emit('error', new Error('stream fail'));
      await waitFor(() => res.status.mock.calls.length > 0);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should handle empty S3 buffer in end callback', async () => {
      mockConfig.isLocalPath = false;

      const bodyStream = new EventEmitter();
      mockClientSend.mockResolvedValue({ Body: bodyStream });

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      handler(mockReq(), res);

      await new Promise((r) => setTimeout(r, 50));
      bodyStream.emit('end');
      await waitFor(() => res.status.mock.calls.length > 0 || res.json.mock.calls.length > 0, 500);
    });

    it('should handle S3 processing error in end callback', async () => {
      mockConfig.isLocalPath = false;

      const bodyStream = new EventEmitter();
      mockClientSend.mockResolvedValue({ Body: bodyStream });
      mockHandleFileProcessing.mockRejectedValue(new Error('process fail'));

      const handler = getHandler(router, 'get', '/validator');
      const res = mockRes();
      handler(mockReq(), res);

      await new Promise((r) => setTimeout(r, 50));
      bodyStream.emit('data', Buffer.from('data'));
      bodyStream.emit('end');
      await waitFor(() => res.status.mock.calls.length > 0);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('POST /upload-to-container', () => {
    function postHandler() {
      return getHandler(router, 'post', '/upload-to-container');
    }

    it('should return 400 when localPath is missing', async () => {
      const handler = postHandler();
      const res = mockRes();
      await handler(mockReq({ body: {} }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should return raw path and update config when not running in Docker', async () => {
      mockRunningInDocker.mockReturnValue(false);
      const { updateConfigFile } = await import('../../../src/helper');
      (updateConfigFile as any).mockResolvedValue(mockConfig);

      const handler = postHandler();
      const res = mockRes();
      await handler(mockReq({ body: { localPath: '/some/local/path.json' } }), res);

      expect(res.status).toHaveBeenCalledWith(200);
      const sent = res.json.mock.calls[0][0];
      expect(sent.containerPath).toBe('/some/local/path.json');
    });

    it('should return 500 when hostdata path is not accessible in Docker', async () => {
      mockRunningInDocker.mockReturnValue(true);
      mockFsAccess.mockRejectedValue(new Error('ENOENT'));

      const handler = postHandler();
      const res = mockRes();
      await handler(mockReq({ body: { localPath: '/Users/test/file.json' } }), res);

      expect(res.status).toHaveBeenCalledWith(500);
    });

    it('should respond with destPath and start background file copy in Docker', async () => {
      mockRunningInDocker.mockReturnValue(true);
      mockFsAccess.mockResolvedValue(undefined);
      mockFsMkdir.mockResolvedValue(undefined);
      mockFsCp.mockResolvedValue(undefined);
      const { updateConfigFile } = await import('../../../src/helper');
      (updateConfigFile as any).mockResolvedValue(mockConfig);

      const handler = postHandler();
      const res = mockRes();
      await handler(mockReq({ body: { localPath: '/Users/test/file.json' } }), res);

      expect(res.status).toHaveBeenCalledWith(200);
      const sent = res.json.mock.calls[0][0];
      expect(sent.containerPath).toContain('extracted_files');
      expect(sent.containerPath).toContain('file.json');

      // Wait for background copy
      await waitFor(() => mockFsCp.mock.calls.length > 0);
      expect(mockFsCp).toHaveBeenCalled();
    });

    it('should copy directory recursively in Docker when path has no extension', async () => {
      mockRunningInDocker.mockReturnValue(true);
      mockFsAccess.mockResolvedValue(undefined);
      mockFsMkdir.mockResolvedValue(undefined);
      mockFsReaddir.mockResolvedValue([]);
      mockFsCp.mockResolvedValue(undefined);
      const { updateConfigFile } = await import('../../../src/helper');
      (updateConfigFile as any).mockResolvedValue(mockConfig);

      const handler = postHandler();
      const res = mockRes();
      await handler(mockReq({ body: { localPath: '/Users/test/mydir' } }), res);

      expect(res.status).toHaveBeenCalledWith(200);
      const sent = res.json.mock.calls[0][0];
      expect(sent.containerPath).toContain('mydir');

      await waitFor(() => mockFsCp.mock.calls.length > 0);
      expect(mockFsCp).toHaveBeenCalled();
    });
  });
});
