import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAxiosRequest } = vi.hoisted(() => ({
  mockAxiosRequest: vi.fn(),
}));

vi.mock('axios', () => ({ default: { request: mockAxiosRequest } }));
vi.mock('../../../src/utils/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import createContentfulMapper from '../../../src/services/contentful/index';

describe('createContentfulMapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be a function', () => {
    expect(typeof createContentfulMapper).toBe('function');
  });

  it('should handle error gracefully when extractLocale fails', async () => {
    const config: any = { localPath: '/nonexistent/path' };
    await expect(
      createContentfulMapper('proj-1', 'token', 'csm', config)
    ).resolves.toBeUndefined();
  });

  it('should handle empty localPath', async () => {
    const config: any = { localPath: '' };
    await expect(
      createContentfulMapper('proj-1', 'token', 'csm', config)
    ).resolves.toBeUndefined();
  });

  it('should handle undefined config values', async () => {
    const config: any = {};
    await expect(
      createContentfulMapper('proj-1', 'token', 'csm', config)
    ).resolves.toBeUndefined();
  });

  it('should handle API error response', async () => {
    const config: any = { localPath: '/tmp/nonexistent' };
    mockAxiosRequest.mockRejectedValue({ response: { data: 'API Error' } });
    await expect(
      createContentfulMapper('proj-1', 'token', 'csm', config)
    ).resolves.toBeUndefined();
  });
});
