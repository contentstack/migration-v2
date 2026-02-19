import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAxiosRequest, mockDeleteFolderSync } = vi.hoisted(() => ({
  mockAxiosRequest: vi.fn(),
  mockDeleteFolderSync: vi.fn(),
}));

vi.mock('axios', () => ({ default: { request: mockAxiosRequest } }));
vi.mock('../../../src/helper', () => ({ deleteFolderSync: mockDeleteFolderSync, fileOperationLimiter: vi.fn() }));
vi.mock('../../../src/utils/logger', () => ({ default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));

import createSitecoreMapper from '../../../src/controllers/sitecore/index';

describe('createSitecoreMapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be a function', () => {
    expect(typeof createSitecoreMapper).toBe('function');
  });

  it('should handle error gracefully when extraction fails', async () => {
    mockAxiosRequest.mockResolvedValue({ status: 200 });
    await expect(
      createSitecoreMapper('/nonexistent', 'proj-1', 'token', 'csm', {})
    ).resolves.toBeUndefined();
  });

  it('should not throw on empty path', async () => {
    mockAxiosRequest.mockResolvedValue({ status: 200 });
    await expect(
      createSitecoreMapper('', 'proj-1', 'token', 'csm', {})
    ).resolves.toBeUndefined();
  });

  it('should handle API request failure', async () => {
    mockAxiosRequest.mockRejectedValue(new Error('Network error'));
    await expect(
      createSitecoreMapper('/fake', 'proj-1', 'token', 'csm', {})
    ).resolves.toBeUndefined();
  });

  it('should accept all required parameters', async () => {
    mockAxiosRequest.mockResolvedValue({ status: 200 });
    await createSitecoreMapper('/path', 'project-id', 'app-token', 'csm', { option: true });
  });
});
