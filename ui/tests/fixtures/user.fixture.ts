export const createMockUser = (overrides = {}) => ({
  email: 'test@example.com',
  username: 'testuser',
  first_name: 'Test',
  last_name: 'User',
  mobile_number: '1234567890',
  country_code: '+1',
  organizations: [],
  region: 'NA',
  ...overrides
});

export const createMockOrganisation = (overrides = {}) => ({
  uid: 'org-123',
  value: 'org-123',
  label: 'Test Org',
  master_locale: 'en-us',
  locales: [],
  created_at: '2024-01-01',
  ...overrides
});

export const createMockProject = (overrides = {}) => ({
  _id: 'proj-123',
  name: 'Test Project',
  description: 'A test project',
  status: 0,
  org_id: 'org-123',
  org_name: 'Test Org',
  region: 'NA',
  owner: 'user-123',
  created_by: 'user-123',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  legacy_cms: {
    cms_id: 'wordpress',
    allowed_file_formats: ['json'],
    affix: 'cs',
    file_format: 'json',
    file_path: '/path/to/file',
    is_localPath: true,
    is_fileValid: true,
    awsDetails: {
      awsRegion: 'us-east-1',
      bucketName: 'test-bucket',
      bucketKey: 'test-key'
    }
  },
  destination_stack_id: 'stack-123',
  destination_stack_name: 'Test Stack',
  destination_stack_master_locale: 'en-us',
  destination_stack_created_at: '2024-01-01',
  content_mapping: {},
  stackDetails: { label: 'Test Stack', value: 'stack-123' },
  mapperKeys: {},
  ...overrides
});

export const createMockLoginUser = (overrides = {}) => ({
  email: 'test@example.com',
  password: 'password123',
  ...overrides
});

export const createMockAxiosResponse = (overrides = {}) => ({
  status: 200,
  statusText: 'OK',
  data: {},
  headers: {},
  config: {},
  ...overrides
});
