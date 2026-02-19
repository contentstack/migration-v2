import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/models/contentful.json', () => ({
  default: {
    contentTypes: { name: 'contentTypes', required: 'true' },
    entries: { name: 'entries', required: 'true' },
    assets: { name: 'assets', required: 'true' },
    locales: { name: 'locales', required: 'true' },
    editorInterfaces: { name: 'editorInterfaces', required: 'true' },
    tags: { name: 'tags', required: 'false' },
    webhooks: { name: 'webhooks', required: 'false' },
    roles: { name: 'roles', required: 'false' },
  },
}));

import contentfulValidator from '../../../src/validators/contentful/index';

describe('contentfulValidator', () => {
  it('should return true for valid JSON with all required properties', () => {
    const data = JSON.stringify({
      contentTypes: [],
      entries: [],
      assets: [],
      locales: [],
      editorInterfaces: [],
    });
    expect(contentfulValidator(data)).toBe(true);
  });

  it('should return true when optional properties are missing', () => {
    const data = JSON.stringify({
      contentTypes: [],
      entries: [],
      assets: [],
      locales: [],
      editorInterfaces: [],
    });
    expect(contentfulValidator(data)).toBe(true);
  });

  it('should return false when required property is missing', () => {
    const data = JSON.stringify({
      contentTypes: [],
      entries: [],
    });
    expect(contentfulValidator(data)).toBe(false);
  });

  it('should return false for invalid JSON string', () => {
    expect(contentfulValidator('not-json')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(contentfulValidator('')).toBe(false);
  });

  it('should return true when all required and optional properties present', () => {
    const data = JSON.stringify({
      contentTypes: [],
      entries: [],
      assets: [],
      locales: [],
      editorInterfaces: [],
      tags: [],
      webhooks: [],
      roles: [],
    });
    expect(contentfulValidator(data)).toBe(true);
  });

  it('should return false for null input', () => {
    expect(contentfulValidator(null as any)).toBe(false);
  });
});
