import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRead, mockFind, mockFindIndex, mockChain } = vi.hoisted(() => {
  const mockFind = vi.fn();
  const mockFindIndex = vi.fn();
  const mockChain = {
    get: vi.fn().mockReturnValue({
      find: mockFind,
      findIndex: mockFindIndex,
    }),
  };
  return {
    mockRead: vi.fn(),
    mockFind,
    mockFindIndex,
    mockChain,
  };
});

vi.mock('../../../src/models/project-lowdb.js', () => ({
  default: {
    read: mockRead,
    chain: mockChain,
  },
}));

vi.mock('../../../src/utils/logger.js', () => ({
  default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../src/utils/custom-logger.utils.js', () => ({
  default: vi.fn().mockResolvedValue(undefined),
}));

import getProjectUtil from '../../../src/utils/get-project.utils.js';

describe('get-project.utils', () => {
  const validUuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const mockQuery = { id: validUuid, org_id: 'org-123', region: 'NA', owner: 'user-123' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockRead.mockResolvedValue(undefined);
  });

  it('should throw BadRequestError for invalid UUID', async () => {
    await expect(getProjectUtil('invalid-id', mockQuery)).rejects.toThrow(
      'Provided project ID is invalid.'
    );
  });

  it('should return project when found', async () => {
    const mockProject = { id: validUuid, name: 'Test' };
    mockFind.mockReturnValue({ value: () => mockProject });
    mockChain.get.mockReturnValue({ find: () => ({ value: () => mockProject }), findIndex: mockFindIndex });

    const result = await getProjectUtil(validUuid, mockQuery);
    expect(result).toEqual(mockProject);
  });

  it('should throw when project is not found', async () => {
    mockChain.get.mockReturnValue({
      find: () => ({ value: () => null }),
      findIndex: mockFindIndex,
    });

    await expect(getProjectUtil(validUuid, mockQuery)).rejects.toThrow();
  });

  it('should support isIndex mode', async () => {
    mockChain.get.mockReturnValue({
      find: mockFind,
      findIndex: () => ({ value: () => 0 }),
    });

    const result = await getProjectUtil(validUuid, mockQuery, 'test', true);
    expect(result).toBe(0);
  });

  it('should throw when isIndex returns -1', async () => {
    mockChain.get.mockReturnValue({
      find: mockFind,
      findIndex: () => ({ value: () => -1 }),
    });

    await expect(
      getProjectUtil(validUuid, mockQuery, 'test', true)
    ).rejects.toThrow();
  });
});
