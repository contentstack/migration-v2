import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENC_PREFIX = 'enc:';

function getEncryptKey(): string {
  const key = process.env.MANIFEST_ENCRYPT_KEY;
  if (!key) throw new Error('MANIFEST_ENCRYPT_KEY env variable is required to decrypt credentials');
  return key;
}

function getEncryptSalt(): string {
  const salt = process.env.MANIFEST_ENCRYPT_SALT;
  if (!salt) throw new Error('MANIFEST_ENCRYPT_SALT env variable is required to decrypt credentials');
  return salt;
}

export function decrypt(encryptedValue: string): string {
  if (!encryptedValue || !encryptedValue.startsWith(ENC_PREFIX)) return encryptedValue;
  const parts = encryptedValue.slice(ENC_PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted value format');
  const [ivHex, authTagHex, cipherHex] = parts;
  const key = crypto.scryptSync(getEncryptKey(), getEncryptSalt(), 32);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Decrypts sensitive fields in an app.json config object in-place and returns it.
 */
export function decryptAppConfig<T extends Record<string, any>>(config: T): T {
  if (config.oauthData) {
    if (config.oauthData.client_id) config.oauthData.client_id = decrypt(config.oauthData.client_id);
    if (config.oauthData.client_secret) config.oauthData.client_secret = decrypt(config.oauthData.client_secret);
  }
  if (config.pkce) {
    if (config.pkce.code_verifier) config.pkce.code_verifier = decrypt(config.pkce.code_verifier);
    if (config.pkce.code_challenge) config.pkce.code_challenge = decrypt(config.pkce.code_challenge);
  }
  return config;
}
