import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * TDD — v3 secret.util: symmetric encryption for the one credential v3 stores,
 * the destination stack's management-token secret.
 *
 * Why v3 has its own helper rather than importing v2's `src/utils/crypto.utils`:
 * that module exports only `decrypt` (v2 encrypts credentials out-of-band with a
 * script), and api/v3 imports nothing from api/src by design. The stored WIRE
 * FORMAT is deliberately identical to v2's — `enc:<iv>:<authTag>:<ciphertext>` —
 * so an operator debugging either store reads one format, not two.
 *
 * The key is a DEDICATED pair of env vars, never the `APP_TOKEN_KEY` used to sign
 * session JWTs: a signing key and an encryption key have different rotation
 * lifetimes, and rotating one to fix the other would silently break sessions.
 *
 * The env is read inside each call rather than at module load, so `vi.stubEnv`
 * works without a module reset.
 */
const KEY = "V3_SECRET_ENCRYPT_KEY";
const SALT = "V3_SECRET_ENCRYPT_SALT";

const importUtil = async () => await import("../../../../v3/utils/secret.util.js");

/*
  Re-stubbed per test rather than unstubbed: `tests/setup.ts` sets several env
  vars in a `beforeAll`, and `vi.unstubAllEnvs()` would clear those too. Stubbing
  again is enough — it overrides whatever the previous test left behind.
*/
beforeEach(() => {
  vi.stubEnv(KEY, "unit-test-key");
  vi.stubEnv(SALT, "unit-test-salt");
});

describe("v3 secret.util — encrypt/decrypt round trip", () => {
  it("(round-trip, positive) an encrypted secret is recoverable verbatim and the ciphertext does not contain it", async () => {
    const { encryptSecret, decryptSecret } = await importUtil();
    const plaintext = "cs-management-token-secret-value";

    const stored = encryptSecret(plaintext);

    // The stored form must be recognisably encrypted and structurally complete:
    // prefix plus exactly three colon-separated hex parts (iv, auth tag, cipher).
    expect(stored.startsWith("enc:")).toBe(true);
    expect(stored.slice(4).split(":")).toHaveLength(3);
    // The whole point: reading the file must not reveal the credential.
    expect(stored).not.toContain(plaintext);

    expect(decryptSecret(stored)).toBe(plaintext);
  });

  /*
    Negative — taxonomy #2 (invalid shape): a stored value whose ciphertext has
    been altered must be REJECTED, not decrypted to something else. This is the
    property AES-GCM's auth tag buys us, and it is the reason for choosing GCM
    over CBC: a tampered record fails loudly instead of yielding a corrupted
    secret that would then be sent to Contentstack as a credential.
  */
  it("(round-trip, negative) a tampered ciphertext throws rather than returning a wrong value", async () => {
    const { encryptSecret, decryptSecret } = await importUtil();
    const stored = encryptSecret("cs-management-token-secret-value");

    const [prefix, iv, authTag, cipher] = stored.split(":");
    // Flip the final hex nibble of the ciphertext, leaving the shape intact.
    const flipped = cipher.slice(0, -1) + (cipher.slice(-1) === "0" ? "1" : "0");
    const tampered = [prefix, iv, authTag, flipped].join(":");

    expect(() => decryptSecret(tampered)).toThrow(/could not be decrypted/i);
  });
});

describe("v3 secret.util — per-value IV", () => {
  it("(iv, positive) encrypting the same secret twice yields different stored values that both decrypt", async () => {
    const { encryptSecret, decryptSecret } = await importUtil();
    const plaintext = "same-secret";

    const a = encryptSecret(plaintext);
    const b = encryptSecret(plaintext);

    // A fixed IV would make identical secrets produce identical ciphertext,
    // leaking that two projects share a token.
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(plaintext);
    expect(decryptSecret(b)).toBe(plaintext);
  });

  /*
    Negative — taxonomy #1 (missing/empty input): encrypting an empty secret is
    refused. An empty string encrypts perfectly well, which is precisely the
    danger — it would be stored as a valid-looking `enc:…` value and only fail at
    migrate time, long after the point where the mistake could be corrected.
  */
  it("(iv, negative) encrypting an empty secret is refused rather than stored as a valid-looking value", async () => {
    const { encryptSecret } = await importUtil();

    expect(() => encryptSecret("")).toThrow(/refusing to encrypt an empty secret/i);
    expect(() => encryptSecret("   ")).toThrow(/refusing to encrypt an empty secret/i);
  });
});

describe("v3 secret.util — configuration", () => {
  it("(config, positive) assertSecretEncryptionConfigured returns normally when both env vars are set", async () => {
    const { assertSecretEncryptionConfigured } = await importUtil();

    expect(() => assertSecretEncryptionConfigured()).not.toThrow();
  });

  /*
    Negative — taxonomy #1 (missing configuration): with the key absent, the
    assertion throws a 500-carrying error that NAMES the missing variable, and
    `encryptSecret` throws too.

    The second assertion is the load-bearing one. v2's sso.utils.js answers a
    missing key by warning and writing the credential in PLAINTEXT
    (`WARNING: MANIFEST_ENCRYPT_KEY not set — app.json will contain plaintext
    credentials`). v3 must not do that: a misconfigured server has to fail, not
    quietly downgrade to storing a live write credential in the clear.
  */
  it("(config, negative) a missing key throws a 500 naming the variable and never falls back to plaintext", async () => {
    vi.stubEnv(KEY, "");
    const { assertSecretEncryptionConfigured, encryptSecret } = await importUtil();

    expect(() => assertSecretEncryptionConfigured()).toThrow(/V3_SECRET_ENCRYPT_KEY/);
    try {
      assertSecretEncryptionConfigured();
      expect.unreachable("expected a throw");
    } catch (e: any) {
      expect(e.status).toBe(500);
    }

    // No plaintext fallback: it throws, rather than returning the secret as-is.
    expect(() => encryptSecret("cs-secret")).toThrow(/V3_SECRET_ENCRYPT_KEY/);
  });
});

describe("v3 secret.util — rejecting unencrypted stored values", () => {
  it("(prefix, positive) a value carrying the enc: prefix written by this util decrypts", async () => {
    const { encryptSecret, decryptSecret } = await importUtil();

    expect(decryptSecret(encryptSecret("round-trips"))).toBe("round-trips");
  });

  /*
    Negative — taxonomy #2 (invalid shape): a stored value WITHOUT the prefix
    throws instead of being passed through.

    This is a deliberate divergence from v2's `decrypt`, which returns any
    non-prefixed value unchanged. That pass-through is safe for v2, whose store
    legitimately predates encryption. For v3 there is no such history: every
    secret is encrypted on the way in, so an unprefixed value means something
    wrote a plaintext credential — a bug to surface, not to tolerate.
  */
  it("(prefix, negative) an unprefixed stored value throws instead of being passed through as plaintext", async () => {
    const { decryptSecret } = await importUtil();

    expect(() => decryptSecret("cs-plaintext-secret")).toThrow(/not encrypted/i);
    expect(() => decryptSecret("")).toThrow(/not encrypted/i);
  });
});
