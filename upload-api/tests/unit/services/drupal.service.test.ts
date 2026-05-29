import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAxiosRequest } = vi.hoisted(() => ({
  mockAxiosRequest: vi.fn(),
}));

vi.mock('axios', () => ({ default: { request: mockAxiosRequest } }));
vi.mock('../../../src/utils/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
vi.mock('fs', () => ({
  default: { existsSync: vi.fn().mockReturnValue(false), promises: { readFile: vi.fn() } },
  existsSync: vi.fn().mockReturnValue(false),
  promises: { readFile: vi.fn() },
}));

import createDrupalMapper from '../../../src/services/drupal/index';

describe('createDrupalMapper', () => {
  const config: any = {
    mysql: { host: 'localhost', user: 'root', password: 'pw', database: 'drupal' },
    assetsConfig: { base_url: 'http://test.com', public_path: '/files' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be a function', () => {
    expect(typeof createDrupalMapper).toBe('function');
  });

  it('should handle errors gracefully when extraction fails', async () => {
    await expect(
      createDrupalMapper(config, 'proj-1', 'token', 'csm')
    ).resolves.toBeUndefined();
  });

  it('should handle missing mysql config gracefully', async () => {
    const badConfig: any = { mysql: {} };
    await expect(
      createDrupalMapper(badConfig, 'proj-1', 'token', 'csm')
    ).resolves.toBeUndefined();
  });

  it('should handle null config values', async () => {
    const nullConfig: any = { mysql: null };
    await expect(
      createDrupalMapper(nullConfig, 'proj-1', 'token', 'csm')
    ).resolves.toBeUndefined();
  });

  it('should handle API error response', async () => {
    mockAxiosRequest.mockRejectedValue({ response: { data: 'API Error' } });
    await expect(
      createDrupalMapper(config, 'proj-1', 'token', 'csm')
    ).resolves.toBeUndefined();
  });
});
