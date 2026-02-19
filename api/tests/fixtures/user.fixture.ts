export const createMockUser = (overrides: Record<string, any> = {}) => ({
  uid: 'user-123',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  ...overrides,
});

export const createMockOrg = (overrides: Record<string, any> = {}) => ({
  uid: 'org-123',
  name: 'Test Organization',
  org_roles: [{ admin: true }],
  ...overrides,
});

export const createMockStack = (overrides: Record<string, any> = {}) => ({
  api_key: 'stack-api-key-123',
  name: 'Test Stack',
  description: 'A test stack',
  master_locale: 'en-us',
  org_uid: 'org-123',
  ...overrides,
});
