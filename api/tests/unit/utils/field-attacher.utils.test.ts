import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockProjectRead,
  mockContentTypesRead,
  mockFieldMapperRead,
  mockProjectChain,
  mockContentTypesChain,
  mockFieldMapperChain,
  mockContenTypeMaker,
} = vi.hoisted(() => {
  const mockProjectChain = {
    get: vi.fn().mockReturnThis(),
    find: vi.fn().mockReturnThis(),
    value: vi.fn(),
  };
  const mockContentTypesChain = {
    get: vi.fn().mockReturnThis(),
    find: vi.fn().mockReturnThis(),
    value: vi.fn(),
  };
  const mockFieldMapperChain = {
    get: vi.fn().mockReturnThis(),
    find: vi.fn().mockReturnThis(),
    value: vi.fn(),
  };
  return {
    mockProjectRead: vi.fn(),
    mockContentTypesRead: vi.fn(),
    mockFieldMapperRead: vi.fn(),
    mockProjectChain,
    mockContentTypesChain,
    mockFieldMapperChain,
    mockContenTypeMaker: vi.fn(),
  };
});

vi.mock('../../../src/models/project-lowdb.js', () => ({
  default: {
    read: mockProjectRead,
    chain: mockProjectChain,
  },
}));

vi.mock('../../../src/models/contentTypesMapper-lowdb.js', () => ({
  default: vi.fn().mockReturnValue({
    read: mockContentTypesRead,
    chain: mockContentTypesChain,
  }),
}));

vi.mock('../../../src/models/FieldMapper.js', () => ({
  default: vi.fn().mockReturnValue({
    read: mockFieldMapperRead,
    chain: mockFieldMapperChain,
  }),
}));

vi.mock('../../../src/utils/content-type-creator.utils.js', () => ({
  contenTypeMaker: (...args: any[]) => mockContenTypeMaker(...args),
}));

import { fieldAttacher } from '../../../src/utils/field-attacher.utils.js';

describe('field-attacher.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProjectRead.mockResolvedValue(undefined);
    mockContentTypesRead.mockResolvedValue(undefined);
    mockFieldMapperRead.mockResolvedValue(undefined);
    mockContenTypeMaker.mockResolvedValue(undefined);
  });

  it('should return empty array when project has no content_mapper', async () => {
    mockProjectChain.value.mockReturnValue({
      id: 'proj-1',
      org_id: 'org-1',
      content_mapper: undefined,
    });

    const result = await fieldAttacher({
      projectId: 'proj-1',
      orgId: 'org-1',
      destinationStackId: 'stack-1',
      region: 'NA',
      user_id: 'user-1',
    });

    expect(result).toEqual([]);
    expect(mockProjectRead).toHaveBeenCalled();
    expect(mockContentTypesRead).toHaveBeenCalled();
    expect(mockFieldMapperRead).toHaveBeenCalled();
    expect(mockContenTypeMaker).not.toHaveBeenCalled();
  });

  it('should return empty array when project has empty content_mapper', async () => {
    mockProjectChain.value.mockReturnValue({
      id: 'proj-1',
      org_id: 'org-1',
      content_mapper: [],
    });

    const result = await fieldAttacher({
      projectId: 'proj-1',
      orgId: 'org-1',
      destinationStackId: 'stack-1',
      region: 'NA',
      user_id: 'user-1',
    });

    expect(result).toEqual([]);
    expect(mockContenTypeMaker).not.toHaveBeenCalled();
  });

  it('should call contenTypeMaker for each content type and return contentTypes', async () => {
    const contentType1 = {
      id: 'ct-1',
      fieldMapping: ['field-1'],
    };
    const field1 = { id: 'field-1', display_name: 'Title' };

    mockProjectChain.value.mockReturnValue({
      id: 'proj-1',
      org_id: 'org-1',
      content_mapper: ['ct-1'],
      stackDetails: { isNewStack: false },
      mapperKeys: {},
    });

    mockContentTypesChain.value.mockReturnValue(contentType1);
    mockFieldMapperChain.value.mockReturnValue(field1);

    const result = await fieldAttacher({
      projectId: 'proj-1',
      orgId: 'org-1',
      destinationStackId: 'stack-1',
      region: 'NA',
      user_id: 'user-1',
    });

    expect(mockContenTypeMaker).toHaveBeenCalledWith(
      expect.objectContaining({
        contentType: expect.objectContaining({
          id: 'ct-1',
          fieldMapping: [field1],
        }),
        destinationStackId: 'stack-1',
        projectId: 'proj-1',
        newStack: false,
        keyMapper: {},
        region: 'NA',
        user_id: 'user-1',
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('should handle content type with no fieldMapping', async () => {
    const contentType = { id: 'ct-1', fieldMapping: undefined };

    mockProjectChain.value.mockReturnValue({
      id: 'proj-1',
      org_id: 'org-1',
      content_mapper: ['ct-1'],
      stackDetails: { isNewStack: true },
      mapperKeys: {},
    });

    mockContentTypesChain.value.mockReturnValue(contentType);

    const result = await fieldAttacher({
      projectId: 'proj-1',
      orgId: 'org-1',
      destinationStackId: 'stack-1',
      region: 'NA',
      user_id: 'user-1',
    });

    expect(mockContenTypeMaker).toHaveBeenCalled();
    expect(result).toHaveLength(1);
  });

  it('should return empty array when project is not found', async () => {
    mockProjectChain.value.mockReturnValue(undefined);

    const result = await fieldAttacher({
      projectId: 'proj-999',
      orgId: 'org-1',
      destinationStackId: 'stack-1',
      region: 'NA',
      user_id: 'user-1',
    });

    expect(result).toEqual([]);
  });

  it('should handle multiple content types in content_mapper', async () => {
    const contentType1 = { id: 'ct-1', fieldMapping: [] };
    const contentType2 = { id: 'ct-2', fieldMapping: [] };

    mockProjectChain.value.mockReturnValue({
      id: 'proj-1',
      org_id: 'org-1',
      content_mapper: ['ct-1', 'ct-2'],
      stackDetails: {},
      mapperKeys: {},
    });

    mockContentTypesChain.value
      .mockReturnValueOnce(contentType1)
      .mockReturnValueOnce(contentType2);

    const result = await fieldAttacher({
      projectId: 'proj-1',
      orgId: 'org-1',
      destinationStackId: 'stack-1',
      region: 'NA',
      user_id: 'user-1',
    });

    expect(mockContenTypeMaker).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });
});
