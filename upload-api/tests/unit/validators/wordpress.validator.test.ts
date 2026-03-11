import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/models/wordpress.json', () => ({
  default: {
    item: { name: 'item', required: 'true' },
    author: { name: 'wp\\:author', required: 'false' },
    category: { name: 'wp\\:category', required: 'false' },
  },
}));

import wordpressValidator from '../../../src/validators/wordpress/index';

describe('wordpressValidator', () => {
  it('should return true for valid WordPress XML with required tags', () => {
    const xml = '<rss><channel><item><title>Test</title></item></channel></rss>';
    expect(wordpressValidator(xml)).toBe(true);
  });

  it('should return false when required tag is missing', () => {
    const xml = '<rss><channel><category>Test</category></channel></rss>';
    expect(wordpressValidator(xml)).toBe(false);
  });

  it('should return true when optional tags are missing but required present', () => {
    const xml = '<rss><channel><item>Content</item></channel></rss>';
    expect(wordpressValidator(xml)).toBe(true);
  });

  it('should return false for empty XML', () => {
    expect(wordpressValidator('')).toBe(false);
  });

  it('should return false for invalid XML that causes error', () => {
    expect(wordpressValidator(null as any)).toBe(false);
  });

  it('should return false for non-XML string', () => {
    expect(wordpressValidator('not xml at all')).toBe(false);
  });
});
