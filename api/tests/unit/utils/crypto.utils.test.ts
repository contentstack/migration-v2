import { describe, it, expect, vi, beforeEach } from 'vitest';
import { decrypt, decryptAppConfig } from '../../../src/utils/crypto.utils.js';

// Mock crypto module
vi.mock('crypto', () => ({
  default: {
    scryptSync: vi.fn(),
    createDecipheriv: vi.fn()
  }
}));

describe('crypto.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    delete process.env.MANIFEST_ENCRYPT_KEY;
    delete process.env.MANIFEST_ENCRYPT_SALT;
  });

  describe('decrypt', () => {
    it('should return original value if not encrypted (no prefix)', () => {
      const plainValue = 'plain-text-value';
      const result = decrypt(plainValue);
      expect(result).toBe(plainValue);
    });

    it('should return original value if empty string', () => {
      const result = decrypt('');
      expect(result).toBe('');
    });

    it('should return original value if null/undefined', () => {
      expect(decrypt(null as any)).toBe(null);
      expect(decrypt(undefined as any)).toBe(undefined);
    });

    it('should throw error if MANIFEST_ENCRYPT_KEY is missing', () => {
      const encryptedValue = 'enc:iv:tag:cipher';
      
      expect(() => decrypt(encryptedValue)).toThrow('MANIFEST_ENCRYPT_KEY env variable is required to decrypt credentials');
    });

    it('should throw error if MANIFEST_ENCRYPT_SALT is missing', () => {
      process.env.MANIFEST_ENCRYPT_KEY = 'test-key';
      const encryptedValue = 'enc:iv:tag:cipher';
      
      expect(() => decrypt(encryptedValue)).toThrow('MANIFEST_ENCRYPT_SALT env variable is required to decrypt credentials');
    });

    it('should throw error for invalid encrypted value format (wrong parts count)', () => {
      process.env.MANIFEST_ENCRYPT_KEY = 'test-key';
      process.env.MANIFEST_ENCRYPT_SALT = 'test-salt';
      
      const invalidEncryptedValue = 'enc:only:two:parts:extra'; // 4 parts instead of 3
      
      expect(() => decrypt(invalidEncryptedValue)).toThrow('Invalid encrypted value format');
    });

    it('should throw error for invalid encrypted value format (too few parts)', () => {
      process.env.MANIFEST_ENCRYPT_KEY = 'test-key';
      process.env.MANIFEST_ENCRYPT_SALT = 'test-salt';
      
      const invalidEncryptedValue = 'enc:only:two'; // 2 parts instead of 3
      
      expect(() => decrypt(invalidEncryptedValue)).toThrow('Invalid encrypted value format');
    });

    it('should successfully decrypt valid encrypted value', async () => {
      process.env.MANIFEST_ENCRYPT_KEY = 'test-key';
      process.env.MANIFEST_ENCRYPT_SALT = 'test-salt';
      
      const crypto = await import('crypto');
      const mockKey = Buffer.from('test-derived-key-32-bytes-long!!');
      const mockDecipher = {
        setAuthTag: vi.fn(),
        update: vi.fn().mockReturnValue('decrypted'),
        final: vi.fn().mockReturnValue('-text')
      };

      (crypto.default.scryptSync as ReturnType<typeof vi.fn>).mockReturnValue(mockKey);
      (crypto.default.createDecipheriv as ReturnType<typeof vi.fn>).mockReturnValue(mockDecipher);

      const encryptedValue = 'enc:aabbccdd:eeffgghh:iijjkkll';
      const result = decrypt(encryptedValue);

      expect(result).toBe('decrypted-text');
      expect(crypto.default.scryptSync).toHaveBeenCalledWith('test-key', 'test-salt', 32);
      expect(crypto.default.createDecipheriv).toHaveBeenCalledWith('aes-256-gcm', mockKey, Buffer.from('aabbccdd', 'hex'));
      expect(mockDecipher.setAuthTag).toHaveBeenCalledWith(Buffer.from('eeffgghh', 'hex'));
      expect(mockDecipher.update).toHaveBeenCalledWith('iijjkkll', 'hex', 'utf8');
      expect(mockDecipher.final).toHaveBeenCalledWith('utf8');
    });
  });

  describe('decryptAppConfig', () => {
    beforeEach(() => {
      process.env.MANIFEST_ENCRYPT_KEY = 'test-key';
      process.env.MANIFEST_ENCRYPT_SALT = 'test-salt';
    });

    it('should return config unchanged if no oauthData or pkce', () => {
      const config = {
        someField: 'value',
        anotherField: 123
      };

      const result = decryptAppConfig(config);

      expect(result).toBe(config); // Same reference
      expect(result).toEqual({
        someField: 'value',
        anotherField: 123
      });
    });

    it('should decrypt oauthData fields if present', async () => {
      const crypto = await import('crypto');
      const mockKey = Buffer.from('test-derived-key-32-bytes-long!!');
      const mockDecipher = {
        setAuthTag: vi.fn(),
        update: vi.fn().mockReturnValue('decrypted'),
        final: vi.fn().mockReturnValue('-value')
      };

      (crypto.default.scryptSync as ReturnType<typeof vi.fn>).mockReturnValue(mockKey);
      (crypto.default.createDecipheriv as ReturnType<typeof vi.fn>).mockReturnValue(mockDecipher);

      const config = {
        oauthData: {
          client_id: 'enc:aa:bb:cc',
          client_secret: 'enc:dd:ee:ff',
          other_field: 'plain-value'
        }
      };

      const result = decryptAppConfig(config);

      expect(result.oauthData.client_id).toBe('decrypted-value');
      expect(result.oauthData.client_secret).toBe('decrypted-value');
      expect(result.oauthData.other_field).toBe('plain-value');
    });

    it('should decrypt pkce fields if present', async () => {
      const crypto = await import('crypto');
      const mockKey = Buffer.from('test-derived-key-32-bytes-long!!');
      const mockDecipher = {
        setAuthTag: vi.fn(),
        update: vi.fn().mockReturnValue('decrypted'),
        final: vi.fn().mockReturnValue('-pkce')
      };

      (crypto.default.scryptSync as ReturnType<typeof vi.fn>).mockReturnValue(mockKey);
      (crypto.default.createDecipheriv as ReturnType<typeof vi.fn>).mockReturnValue(mockDecipher);

      const config = {
        pkce: {
          code_verifier: 'enc:aa:bb:cc',
          code_challenge: 'enc:dd:ee:ff',
          other_field: 'plain-value'
        }
      };

      const result = decryptAppConfig(config);

      expect(result.pkce.code_verifier).toBe('decrypted-pkce');
      expect(result.pkce.code_challenge).toBe('decrypted-pkce');
      expect(result.pkce.other_field).toBe('plain-value');
    });

    it('should handle both oauthData and pkce fields', async () => {
      const crypto = await import('crypto');
      const mockKey = Buffer.from('test-derived-key-32-bytes-long!!');
      const mockDecipher = {
        setAuthTag: vi.fn(),
        update: vi.fn().mockReturnValue('decrypted'),
        final: vi.fn().mockReturnValue('-value')
      };

      (crypto.default.scryptSync as ReturnType<typeof vi.fn>).mockReturnValue(mockKey);
      (crypto.default.createDecipheriv as ReturnType<typeof vi.fn>).mockReturnValue(mockDecipher);

      const config = {
        oauthData: {
          client_id: 'enc:aa:bb:cc'
        },
        pkce: {
          code_verifier: 'enc:dd:ee:ff'
        }
      };

      const result = decryptAppConfig(config);

      expect(result.oauthData.client_id).toBe('decrypted-value');
      expect(result.pkce.code_verifier).toBe('decrypted-value');
    });

    it('should handle missing fields gracefully', () => {
      const config = {
        oauthData: {
          // client_id and client_secret missing
          other_field: 'value'
        },
        pkce: {
          // code_verifier and code_challenge missing
          other_field: 'value'
        }
      };

      const result = decryptAppConfig(config);

      expect(result).toEqual(config);
    });

    it('should handle plain text values in encrypted fields', () => {
      const config = {
        oauthData: {
          client_id: 'plain-client-id', // Not encrypted
          client_secret: 'plain-client-secret' // Not encrypted
        }
      };

      const result = decryptAppConfig(config);

      expect(result.oauthData.client_id).toBe('plain-client-id');
      expect(result.oauthData.client_secret).toBe('plain-client-secret');
    });
  });
});