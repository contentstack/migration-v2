import { vi, beforeAll, afterAll, afterEach } from 'vitest';

beforeAll(() => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('APP_TOKEN_KEY', 'test-secret-key');
  vi.stubEnv('PORT', '5001');
  vi.stubEnv('FILE_UPLOAD_KEY', 'test-upload-key');
  vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/test-migration');
  vi.stubEnv('LOG_LEVEL', 'error');
  vi.stubEnv('DRUPAL_ASSETS_BASE_URL', 'http://localhost:8080');
  vi.stubEnv('DRUPAL_ASSETS_PUBLIC_PATH', '/sites/default/files');
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllEnvs();
});
