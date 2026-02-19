export const createMockConfig = (overrides: Record<string, any> = {}) => ({
  plan: { dropdown: { optionLimit: 100 } },
  cmsType: 'wordpress',
  isLocalPath: true,
  awsData: {
    awsRegion: 'us-east-2',
    awsAccessKeyId: 'test-key',
    awsSecretAccessKey: 'test-secret',
    awsSessionToken: 'test-token',
    bucketName: 'test-bucket',
    bucketKey: 'test-key.zip',
  },
  mysql: {
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'drupal_db',
    port: '3306',
  },
  assetsConfig: {
    base_url: 'http://localhost:8080',
    public_path: '/sites/default/files',
  },
  localPath: '/tmp/test-uploads',
  ...overrides,
});

export const createMockRequest = (overrides: Record<string, any> = {}) => ({
  headers: {
    projectid: 'project-123',
    app_token: 'mock-token',
    affix: 'csm',
    ...overrides.headers,
  },
  file: overrides.file || undefined,
  body: overrides.body || {},
  ...overrides,
});

export const createMockResponse = () => {
  const res: any = {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return res;
};

export const createMockMySQLData = (overrides: Record<string, any> = {}) => ({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'drupal_db',
  port: 3306,
  ...overrides,
});
