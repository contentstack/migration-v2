import { vi, beforeAll, afterAll, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

beforeAll(() => {
  vi.stubEnv('VITE_BASE_API_URL', 'http://localhost:5001/');
  vi.stubEnv('VITE_WEBSITE_BASE_URL', 'https://test.contentstack.com');
  vi.stubEnv('VITE_API_VERSION', 'v2');
  vi.stubEnv('VITE_UPLOAD_SERVER', 'http://localhost:5002/');
  vi.stubEnv('VITE_OFFLINE_CMS', 'true');
});

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

afterAll(() => {
  vi.unstubAllEnvs();
});
