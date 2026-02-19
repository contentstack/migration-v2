import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { getCall, postCall, putCall, deleteCall, patchCall } from '../../../src/services/api/service';

vi.mock('axios');
vi.mock('../../../src/utilities/constants', () => ({
  BASE_API_URL: 'http://localhost:5001/'
}));

const mockedAxios = vi.mocked(axios);

describe('services/api/service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCall', () => {
    it('should make a GET request with the correct URL', async () => {
      const mockResponse = { data: { message: 'ok' }, status: 200 };
      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getCall('v2/test');
      expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:5001/v2/test', {});
      expect(result).toEqual(mockResponse);
    });

    it('should pass options to axios', async () => {
      const mockResponse = { data: {}, status: 200 };
      mockedAxios.get.mockResolvedValue(mockResponse);
      const options = { headers: { Authorization: 'Bearer token' } };

      await getCall('v2/test', options);
      expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:5001/v2/test', options);
    });

    it('should return error response on failure', async () => {
      const errorResponse = { status: 500, data: { message: 'Server Error' } };
      mockedAxios.get.mockRejectedValue({ response: errorResponse });

      const result = await getCall('v2/test');
      expect(result).toEqual(errorResponse);
    });
  });

  describe('postCall', () => {
    it('should make a POST request with data', async () => {
      const mockResponse = { data: { id: 1 }, status: 201 };
      mockedAxios.post.mockResolvedValue(mockResponse);
      const data = { name: 'test' };

      const result = await postCall('v2/test', data);
      expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:5001/v2/test', data, undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should pass options to axios', async () => {
      mockedAxios.post.mockResolvedValue({ data: {}, status: 200 });
      const options = { headers: { 'Content-Type': 'application/json' } };

      await postCall('v2/test', { key: 'val' }, options);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:5001/v2/test',
        { key: 'val' },
        options
      );
    });

    it('should return error response on failure', async () => {
      const errorResponse = { status: 400, data: { message: 'Bad Request' } };
      mockedAxios.post.mockRejectedValue({ response: errorResponse });

      const result = await postCall('v2/test', {});
      expect(result).toEqual(errorResponse);
    });
  });

  describe('putCall', () => {
    it('should make a PUT request with data', async () => {
      const mockResponse = { data: {}, status: 200 };
      mockedAxios.put.mockResolvedValue(mockResponse);

      const result = await putCall('v2/test', { updated: true });
      expect(mockedAxios.put).toHaveBeenCalledWith(
        'http://localhost:5001/v2/test',
        { updated: true },
        undefined
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return error response on failure', async () => {
      const errorResponse = { status: 500, data: {} };
      mockedAxios.put.mockRejectedValue({ response: errorResponse });

      const result = await putCall('v2/test', {});
      expect(result).toEqual(errorResponse);
    });
  });

  describe('deleteCall', () => {
    it('should make a DELETE request', async () => {
      const mockResponse = { data: {}, status: 204 };
      mockedAxios.delete.mockResolvedValue(mockResponse);

      const result = await deleteCall('v2/test');
      expect(mockedAxios.delete).toHaveBeenCalledWith('http://localhost:5001/v2/test', undefined);
      expect(result).toEqual(mockResponse);
    });

    it('should return error response on failure', async () => {
      const errorResponse = { status: 404, data: {} };
      mockedAxios.delete.mockRejectedValue({ response: errorResponse });

      const result = await deleteCall('v2/test');
      expect(result).toEqual(errorResponse);
    });
  });

  describe('patchCall', () => {
    it('should make a PATCH request with data', async () => {
      const mockResponse = { data: {}, status: 200 };
      mockedAxios.patch.mockResolvedValue(mockResponse);

      const result = await patchCall('v2/test', { patched: true });
      expect(mockedAxios.patch).toHaveBeenCalledWith(
        'http://localhost:5001/v2/test',
        { patched: true },
        undefined
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return error response on failure', async () => {
      const errorResponse = { status: 422, data: {} };
      mockedAxios.patch.mockRejectedValue({ response: errorResponse });

      const result = await patchCall('v2/test', {});
      expect(result).toEqual(errorResponse);
    });
  });
});
