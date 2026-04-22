import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('crypto.utils', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env.MANIFEST_ENCRYPT_KEY = 'test-key-32-chars-long-string!!';
    process.env.MANIFEST_ENCRYPT_SALT = 'testsalt';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('decrypt returns plain values unchanged when not prefixed', async () => {
    const { decrypt } = await import('../../../src/utils/crypto.utils.js');
    expect(decrypt('plain')).toBe('plain');
    expect(decrypt('')).toBe('');
    expect(decrypt('   no-enc-prefix')).toBe('   no-enc-prefix');
  });

  it('decryptAppConfig returns config unchanged when oauthData/pkce absent', async () => {
    const { decryptAppConfig } = await import('../../../src/utils/crypto.utils.js');
    const cfg = { foo: 'bar' };
    expect(decryptAppConfig(cfg)).toBe(cfg);
  });

  it('getEncryptKey throws when MANIFEST_ENCRYPT_KEY missing', async () => {
    vi.resetModules();
    delete process.env.MANIFEST_ENCRYPT_KEY;
    process.env.MANIFEST_ENCRYPT_SALT = 'testsalt';
    const { decrypt } = await import('../../../src/utils/crypto.utils.js');
    expect(() => decrypt('enc:00112233445566778899aabb:00112233445566778899aabb:445566')).toThrow(
      'MANIFEST_ENCRYPT_KEY'
    );
  });

  it('decrypt throws on invalid enc: format (wrong segment count)', async () => {
    const { decrypt } = await import('../../../src/utils/crypto.utils.js');
    expect(() => decrypt('enc:only:two')).toThrow('Invalid encrypted value format');
  });

  it('getEncryptSalt throws when MANIFEST_ENCRYPT_SALT missing', async () => {
    vi.resetModules();
    process.env.MANIFEST_ENCRYPT_KEY = 'test-key-32-chars-long-string!!';
    delete process.env.MANIFEST_ENCRYPT_SALT;
    const { decrypt } = await import('../../../src/utils/crypto.utils.js');
    expect(() => decrypt('enc:aa:bb:ccdd')).toThrow('MANIFEST_ENCRYPT_SALT');
  });

  it('decryptAppConfig runs oauthData and pkce decrypt branches for plain strings', async () => {
    const { decryptAppConfig } = await import('../../../src/utils/crypto.utils.js');
    const cfg = {
      oauthData: {
        client_id: 'id-plain',
        client_secret: 'sec-plain',
      },
      pkce: {
        code_verifier: 'ver-plain',
        code_challenge: 'chal-plain',
      },
    };
    const out = decryptAppConfig({ ...cfg });
    expect(out.oauthData?.client_id).toBe('id-plain');
    expect(out.pkce?.code_verifier).toBe('ver-plain');
  });

  it('decryptAppConfig decrypts client_id only when client_secret absent', async () => {
    const { decryptAppConfig } = await import('../../../src/utils/crypto.utils.js');
    const out = decryptAppConfig({
      oauthData: { client_id: 'only-id' },
    } as Record<string, unknown>);
    expect((out as any).oauthData.client_secret).toBeUndefined();
    expect((out as any).oauthData.client_id).toBe('only-id');
  });

  it('decryptAppConfig handles pkce with only code_challenge', async () => {
    const { decryptAppConfig } = await import('../../../src/utils/crypto.utils.js');
    const out = decryptAppConfig({
      pkce: { code_challenge: 'chal-only' },
    } as Record<string, unknown>);
    expect((out as any).pkce.code_challenge).toBe('chal-only');
  });

  it('decryptAppConfig handles pkce with only code_verifier', async () => {
    const { decryptAppConfig } = await import('../../../src/utils/crypto.utils.js');
    const out = decryptAppConfig({
      pkce: { code_verifier: 'ver-only' },
    } as Record<string, unknown>);
    expect((out as any).pkce.code_verifier).toBe('ver-only');
  });

  it('decryptAppConfig skips inner oauth fields when oauthData is empty object', async () => {
    const { decryptAppConfig } = await import('../../../src/utils/crypto.utils.js');
    const out = decryptAppConfig({ oauthData: {} } as Record<string, unknown>);
    expect(out.oauthData).toEqual({});
  });
});
