import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRead = vi.fn();
const mockExistsSync = vi.fn();

vi.mock('fs', () => ({
  default: { existsSync: mockExistsSync },
  existsSync: mockExistsSync,
}));

vi.mock('../../../src/models/contentTypesMapper-lowdb.js', () => ({
  default: vi.fn(() => ({
    read: mockRead,
    data: { ContentTypesMappers: [{ otherCmsUid: 'ct-uid' }] },
  })),
}));

describe('content-type-checker.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRead.mockResolvedValue(undefined);
    mockExistsSync.mockReturnValue(true);
  });

  it('isContentTypeAlreadyCreated returns false when currentIteration <= 1', async () => {
    const { isContentTypeAlreadyCreated } = await import(
      '../../../src/utils/content-type-checker.utils.js'
    );
    await expect(isContentTypeAlreadyCreated('p1', 'x', 1)).resolves.toBe(false);
    expect(mockExistsSync).not.toHaveBeenCalled();
  });

  it('isContentTypeAlreadyCreated returns true when prior iteration has matching uid', async () => {
    const { isContentTypeAlreadyCreated } = await import(
      '../../../src/utils/content-type-checker.utils.js'
    );
    await expect(isContentTypeAlreadyCreated('p1', 'ct-uid', 3)).resolves.toBe(true);
    expect(mockRead).toHaveBeenCalled();
  });

  it('getPreviouslyCreatedContentTypes returns empty when iteration <= 1', async () => {
    const { getPreviouslyCreatedContentTypes } = await import(
      '../../../src/utils/content-type-checker.utils.js'
    );
    await expect(getPreviouslyCreatedContentTypes('p1', 1)).resolves.toEqual([]);
  });

  it('shouldSkipContentTypeCreation delegates to isContentTypeAlreadyCreated', async () => {
    const mod = await import('../../../src/utils/content-type-checker.utils.js');
    await expect(mod.shouldSkipContentTypeCreation('p1', 'ct-uid', 1)).resolves.toBe(false);
  });

  it('isContentTypeAlreadyCreated skips iterations with no directory', async () => {
    mockExistsSync.mockReturnValue(false);
    const { isContentTypeAlreadyCreated } = await import(
      '../../../src/utils/content-type-checker.utils.js'
    );
    await expect(isContentTypeAlreadyCreated('p1', 'ct-uid', 3)).resolves.toBe(false);
  });

  it('isContentTypeAlreadyCreated continues when read throws', async () => {
    mockExistsSync.mockReturnValue(true);
    mockRead.mockRejectedValueOnce(new Error('read fail'));
    const { isContentTypeAlreadyCreated } = await import(
      '../../../src/utils/content-type-checker.utils.js'
    );
    await expect(isContentTypeAlreadyCreated('p1', 'missing', 3)).resolves.toBe(false);
  });

  it('getPreviouslyCreatedContentTypes collects uids from prior iterations', async () => {
    const { getPreviouslyCreatedContentTypes } = await import(
      '../../../src/utils/content-type-checker.utils.js'
    );
    await expect(getPreviouslyCreatedContentTypes('p1', 3)).resolves.toContain('ct-uid');
  });

  it('getPreviouslyCreatedContentTypes continues when iteration read fails', async () => {
    mockExistsSync.mockReturnValue(true);
    mockRead.mockRejectedValue(new Error('boom'));
    const { getPreviouslyCreatedContentTypes } = await import(
      '../../../src/utils/content-type-checker.utils.js'
    );
    await expect(getPreviouslyCreatedContentTypes('p1', 2)).resolves.toEqual([]);
  });
});
