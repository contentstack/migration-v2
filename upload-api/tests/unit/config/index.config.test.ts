import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('config/index', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should export default configuration object', async () => {
    const config = (await import('../../../src/config/index.json')).default;

    expect(config).toHaveProperty('plan');
    expect(config).toHaveProperty('cmsType');
    expect(config).toHaveProperty('isLocalPath');
    expect(config).toHaveProperty('awsData');
    expect(config).toHaveProperty('mysql');
    expect(config).toHaveProperty('assetsConfig');
    expect(config).toHaveProperty('localPath');
  });

  it('should have plan with dropdown optionLimit', async () => {
    const config = (await import('../../../src/config/index.json')).default;
    expect(config.plan.dropdown.optionLimit).toBe(100);
  });

  it('should have isLocalPath as true', async () => {
    const config = (await import('../../../src/config/index.json')).default;
    expect(config.isLocalPath).toBe(true);
  });


  it('should have default AWS data', async () => {
    const config = (await import('../../../src/config/index.json')).default;
    expect(config.awsData).toEqual({
      awsRegion: 'us-east-2',
      awsAccessKeyId: '',
      awsSecretAccessKey: '',
      awsSessionToken: '',
      bucketName: '',
      bucketKey: '',
    });
  });

  it('should have default MySQL configuration', async () => {
    const config = (await import('../../../src/config/index.json')).default;
    expect(config.mysql.host).toBe('host_name');
    expect(config.mysql.user).toBe('user_name');
    expect(config.mysql.database).toBe('database_name');
  });
});
