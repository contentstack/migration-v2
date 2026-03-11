import { vi, beforeAll, afterAll, afterEach } from 'vitest';

beforeAll(() => {
  vi.stubEnv('PORT', '5002');
  vi.stubEnv('CMS_TYPE', 'wordpress');
  vi.stubEnv('CONTAINER_PATH', '/tmp/test-uploads');
  vi.stubEnv('NODE_BACKEND_API', 'http://localhost:5001');
  vi.stubEnv('DRUPAL_ASSETS_BASE_URL', 'http://localhost:8080');
  vi.stubEnv('DRUPAL_ASSETS_PUBLIC_PATH', '/sites/default/files');
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(() => {
  vi.unstubAllEnvs();
});
