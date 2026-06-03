import fs from 'fs';
import path from 'path';

export type UploadApiConfig = {
  plan: { dropdown: { optionLimit: number } };
  cmsType: string;
  isLocalPath: boolean;
  awsData: {
    awsRegion: string;
    awsAccessKeyId: string;
    awsSecretAccessKey: string;
    awsSessionToken: string;
    bucketName: string;
    bucketKey: string;
  };
  mysql: {
    host: string;
    user: string;
    password: string;
    database: string;
    port: string;
  };
  assetsConfig: {
    base_url: string;
    public_path: string;
  };
  localPath: string;
};

/** True when env provides a non-empty string (after trim). */
export function hasEnvValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/** Use env only when set; otherwise keep the existing JSON value. */
export function pickEnvOrExisting(envValue: string | undefined, existing: string): string {
  return hasEnvValue(envValue) ? envValue!.trim() : existing;
}

/** True when this Node process runs inside a Linux container (upload-api Docker image). */
export function runningInDocker(): boolean {
  try {
    return fs.existsSync('/.dockerenv');
  } catch {
    return false;
  }
}

/**
 * Resolves MySQL host from env when MYSQL_HOST is set.
 * Inside Docker, localhost/127.0.0.1 map to host.docker.internal.
 */
export function mysqlHostFromEnv(rawHost: string): string {
  const raw = rawHost.trim();
  if (runningInDocker() && (/^localhost$/i.test(raw) || raw === '127.0.0.1')) {
    return 'host.docker.internal';
  }
  return raw;
}

export function getConfigFilePaths(cwd: string = process.cwd()): {
  src: string;
  build: string;
} {
  return {
    src: path.join(cwd, 'src', 'config', 'index.json'),
    build: path.join(cwd, 'build', 'config', 'index.json')
  };
}

/**
 * Merges environment variables into config. Only fields with a non-empty env value
 * are overwritten so manual edits in index.json are preserved.
 *
 * Exception: mysql.host. When MYSQL_HOST is absent but the process runs inside Docker,
 * the host falls back to host.docker.internal (the JSON placeholder is non-functional
 * inside a container). Outside Docker the JSON value is kept untouched.
 */
export function mergeConfigFromEnv(config: UploadApiConfig): UploadApiConfig {
  const merged: UploadApiConfig = {
    ...config,
    cmsType: pickEnvOrExisting(process.env.CMS_TYPE, config.cmsType),
    localPath: pickEnvOrExisting(
      process.env.CMS_LOCAL_PATH || process.env.CONTAINER_PATH,
      config.localPath
    ),
    mysql: {
      ...config.mysql,
      user: pickEnvOrExisting(process.env.MYSQL_USER, config.mysql.user),
      password: pickEnvOrExisting(process.env.MYSQL_PASSWORD, config.mysql.password),
      database: pickEnvOrExisting(process.env.MYSQL_DATABASE, config.mysql.database),
      port: pickEnvOrExisting(process.env.MYSQL_PORT, config.mysql.port),
      host: config.mysql.host
    },
    assetsConfig: {
      ...config.assetsConfig,
      base_url: pickEnvOrExisting(process.env.DRUPAL_ASSETS_BASE_URL, config.assetsConfig.base_url),
      public_path: pickEnvOrExisting(
        process.env.DRUPAL_ASSETS_PUBLIC_PATH,
        config.assetsConfig.public_path
      )
    }
  };

  if (hasEnvValue(process.env.MYSQL_HOST)) {
    merged.mysql.host = mysqlHostFromEnv(process.env.MYSQL_HOST!);
  } else if (runningInDocker()) {
    // No MYSQL_HOST provided but running in Docker: the JSON placeholder
    // ("host_name") is non-functional, so fall back to host.docker.internal
    // to reach a MySQL server on the host machine (restores pre-refactor behavior).
    merged.mysql.host = 'host.docker.internal';
  }
  // else: local (non-Docker) with no env value → keep the JSON value as-is.

  return merged;
}

/** Returns true when env-driven fields differ from the loaded config. */
export function configNeedsHydration(before: UploadApiConfig, after: UploadApiConfig): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

async function syncBuildConfig(srcPath: string, buildPath: string): Promise<void> {
  const buildDir = path.dirname(buildPath);
  if (!fs.existsSync(buildDir)) {
    return;
  }
  await fs.promises.mkdir(buildDir, { recursive: true });
  await fs.promises.copyFile(srcPath, buildPath);
}

/**
 * Reads index.json, applies env overrides (only when env is set), writes back when changed,
 * and syncs to build/config/index.json when that directory exists.
 */
export async function hydrateConfig(cwd: string = process.cwd()): Promise<UploadApiConfig> {
  const { src, build } = getConfigFilePaths(cwd);
  const raw = await fs.promises.readFile(src, 'utf8');
  const config = JSON.parse(raw) as UploadApiConfig;
  const merged = mergeConfigFromEnv(config);

  if (configNeedsHydration(config, merged)) {
    await fs.promises.writeFile(src, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  }

  await syncBuildConfig(src, build);
  return merged;
}

/** Synchronous hydrate for scripts that cannot use async bootstrap. */
export function hydrateConfigSync(cwd: string = process.cwd()): UploadApiConfig {
  const { src, build } = getConfigFilePaths(cwd);
  const raw = fs.readFileSync(src, 'utf8');
  const config = JSON.parse(raw) as UploadApiConfig;
  const merged = mergeConfigFromEnv(config);

  if (configNeedsHydration(config, merged)) {
    fs.writeFileSync(src, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  }

  const buildDir = path.dirname(build);
  if (fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir, { recursive: true });
    fs.copyFileSync(src, build);
  }

  return merged;
}
