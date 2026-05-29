import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRead, mockChain } = vi.hoisted(() => {
  const mockChain = {
    get: vi.fn().mockReturnThis(),
    findIndex: vi.fn().mockReturnThis(),
    value: vi.fn(),
  };
  return {
    mockRead: vi.fn(),
    mockChain,
  };
});

vi.mock('../../../src/models/authentication.js', () => ({
  default: {
    read: mockRead,
    chain: mockChain,
    data: { users: [] },
  },
}));

vi.mock('../../../src/utils/custom-errors.utils.js', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return actual;
});

import getAuthToken from '../../../src/utils/auth.utils.js';
import AuthenticationModel from '../../../src/models/authentication.js';

describe('auth.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRead.mockResolvedValue(undefined);
  });

  it('should return authtoken for a valid user', async () => {
    mockChain.value.mockReturnValue(0);
    (AuthenticationModel as any).data = {
      users: [{ region: 'NA', user_id: 'user-123', authtoken: 'valid-token' }],
    };

    const token = await getAuthToken('NA', 'user-123');
    expect(token).toBe('valid-token');
    expect(mockRead).toHaveBeenCalled();
  });

  it('should throw UnauthorizedError when user is not found', async () => {
    mockChain.value.mockReturnValue(-1);
    (AuthenticationModel as any).data = { users: [] };

    await expect(getAuthToken('NA', 'unknown-user')).rejects.toThrow();
  });

  it('should throw UnauthorizedError when authtoken is missing', async () => {
    mockChain.value.mockReturnValue(0);
    (AuthenticationModel as any).data = {
      users: [{ region: 'NA', user_id: 'user-123', authtoken: '' }],
    };

    await expect(getAuthToken('NA', 'user-123')).rejects.toThrow();
  });
});
