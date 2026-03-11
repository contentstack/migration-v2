import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSitecoreValidator, mockContentfulValidator, mockWordpressValidator, mockAemValidator, mockDrupalValidator } = vi.hoisted(() => ({
  mockSitecoreValidator: vi.fn(),
  mockContentfulValidator: vi.fn(),
  mockWordpressValidator: vi.fn(),
  mockAemValidator: vi.fn(),
  mockDrupalValidator: vi.fn(),
}));

vi.mock('migration-aem', () => ({ validator: vi.fn() }));
vi.mock('../../../src/validators/sitecore', () => ({ default: mockSitecoreValidator }));
vi.mock('../../../src/validators/contentful', () => ({ default: mockContentfulValidator }));
vi.mock('../../../src/validators/wordpress', () => ({ default: mockWordpressValidator }));
vi.mock('../../../src/validators/aem', () => ({ default: mockAemValidator }));
vi.mock('../../../src/validators/drupal', () => ({ default: mockDrupalValidator }));

import validator from '../../../src/validators/index';

describe('validators/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should dispatch to sitecore validator for sitecore-zip', () => {
    mockSitecoreValidator.mockReturnValue(true);
    const result = validator({ data: 'zipData', type: 'sitecore', extension: 'zip' });
    expect(mockSitecoreValidator).toHaveBeenCalledWith({ data: 'zipData' });
    expect(result).toBe(true);
  });

  it('should dispatch to contentful validator for contentful-json', () => {
    mockContentfulValidator.mockReturnValue(true);
    const result = validator({ data: '{"contentTypes":[]}', type: 'contentful', extension: 'json' });
    expect(mockContentfulValidator).toHaveBeenCalledWith('{"contentTypes":[]}');
    expect(result).toBe(true);
  });

  it('should dispatch to wordpress validator for wordpress-xml', () => {
    mockWordpressValidator.mockReturnValue(true);
    const result = validator({ data: '<xml/>', type: 'wordpress', extension: 'xml' });
    expect(mockWordpressValidator).toHaveBeenCalledWith('<xml/>');
    expect(result).toBe(true);
  });

  it('should dispatch to aem validator for aem-folder', () => {
    mockAemValidator.mockReturnValue(true);
    const result = validator({ data: '/path', type: 'aem', extension: 'folder' });
    expect(mockAemValidator).toHaveBeenCalledWith({ data: '/path' });
    expect(result).toBe(true);
  });

  it('should dispatch to drupal validator for drupal-sql', () => {
    const assetsConfig = { base_url: 'http://test.com', public_path: '/files' };
    mockDrupalValidator.mockReturnValue({ success: true });
    const result = validator({ data: {}, type: 'drupal', extension: 'sql', assetsConfig });
    expect(mockDrupalValidator).toHaveBeenCalledWith({ data: {}, assetsConfig });
    expect(result).toEqual({ success: true });
  });

  it('should return false for unknown CMS type', () => {
    const result = validator({ data: 'data', type: 'unknown', extension: 'txt' });
    expect(result).toBe(false);
  });

  it('should return false for empty type and extension', () => {
    const result = validator({ data: 'data', type: '', extension: '' });
    expect(result).toBe(false);
  });
});
