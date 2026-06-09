import fs from 'fs';

/** True when this Node process runs inside a Linux container (upload-api Docker image). */
function runningInDocker(): boolean {
  try {
    return fs.existsSync('/.dockerenv');
  } catch {
    return false;
  }
}

/**
 * MySQL host from env. Inside Docker, localhost refer to the container, not the host,
 * so we use host.docker.internal to reach MySQL on the machine.
 */
function mysqlHostFromEnv(): string {
  const raw = (process.env.MYSQL_HOST || '').trim();
  if (!raw) {
    return runningInDocker() ? 'host.docker.internal' : 'host_name';
  }
  if (runningInDocker() && (/^localhost$/i.test(raw) || raw === '127.0.0.1')) {
    return 'host.docker.internal';
  }
  return raw;
}

export default {
  plan: {
    dropdown: { optionLimit: 100 }
  },
  // CMS type configuration
  cmsType: process.env.CMS_TYPE || 'sanity',
  isLocalPath: true,

  // AWS data configuration
  awsData: {
    awsRegion: 'us-east-2',
    awsAccessKeyId: '',
    awsSecretAccessKey: '',
    awsSessionToken: '',
    bucketName: '',
    bucketKey: ''
  },

  // Drupal database configuration
  mysql: {
    host: mysqlHostFromEnv(),
    user: process.env.MYSQL_USER || 'user_name',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'database_name',
    port: process.env.MYSQL_PORT || 'port_number'
  },

  // Drupal assets configuration
  assetsConfig: {
    base_url: process.env.DRUPAL_ASSETS_BASE_URL || 'drupal_assets_base_url',
    public_path: process.env.DRUPAL_ASSETS_PUBLIC_PATH || 'drupal_assets_public_path'
  },

  // Local path for the CMS data
  localPath: process.env.CMS_LOCAL_PATH || process.env.CONTAINER_PATH || '/Users/umesh.more/Documents/sanity/backup-export.tar.gz',
};
