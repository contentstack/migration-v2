import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  hasEnvValue,
  pickEnvOrExisting,
  mysqlHostFromEnv,
  mergeConfigFromEnv,
  hydrateConfig,
  runningInDocker,
  type UploadApiConfig
} from '../../../src/utils/hydrate-config';

const baseConfig: UploadApiConfig = {
  plan: { dropdown: { optionLimit: 100 } },
  cmsType: 'drupal',
  isLocalPath: true,
  awsData: {
    awsRegion: 'us-east-2',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsSessionToken: '',
    bucketName: '',
    bucketKey: ''
  },
  mysql: {
    host: 'db.example.com',
    user: 'manual_user',
    password: 'manual_pass',
    database: 'manual_db',
    port: '3306'
  },
  assetsConfig: {
    base_url: 'https://manual.example',
    public_path: 'sites/default/files'
  },
  localPath: '/data/manual'
};

describe('hydrate-config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CMS_TYPE;
    delete process.env.CMS_LOCAL_PATH;
    delete process.env.CONTAINER_PATH;
    delete process.env.MYSQL_HOST;
    delete process.env.MYSQL_USER;
    delete process.env.MYSQL_PASSWORD;
    delete process.env.MYSQL_DATABASE;
    delete process.env.MYSQL_PORT;
    delete process.env.DRUPAL_ASSETS_BASE_URL;
    delete process.env.DRUPAL_ASSETS_PUBLIC_PATH;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('hasEnvValue rejects empty and whitespace', () => {
    expect(hasEnvValue(undefined)).toBe(false);
    expect(hasEnvValue('')).toBe(false);
    expect(hasEnvValue('   ')).toBe(false);
    expect(hasEnvValue('drupal')).toBe(true);
  });

  it('pickEnvOrExisting keeps existing when env is missing', () => {
    expect(pickEnvOrExisting(undefined, 'manual')).toBe('manual');
    expect(pickEnvOrExisting('', 'manual')).toBe('manual');
    expect(pickEnvOrExisting('from-env', 'manual')).toBe('from-env');
  });

  it('mergeConfigFromEnv preserves manual json when env is empty', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const merged = mergeConfigFromEnv(baseConfig);
    expect(merged).toEqual(baseConfig);
    vi.restoreAllMocks();
  });

  it('mergeConfigFromEnv applies only set env vars', () => {
    process.env.CMS_TYPE = 'wordpress';
    process.env.MYSQL_USER = 'env_user';

    const merged = mergeConfigFromEnv(baseConfig);
    expect(merged.cmsType).toBe('wordpress');
    expect(merged.mysql.user).toBe('env_user');
    expect(merged.mysql.host).toBe('db.example.com');
    expect(merged.mysql.password).toBe('manual_pass');
    expect(merged.localPath).toBe('/data/manual');
  });

  it('mysqlHostFromEnv maps localhost to host.docker.internal in Docker', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === '/.dockerenv');
    expect(mysqlHostFromEnv('localhost')).toBe('host.docker.internal');
    expect(mysqlHostFromEnv('127.0.0.1')).toBe('host.docker.internal');
    expect(mysqlHostFromEnv('db.example.com')).toBe('db.example.com');
    vi.restoreAllMocks();
  });

  it('mergeConfigFromEnv keeps mysql host without MYSQL_HOST env when not in Docker', () => {
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    const merged = mergeConfigFromEnv(baseConfig);
    expect(merged.mysql.host).toBe('db.example.com');
    vi.restoreAllMocks();
  });

  it('mergeConfigFromEnv falls back to host.docker.internal without MYSQL_HOST env when in Docker', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === '/.dockerenv');
    const merged = mergeConfigFromEnv(baseConfig);
    expect(merged.mysql.host).toBe('host.docker.internal');
    vi.restoreAllMocks();
  });

  it('mergeConfigFromEnv rewrites the host_name placeholder to host.docker.internal in Docker', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === '/.dockerenv');
    const placeholderConfig = {
      ...baseConfig,
      mysql: { ...baseConfig.mysql, host: 'host_name' }
    };
    const merged = mergeConfigFromEnv(placeholderConfig);
    expect(merged.mysql.host).toBe('host.docker.internal');
    vi.restoreAllMocks();
  });

  it('mergeConfigFromEnv applies MYSQL_HOST with docker localhost rewrite', () => {
    vi.spyOn(fs, 'existsSync').mockImplementation((p) => p === '/.dockerenv');
    process.env.MYSQL_HOST = 'localhost';
    const merged = mergeConfigFromEnv(baseConfig);
    expect(merged.mysql.host).toBe('host.docker.internal');
    vi.restoreAllMocks();
  });

  it('hydrateConfig writes file only when env provides changes', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hydrate-config-'));
    const configDir = path.join(tmpDir, 'src', 'config');
    fs.mkdirSync(configDir, { recursive: true });
    const configPath = path.join(configDir, 'index.json');
    fs.writeFileSync(configPath, JSON.stringify(baseConfig, null, 2));

    const beforeMtime = fs.statSync(configPath).mtimeMs;
    await new Promise((r) => setTimeout(r, 5));
    await hydrateConfig(tmpDir);

    const afterMtime = fs.statSync(configPath).mtimeMs;
    const onDisk = JSON.parse(fs.readFileSync(configPath, 'utf8')) as UploadApiConfig;
    expect(onDisk).toEqual(baseConfig);
    expect(afterMtime).toBe(beforeMtime);

    process.env.MYSQL_USER = 'env_only_user';
    await hydrateConfig(tmpDir);
    const updated = JSON.parse(fs.readFileSync(configPath, 'utf8')) as UploadApiConfig;
    expect(updated.mysql.user).toBe('env_only_user');
    expect(updated.mysql.host).toBe('db.example.com');

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runningInDocker checks /.dockerenv', () => {
    const existsSpy = vi.spyOn(fs, 'existsSync');
    existsSpy.mockReturnValue(true);
    expect(runningInDocker()).toBe(true);
    existsSpy.mockReturnValue(false);
    expect(runningInDocker()).toBe(false);
    vi.restoreAllMocks();
  });
});
