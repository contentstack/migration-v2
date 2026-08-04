import crypto from "crypto";

/**
 * Symmetric encryption for the one credential v3 stores at rest: the destination
 * stack's management-token secret.
 *
 * ── Why this exists rather than importing v2's `src/utils/crypto.utils`
 * That module exports only `decrypt` — v2 encrypts its manifest credentials
 * out-of-band with a script — and `api/v3` imports nothing from `api/src` by
 * design. The stored WIRE FORMAT here is deliberately identical to v2's, so an
 * operator debugging either store reads one format:
 *
 *     enc:<ivHex>:<authTagHex>:<ciphertextHex>
 *
 * ── Why a dedicated key, not APP_TOKEN_KEY
 * APP_TOKEN_KEY signs session JWTs. A signing key and an encryption key have
 * different rotation lifetimes; sharing one means rotating it to fix either
 * concern silently invalidates every live session, and a leak of one becomes a
 * leak of both.
 *
 * ── What this protects against, honestly
 * The key lives in an env var on the same host as `database-v3/projects.json`, so
 * this does not stop an attacker who already has the machine — they have the key
 * too. What it does stop is accidental disclosure: opening the file, pasting a
 * log, sharing a screen, force-adding the store to git. That is where credentials
 * actually leak, so it is worth doing; it is not a vault.
 *
 * ── AES-256-GCM, not CBC
 * GCM is authenticated: a tampered record fails loudly instead of decrypting to a
 * corrupted value that would then be sent to Contentstack as a credential.
 */
const ALGORITHM = "aes-256-gcm";
const ENC_PREFIX = "enc:";
const KEY_ENV = "V3_SECRET_ENCRYPT_KEY";
const SALT_ENV = "V3_SECRET_ENCRYPT_SALT";

/** A 500-carrying error, so asyncRouter's middleware maps it without a cast. */
const configError = (message: string): Error & { status: number } => {
  const err = new Error(message) as Error & { status: number };
  err.status = 500;
  return err;
};

/**
 * Read at call time, never at module load, so the process does not have to be
 * restarted for a config change and so tests can stub the env.
 */
const keyMaterial = (): { key: string; salt: string } => {
  const key = process.env[KEY_ENV];
  const salt = process.env[SALT_ENV];
  if (!key) {
    throw configError(
      `${KEY_ENV} is not set. The destination management-token secret cannot be stored without it.`
    );
  }
  if (!salt) {
    throw configError(
      `${SALT_ENV} is not set. The destination management-token secret cannot be stored without it.`
    );
  }
  return { key, salt };
};

/**
 * Throws if this server cannot encrypt. Call it BEFORE minting a token.
 *
 * The ordering is the point. A token created on a server that then cannot store
 * its secret is a permanent (`is_never_expires: true`) write credential on the
 * customer's stack that nothing in this tool can use or revoke. Checking first is
 * the only outcome that leaves no residue.
 */
export const assertSecretEncryptionConfigured = (): void => {
  keyMaterial();
};

/**
 * Encrypts a secret for storage. Throws rather than returning the input if the
 * server is unconfigured or the secret is empty.
 *
 * There is deliberately NO plaintext fallback. v2's `sso.utils.js` answers a
 * missing key by warning and writing the credential in the clear
 * ("WARNING: MANIFEST_ENCRYPT_KEY not set — app.json will contain plaintext
 * credentials"); a warning on stdout is not a control. A misconfigured server
 * must fail, not quietly downgrade.
 */
export const encryptSecret = (plaintext: string): string => {
  // Checked before the key so an empty secret is reported as an empty secret even
  // on an unconfigured host.
  if (!plaintext?.trim()) {
    throw new Error("Refusing to encrypt an empty secret.");
  }
  const { key, salt } = keyMaterial();

  const derived = crypto.scryptSync(key, salt, 32);
  // A fresh IV per value: a fixed one would make identical secrets produce
  // identical ciphertext, leaking that two projects share a token.
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, derived, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  return [
    ENC_PREFIX + iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    ciphertext.toString("hex"),
  ].join(":");
};

/**
 * Decrypts a stored secret. Used by the later Migrate step, which is the only
 * thing that needs the plaintext.
 *
 * An unprefixed value throws rather than being passed through. This diverges from
 * v2's `decrypt`, whose pass-through is correct for a store that legitimately
 * predates encryption. v3 has no such history: every secret is encrypted on the
 * way in, so an unprefixed value means something wrote a plaintext credential —
 * a bug to surface, not to tolerate.
 */
export const decryptSecret = (stored: string): string => {
  if (!stored?.startsWith(ENC_PREFIX)) {
    throw new Error(
      "Stored secret is not encrypted. Refusing to read a plaintext credential."
    );
  }
  const parts = stored.slice(ENC_PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("Stored secret could not be decrypted: malformed value.");
  }
  const [ivHex, authTagHex, cipherHex] = parts;
  const { key, salt } = keyMaterial();

  try {
    const derived = crypto.scryptSync(key, salt, 32);
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      derived,
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    return (
      decipher.update(cipherHex, "hex", "utf8") + decipher.final("utf8")
    );
  } catch {
    // Covers a tampered ciphertext, a tampered auth tag, and a changed key. The
    // cause is deliberately not distinguished: telling a caller WHICH part failed
    // is an oracle, and the remedy is the same either way.
    throw new Error(
      "Stored secret could not be decrypted. It may have been tampered with, or the encryption key has changed."
    );
  }
};
