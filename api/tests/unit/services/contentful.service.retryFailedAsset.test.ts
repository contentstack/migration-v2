import fs from 'fs';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/utils/custom-logger.utils.js', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

const { contentfulService } = await import('../../../src/services/contentful.service.js');

describe('contentfulService.retryFailedAsset', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns failure when the asset is not present in the source export', async () => {
    vi.spyOn(fs.promises, 'readFile').mockResolvedValue(
      JSON.stringify({ assets: [{ sys: { id: 'some-other-asset' } }] }),
    );

    const result = await contentfulService.retryFailedAsset(
      '/fake/package/path.json',
      'stack123',
      'project123',
      'missing-asset-id',
    );

    expect(result).toEqual({
      success: false,
      message: 'Asset not found in the source export.',
    });
  });

  it('returns a failure message when reading the package file throws', async () => {
    vi.spyOn(fs.promises, 'readFile').mockRejectedValue(new Error('ENOENT: no such file'));

    const result = await contentfulService.retryFailedAsset(
      '/fake/package/path.json',
      'stack123',
      'project123',
      'asset-id',
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('ENOENT');
  });
});
