import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateConnection, mockExecute, mockEnd, mockAxiosHead } = vi.hoisted(() => ({
  mockCreateConnection: vi.fn(),
  mockExecute: vi.fn(),
  mockEnd: vi.fn().mockResolvedValue(undefined),
  mockAxiosHead: vi.fn(),
}));

vi.mock('mysql2/promise', () => ({
  default: { createConnection: (...a: any[]) => mockCreateConnection(...a) },
  createConnection: (...a: any[]) => mockCreateConnection(...a),
}));

vi.mock('axios', () => ({
  default: { head: mockAxiosHead },
}));

vi.mock('../../../src/utils/logger', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import drupalValidator from '../../../src/validators/drupal/index';

describe('drupalValidator', () => {
  const validData = {
    host: 'localhost',
    user: 'root',
    password: 'password',
    database: 'drupal_db',
    port: 3306,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnd.mockResolvedValue(undefined);
    mockCreateConnection.mockResolvedValue({ execute: mockExecute, end: mockEnd });
  });

  it('should return success when DB validation passes', async () => {
    mockExecute
      .mockResolvedValueOnce([{ count: 10 }])
      .mockResolvedValueOnce([[{ name: 'field.field.node.article' }]]);

    const result = await drupalValidator({ data: validData });
    expect(result).toEqual({ success: true });
  });

  it('should return error when host is missing', async () => {
    const result = await drupalValidator({ data: { ...validData, host: '' } });
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('Missing') }));
  });

  it('should return error when user is missing', async () => {
    const result = await drupalValidator({ data: { ...validData, user: '' } });
    expect(result).toEqual(expect.objectContaining({ success: false }));
  });

  it('should return error when database is missing', async () => {
    const result = await drupalValidator({ data: { ...validData, database: '' } });
    expect(result).toEqual(expect.objectContaining({ success: false }));
  });

  it('should return error when node_field_data table does not exist', async () => {
    mockExecute.mockRejectedValueOnce({ message: 'Table not found', code: 'ER_NO_SUCH_TABLE' });
    const result = await drupalValidator({ data: validData });
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('Required Drupal table') }));
  });

  it('should return error when config query returns empty', async () => {
    mockExecute.mockResolvedValueOnce([{ count: 10 }]).mockResolvedValueOnce([[]]);
    const result = await drupalValidator({ data: validData });
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('schema validation failed') }));
  });

  it('should return error when config table query fails with ER_NO_SUCH_TABLE', async () => {
    mockExecute.mockResolvedValueOnce([{ count: 10 }]).mockRejectedValueOnce({ message: 'no table', code: 'ER_NO_SUCH_TABLE' });
    const result = await drupalValidator({ data: validData });
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('Required Drupal tables not found') }));
  });

  it('should return error when config table query fails with other code', async () => {
    mockExecute.mockResolvedValueOnce([{ count: 10 }]).mockRejectedValueOnce({ message: 'syntax error', code: 'ER_PARSE_ERROR' });
    const result = await drupalValidator({ data: validData });
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('syntax error') }));
  });

  it('should handle ECONNREFUSED error', async () => {
    mockCreateConnection.mockRejectedValue({ code: 'ECONNREFUSED', message: 'Connection refused' });
    const result = await drupalValidator({ data: validData });
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('Cannot connect') }));
  });

  it('should handle ER_ACCESS_DENIED_ERROR', async () => {
    mockCreateConnection.mockRejectedValue({ code: 'ER_ACCESS_DENIED_ERROR', message: 'Denied' });
    const result = await drupalValidator({ data: validData });
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('Access denied') }));
  });

  it('should handle ER_BAD_DB_ERROR', async () => {
    mockCreateConnection.mockRejectedValue({ code: 'ER_BAD_DB_ERROR', message: 'Bad DB' });
    const result = await drupalValidator({ data: validData });
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('does not exist') }));
  });

  it('should handle ETIMEDOUT error', async () => {
    mockCreateConnection.mockRejectedValue({ code: 'ETIMEDOUT', message: 'Timeout' });
    const result = await drupalValidator({ data: validData });
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('Cannot reach') }));
  });

  it('should handle ENOTFOUND error', async () => {
    mockCreateConnection.mockRejectedValue({ code: 'ENOTFOUND', message: 'Not found' });
    const result = await drupalValidator({ data: validData });
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('Cannot reach') }));
  });

  it('should handle generic connection error', async () => {
    mockCreateConnection.mockRejectedValue({ code: 'UNKNOWN', message: 'Unknown error' });
    const result = await drupalValidator({ data: validData });
    expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('Unknown error') }));
  });

  it('should use default port 3306 when port is NaN', async () => {
    mockExecute.mockResolvedValueOnce([{ count: 10 }]).mockResolvedValueOnce([[{ name: 'f' }]]);
    await drupalValidator({ data: { ...validData, port: 'invalid' as any } });
    expect(mockCreateConnection).toHaveBeenCalledWith(expect.objectContaining({ port: 3306 }));
  });

  it('should close connection in finally block', async () => {
    mockExecute.mockResolvedValueOnce([{ count: 10 }]).mockResolvedValueOnce([[{ name: 'f' }]]);
    await drupalValidator({ data: validData });
    expect(mockEnd).toHaveBeenCalled();
  });

  it('should handle connection close error gracefully', async () => {
    mockExecute.mockResolvedValueOnce([{ count: 10 }]).mockResolvedValueOnce([[{ name: 'f' }]]);
    mockEnd.mockRejectedValueOnce(new Error('close error'));
    const result = await drupalValidator({ data: validData });
    expect(result).toEqual({ success: true });
  });

  describe('asset validation', () => {
    it('should skip validation when assetsConfig has no base_url', async () => {
      mockExecute.mockResolvedValueOnce([{ count: 10 }]).mockResolvedValueOnce([[{ name: 'f' }]]);
      const result = await drupalValidator({
        data: validData,
        assetsConfig: { base_url: '', public_path: '/files' },
      });
      expect(result).toEqual({ success: true });
      expect(mockAxiosHead).not.toHaveBeenCalled();
    });

    it('should validate assets when base_url is provided', async () => {
      mockExecute
        .mockResolvedValueOnce([{ count: 10 }])
        .mockResolvedValueOnce([[{ name: 'field.field.node.article' }]])
        .mockResolvedValueOnce([[
          { fid: 1, filename: 'test.jpg', uri: 'public://images/test.jpg', filesize: 1024, filemime: 'image/jpeg' },
        ]]);

      mockAxiosHead.mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      });

      const result = await drupalValidator({
        data: validData,
        assetsConfig: { base_url: 'https://example.com', public_path: '/sites/default/files/' },
      });

      expect(result).toEqual({ success: true });
      expect(mockAxiosHead).toHaveBeenCalled();
    });

    it('should fail when assets return HTML content type', async () => {
      mockExecute
        .mockResolvedValueOnce([{ count: 10 }])
        .mockResolvedValueOnce([[{ name: 'f' }]])
        .mockResolvedValueOnce([[
          { fid: 1, filename: 'test.jpg', uri: 'public://images/test.jpg', filesize: 1024, filemime: 'image/jpeg' },
        ]]);

      mockAxiosHead.mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });

      const result = await drupalValidator({
        data: validData,
        assetsConfig: { base_url: 'https://example.com', public_path: '/files/' },
      });

      expect(result).toEqual(expect.objectContaining({ success: false, error: expect.stringContaining('Assets validation failed') }));
    });

    it('should fail when all asset requests fail', async () => {
      mockExecute
        .mockResolvedValueOnce([{ count: 10 }])
        .mockResolvedValueOnce([[{ name: 'f' }]])
        .mockResolvedValueOnce([[
          { fid: 1, filename: 'test.jpg', uri: 'public://img.jpg', filesize: 100, filemime: 'image/jpeg' },
        ]]);

      mockAxiosHead.mockRejectedValue({ response: { status: 404 }, message: 'Not found' });

      const result = await drupalValidator({
        data: validData,
        assetsConfig: { base_url: 'https://example.com', public_path: '/files/' },
      });

      expect(result).toEqual(expect.objectContaining({ success: false }));
    });

    it('should handle no assets in database', async () => {
      mockExecute
        .mockResolvedValueOnce([{ count: 10 }])
        .mockResolvedValueOnce([[{ name: 'f' }]])
        .mockResolvedValueOnce([[]]);

      const result = await drupalValidator({
        data: validData,
        assetsConfig: { base_url: 'https://example.com', public_path: '/files/' },
      });

      expect(result).toEqual({ success: true });
    });

    it('should construct URL for public:// scheme', async () => {
      mockExecute
        .mockResolvedValueOnce([{ count: 10 }])
        .mockResolvedValueOnce([[{ name: 'f' }]])
        .mockResolvedValueOnce([[
          { fid: 1, filename: 'test.pdf', uri: 'public://docs/test.pdf', filesize: 100, filemime: 'application/pdf' },
        ]]);

      mockAxiosHead.mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      });

      const result = await drupalValidator({
        data: validData,
        assetsConfig: { base_url: 'https://example.com', public_path: '/sites/default/files/' },
      });

      expect(result).toEqual({ success: true });
      expect(mockAxiosHead).toHaveBeenCalledWith(
        expect.stringContaining('https://example.com/sites/default/files/docs/test.pdf'),
        expect.any(Object)
      );
    });

    it('should normalize base_url by adding protocol when missing', async () => {
      mockExecute
        .mockResolvedValueOnce([{ count: 10 }])
        .mockResolvedValueOnce([[{ name: 'f' }]])
        .mockResolvedValueOnce([[
          { fid: 1, filename: 'a.jpg', uri: 'public://a.jpg', filesize: 100, filemime: 'image/jpeg' },
        ]]);

      mockAxiosHead.mockResolvedValue({
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
      });

      await drupalValidator({
        data: validData,
        assetsConfig: { base_url: 'example.com', public_path: '/files/' },
      });

      expect(mockAxiosHead).toHaveBeenCalledWith(
        expect.stringContaining('https://example.com'),
        expect.any(Object)
      );
    });

    it('should handle asset validation error', async () => {
      mockExecute
        .mockResolvedValueOnce([{ count: 10 }])
        .mockResolvedValueOnce([[{ name: 'f' }]])
        .mockRejectedValueOnce(new Error('query fail'));

      const result = await drupalValidator({
        data: validData,
        assetsConfig: { base_url: 'https://example.com', public_path: '/files/' },
      });

      expect(result).toEqual(expect.objectContaining({ success: false }));
    });

    it('should validate various content types as valid assets', async () => {
      const validTypes = ['image/png', 'application/pdf', 'video/mp4', 'audio/mpeg', 'text/plain', 'text/csv', 'application/zip', 'application/octet-stream', 'application/msword', 'application/vnd.openxmlformats'];

      for (const ct of validTypes) {
        vi.clearAllMocks();
        mockCreateConnection.mockResolvedValue({ execute: mockExecute, end: mockEnd });
        mockEnd.mockResolvedValue(undefined);

        mockExecute
          .mockResolvedValueOnce([{ count: 10 }])
          .mockResolvedValueOnce([[{ name: 'f' }]])
          .mockResolvedValueOnce([[{ fid: 1, filename: 'f', uri: 'public://f', filesize: 1, filemime: ct }]]);

        mockAxiosHead.mockResolvedValue({ status: 200, headers: { 'content-type': ct } });

        const result = await drupalValidator({
          data: validData,
          assetsConfig: { base_url: 'https://x.com', public_path: '/f/' },
        });

        expect(result).toEqual({ success: true });
      }
    });

    it('should skip asset validation when assetsConfig has no values', async () => {
      mockExecute.mockResolvedValueOnce([{ count: 10 }]).mockResolvedValueOnce([[{ name: 'f' }]]);
      const result = await drupalValidator({ data: validData, assetsConfig: {} });
      expect(result).toEqual({ success: true });
    });
  });
});
