import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('config/index', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should export config with expected keys', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('APP_TOKEN_KEY', 'my-secret');
    vi.stubEnv('PORT', '3000');
    vi.stubEnv('FILE_UPLOAD_KEY', 'upload-key');

    const { config } = await import('../../../src/config/index.js');

    expect(config).toBeDefined();
    expect(config.APP_TOKEN_EXP).toBe('2d');
    expect(config.CS_API).toBeDefined();
    expect(config.CS_URL).toBeDefined();
  });

  it('should have APP_TOKEN_EXP set to 2d', async () => {
    const { config } = await import('../../../src/config/index.js');
    expect(config.APP_TOKEN_EXP).toBe('2d');
  });

  it('should have CS_API with region keys', async () => {
    const { config } = await import('../../../src/config/index.js');
    expect(config.CS_API).toHaveProperty('NA');
    expect(config.CS_API).toHaveProperty('EU');
    expect(config.CS_API).toHaveProperty('AZURE_NA');
  });
});
