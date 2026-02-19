import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockCreateSitecoreMapper, mockCreateContentfulMapper,
  mockCreateWordpressMapper, mockCreateAemMapper, mockCreateDrupalMapper,
  mockDeleteFolderSync, mockReaddirSync, mockExistsSync, mockStatSync,
} = vi.hoisted(() => ({
  mockCreateSitecoreMapper: vi.fn(),
  mockCreateContentfulMapper: vi.fn(),
  mockCreateWordpressMapper: vi.fn(),
  mockCreateAemMapper: vi.fn(),
  mockCreateDrupalMapper: vi.fn(),
  mockDeleteFolderSync: vi.fn(),
  mockReaddirSync: vi.fn().mockReturnValue([]),
  mockExistsSync: vi.fn().mockReturnValue(false),
  mockStatSync: vi.fn().mockReturnValue({ isDirectory: () => false }),
}));

vi.mock('../../../src/controllers/sitecore', () => ({ default: mockCreateSitecoreMapper }));
vi.mock('../../../src/services/contentful', () => ({ default: mockCreateContentfulMapper }));
vi.mock('../../../src/controllers/wordpress', () => ({ default: mockCreateWordpressMapper }));
vi.mock('../../../src/controllers/aem', () => ({ createAemMapper: mockCreateAemMapper }));
vi.mock('../../../src/services/drupal', () => ({ default: mockCreateDrupalMapper }));
vi.mock('../../../src/helper', () => ({
  deleteFolderSync: mockDeleteFolderSync,
  fileOperationLimiter: vi.fn(),
}));
vi.mock('../../../src/utils/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('fs', () => ({
  default: {
    readdirSync: (...a: any[]) => mockReaddirSync(...a),
    existsSync: (...a: any[]) => mockExistsSync(...a),
    statSync: (...a: any[]) => mockStatSync(...a),
  },
  readdirSync: (...a: any[]) => mockReaddirSync(...a),
  existsSync: (...a: any[]) => mockExistsSync(...a),
  statSync: (...a: any[]) => mockStatSync(...a),
}));

import createMapper from '../../../src/services/createMapper';

describe('createMapper', () => {
  const defaultConfig: any = { cmsType: 'wordpress', localPath: '/tmp/test' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReaddirSync.mockReturnValue([]);
    mockExistsSync.mockReturnValue(false);
    mockStatSync.mockReturnValue({ isDirectory: () => false });
  });

  it('should dispatch to sitecore mapper', async () => {
    mockCreateSitecoreMapper.mockResolvedValue('sitecore-result');
    const config = { ...defaultConfig, cmsType: 'sitecore' };
    const result = await createMapper('/path', 'proj-1', 'token', 'csm', config);
    expect(mockCreateSitecoreMapper).toHaveBeenCalledWith('/path', 'proj-1', 'token', 'csm', config);
    expect(result).toBe('sitecore-result');
  });

  it('should dispatch to contentful mapper', async () => {
    mockCreateContentfulMapper.mockResolvedValue('contentful-result');
    const config = { ...defaultConfig, cmsType: 'contentful' };
    const result = await createMapper('/path', 'proj-1', 'token', 'csm', config);
    expect(mockCreateContentfulMapper).toHaveBeenCalledWith('proj-1', 'token', 'csm', config);
    expect(result).toBe('contentful-result');
  });

  it('should dispatch to wordpress mapper', async () => {
    mockCreateWordpressMapper.mockResolvedValue('wordpress-result');
    const config = { ...defaultConfig, cmsType: 'wordpress' };
    const result = await createMapper('/path', 'proj-1', 'token', 'csm', config);
    expect(mockCreateWordpressMapper).toHaveBeenCalledWith('/path', 'proj-1', 'token', 'csm', config);
    expect(result).toBe('wordpress-result');
  });

  it('should dispatch to aem mapper', async () => {
    mockCreateAemMapper.mockResolvedValue('aem-result');
    const config = { ...defaultConfig, cmsType: 'aem' };
    const result = await createMapper('/path', 'proj-1', 'token', 'csm', config);
    expect(mockCreateAemMapper).toHaveBeenCalledWith('/path', 'proj-1', 'token', 'csm');
    expect(result).toBe('aem-result');
  });

  it('should dispatch to drupal mapper', async () => {
    mockCreateDrupalMapper.mockResolvedValue('drupal-result');
    const config = { ...defaultConfig, cmsType: 'drupal' };
    const result = await createMapper('/path', 'proj-1', 'token', 'csm', config);
    expect(mockCreateDrupalMapper).toHaveBeenCalledWith(config, 'proj-1', 'token', 'csm');
    expect(result).toBe('drupal-result');
  });

  it('should return false for unknown CMS type', async () => {
    const config = { ...defaultConfig, cmsType: 'unknown' };
    const result = await createMapper('/path', 'proj-1', 'token', 'csm', config);
    expect(result).toBe(false);
  });

  it('should handle case-insensitive CMS types', async () => {
    mockCreateWordpressMapper.mockResolvedValue('ok');
    const config = { ...defaultConfig, cmsType: 'WordPress' };
    const result = await createMapper('/path', 'proj-1', 'token', 'csm', config);
    expect(mockCreateWordpressMapper).toHaveBeenCalled();
    expect(result).toBe('ok');
  });

  describe('clearAllMigrationData', () => {
    it('should delete folders ending with MigrationData', async () => {
      mockReaddirSync.mockReturnValue(['sitecoreMigrationData', 'drupalMigrationData', 'other']);
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isDirectory: () => true });

      mockCreateWordpressMapper.mockResolvedValue(undefined);
      await createMapper('/path', 'proj-1', 'token', 'csm', defaultConfig);

      expect(mockDeleteFolderSync).toHaveBeenCalledTimes(2);
      expect(mockDeleteFolderSync).toHaveBeenCalledWith(expect.stringContaining('sitecoreMigrationData'));
      expect(mockDeleteFolderSync).toHaveBeenCalledWith(expect.stringContaining('drupalMigrationData'));
    });

    it('should skip non-directory items', async () => {
      mockReaddirSync.mockReturnValue(['contentfulMigrationData']);
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isDirectory: () => false });

      mockCreateWordpressMapper.mockResolvedValue(undefined);
      await createMapper('/path', 'proj-1', 'token', 'csm', defaultConfig);

      expect(mockDeleteFolderSync).not.toHaveBeenCalled();
    });

    it('should handle no migration folders', async () => {
      mockReaddirSync.mockReturnValue(['src', 'node_modules', 'package.json']);

      mockCreateWordpressMapper.mockResolvedValue(undefined);
      await createMapper('/path', 'proj-1', 'token', 'csm', defaultConfig);

      expect(mockDeleteFolderSync).not.toHaveBeenCalled();
    });

    it('should handle delete error gracefully', async () => {
      mockReaddirSync.mockReturnValue(['sitecoreMigrationData']);
      mockExistsSync.mockReturnValue(true);
      mockStatSync.mockReturnValue({ isDirectory: () => true });
      mockDeleteFolderSync.mockImplementation(() => { throw new Error('delete err'); });

      mockCreateWordpressMapper.mockResolvedValue(undefined);
      await createMapper('/path', 'proj-1', 'token', 'csm', defaultConfig);
    });

    it('should handle readdirSync error gracefully', async () => {
      mockReaddirSync.mockImplementation(() => { throw new Error('read err'); });

      mockCreateWordpressMapper.mockResolvedValue(undefined);
      await createMapper('/path', 'proj-1', 'token', 'csm', defaultConfig);
    });
  });
});
