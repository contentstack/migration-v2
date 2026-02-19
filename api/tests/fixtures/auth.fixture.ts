export const createMockJwtPayload = (overrides: Record<string, any> = {}) => ({
  region: 'NA',
  user_id: 'user-123',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
  ...overrides,
});

export const createMockToken = () => 'mock.jwt.token';

export const createMockLoginBody = (overrides: Record<string, any> = {}) => ({
  email: 'test@example.com',
  password: 'password123',
  region: 'NA',
  ...overrides,
});

export const createMockAuthUser = (overrides: Record<string, any> = {}) => ({
  user_id: 'user-123',
  email: 'test@example.com',
  region: 'NA',
  authtoken: 'cs-auth-token-123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});
