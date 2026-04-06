import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../../../src/config/index.js', () => ({
  config: {
    APP_TOKEN_KEY: 'test-secret-key',
    APP_TOKEN_EXP: '2d',
  },
}));

import { generateToken } from '../../../src/utils/jwt.utils.js';

describe('jwt.utils', () => {
  describe('generateToken', () => {
    it('should return a signed JWT string', () => {
      const payload = { region: 'NA', user_id: 'user-123' };
      const token = generateToken(payload);

      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should encode the payload correctly', () => {
      const payload = { region: 'EU', user_id: 'user-456' };
      const token = generateToken(payload);
      const decoded = jwt.verify(token, 'test-secret-key') as any;

      expect(decoded.region).toBe('EU');
      expect(decoded.user_id).toBe('user-456');
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });

    it('should set expiration from config', () => {
      const payload = { region: 'NA', user_id: 'user-123' };
      const token = generateToken(payload);
      const decoded = jwt.decode(token) as any;

      const twoDaysInSeconds = 2 * 24 * 60 * 60;
      expect(decoded.exp - decoded.iat).toBe(twoDaysInSeconds);
    });
  });
});
