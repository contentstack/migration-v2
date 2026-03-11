import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios', () => ({
  default: vi.fn(),
}));

vi.mock('../../../src/constants/index.js', () => ({
  AXIOS_TIMEOUT: 60000,
  METHODS_TO_INCLUDE_DATA_IN_AXIOS: ['PUT', 'POST', 'DELETE', 'PATCH'],
}));

import https from '../../../src/utils/https.utils.js';

describe('https.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send a GET request and return headers, status, data', async () => {
    const mockResponse = {
      headers: { 'content-type': 'application/json' },
      status: 200,
      data: { message: 'ok' },
    };
    vi.mocked(axios).mockResolvedValue(mockResponse);

    const result = await https({
      url: 'https://api.example.com/test',
      method: 'GET',
      headers: { Authorization: 'Bearer token' },
    });

    expect(result).toEqual({
      headers: mockResponse.headers,
      status: 200,
      data: { message: 'ok' },
    });
    expect(axios).toHaveBeenCalledWith('https://api.example.com/test', expect.objectContaining({
      method: 'GET',
      timeout: 60000,
    }));
  });

  it('should include data for POST requests', async () => {
    vi.mocked(axios).mockResolvedValue({ headers: {}, status: 201, data: {} });

    await https({
      url: 'https://api.example.com/test',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      data: { name: 'test' },
    });

    expect(axios).toHaveBeenCalledWith('https://api.example.com/test', expect.objectContaining({
      method: 'POST',
      data: { name: 'test' },
    }));
  });

  it('should not include data for GET requests', async () => {
    vi.mocked(axios).mockResolvedValue({ headers: {}, status: 200, data: {} });

    await https({
      url: 'https://api.example.com/test',
      method: 'GET',
      data: { shouldNotAppear: true },
    });

    const callArgs = vi.mocked(axios).mock.calls[0][1] as any;
    expect(callArgs.data).toBeUndefined();
  });

  it('should use custom timeout when provided', async () => {
    vi.mocked(axios).mockResolvedValue({ headers: {}, status: 200, data: {} });

    await https({
      url: 'https://api.example.com/test',
      method: 'GET',
      timeout: 5000,
    });

    expect(axios).toHaveBeenCalledWith('https://api.example.com/test', expect.objectContaining({
      timeout: 5000,
    }));
  });

  it('should propagate axios errors', async () => {
    vi.mocked(axios).mockRejectedValue(new Error('Network Error'));

    await expect(
      https({ url: 'https://api.example.com/test', method: 'GET' })
    ).rejects.toThrow('Network Error');
  });
});
