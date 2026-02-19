import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockJSZip } = vi.hoisted(() => ({
  mockJSZip: vi.fn().mockImplementation(function (this: any) {
    this.loadAsync = vi.fn().mockResolvedValue(this);
    this.files = {};
  }),
}));

vi.mock('jszip', () => ({
  default: mockJSZip,
}));

import sitecoreValidator from '../../../src/validators/sitecore/index';

describe('sitecoreValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when items and metadata folders are present', async () => {
    const data = {
      files: {
        'items/master/sitecore/content': {},
        'metadata/config.yml': {},
      },
    };
    const result = await sitecoreValidator({ data });
    expect(result).toBe(true);
  });

  it('should return true when items and metadata are nested under path', async () => {
    const data = {
      files: {
        'project/items/master/content': {},
        'project/metadata/config.yml': {},
      },
    };
    const result = await sitecoreValidator({ data });
    expect(result).toBe(true);
  });

  it('should return false when required folders are missing', async () => {
    const data = {
      files: {
        'installer/setup.exe': {},
        'properties/config.txt': {},
      },
    };
    const result = await sitecoreValidator({ data });
    expect(result).toBe(false);
  });

  it('should return false for empty zip', async () => {
    const data = { files: {} };
    const result = await sitecoreValidator({ data });
    expect(result).toBe(false);
  });

  it('should return false on error', async () => {
    const result = await sitecoreValidator({ data: null as any });
    expect(result).toBe(false);
  });

  it('should handle mixed content with items and metadata among other files', async () => {
    const data = {
      files: {
        'project/items/master/content.yml': {},
        'project/metadata/config.yml': {},
        'project/installer/setup.exe': {},
        'project/properties/config.txt': {},
        'readme.txt': {},
      },
    };
    const result = await sitecoreValidator({ data });
    expect(result).toBe(true);
  });

  it('should return false when nested zip does not contain Sitecore folders', async () => {
    const nestedFiles = {
      'random/file.txt': { dir: false },
    };

    mockJSZip.mockImplementation(function (this: any) {
      this.loadAsync = vi.fn().mockResolvedValue(this);
      this.files = nestedFiles;
    });

    const data = {
      files: {
        'archive.zip': {
          dir: false,
          async: vi.fn().mockResolvedValue(Buffer.from('fake-zip')),
        },
      },
    };

    const result = await sitecoreValidator({ data });
    expect(result).toBe(false);
  });

  it('should handle error when processing nested zip fails', async () => {
    const data = {
      files: {
        'bad.zip': {
          dir: false,
          async: vi.fn().mockRejectedValue(new Error('corrupt zip')),
        },
      },
    };

    const result = await sitecoreValidator({ data });
    expect(result).toBe(false);
  });
});
