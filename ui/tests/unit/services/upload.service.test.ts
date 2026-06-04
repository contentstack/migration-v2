import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');

vi.mock('../../../src/utilities/constants', () => ({
  UPLOAD_FILE_RELATIVE_URL: 'http://localhost:5002/',
  BASE_API_URL: 'http://localhost:5001/',
  TOKEN_KEY: 'access_token',
  TOKEN: null,
  HEADERS: {}
}));

vi.mock('../../../src/utilities/functions', () => ({
  getDataFromLocalStorage: vi.fn(() => 'mock-app-token')
}));

import {
  getCall,
  postCall,
  putCall,
  uploadFilePath,
  fileValidation,
  getConfig,
  getRestrictedKeywords,
  getLocales
} from '../../../src/services/api/upload.service';

const mockedAxios = vi.mocked(axios);

describe('services/api/upload.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCall', () => {
    it('should make a GET request and return response', async () => {
      const mockResponse = { data: { result: true }, status: 200 };
      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getCall('http://localhost:5002/config');
      expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:5002/config', {});
      expect(result).toEqual(mockResponse);
    });

    it('should return error response on failure', async () => {
      const errorResponse = { status: 500, data: {} };
      mockedAxios.get.mockRejectedValue({ response: errorResponse });

      const result = await getCall('http://localhost:5002/config');
      expect(result).toEqual(errorResponse);
    });
  });

  describe('postCall', () => {
    it('should make a POST request and return response', async () => {
      const mockResponse = { data: {}, status: 200 };
      mockedAxios.post.mockResolvedValue(mockResponse);

      const result = await postCall('http://localhost:5002/upload', { file: 'data' } as any);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'http://localhost:5002/upload',
        { file: 'data' },
        undefined
      );
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on failure', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Upload failed'));

      await expect(postCall('http://localhost:5002/upload', {} as any)).rejects.toThrow(
        'Upload failed'
      );
    });
  });

  describe('putCall', () => {
    it('should make a PUT request and return response', async () => {
      const mockResponse = { data: {}, status: 200 };
      mockedAxios.put.mockResolvedValue(mockResponse);

      const result = await putCall('http://localhost:5002/update', { data: 'test' } as any);
      expect(mockedAxios.put).toHaveBeenCalledWith(
        'http://localhost:5002/update',
        { data: 'test' },
        undefined
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return error response on failure', async () => {
      const errorResponse = { status: 400, data: {} };
      mockedAxios.put.mockRejectedValue({ response: errorResponse });

      const result = await putCall('http://localhost:5002/update', {} as any);
      expect(result).toEqual(errorResponse);
    });
  });

  describe('uploadFilePath', () => {
    it('should return the upload URL', () => {
      expect(uploadFilePath()).toBe('http://localhost:5002/upload');
    });
  });

  describe('fileValidation', () => {
    it('should call getCall with validator endpoint and correct headers', async () => {
      const mockResponse = { data: { valid: true }, status: 200 };
      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await fileValidation({ projectId: 'proj-1', affix: 'cs', localPath: '/tmp/file' });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:5002/validator',
        expect.objectContaining({
          headers: {
            app_token: 'mock-app-token',
            projectId: 'proj-1',
            affix: 'cs',
            file_path: '/tmp/file'
          }
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should use "cs" as default affix', async () => {
      mockedAxios.get.mockResolvedValue({ data: {}, status: 200 });

      await fileValidation({ projectId: 'proj-1' });
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://localhost:5002/validator',
        expect.objectContaining({
          headers: expect.objectContaining({ affix: 'cs', file_path: '' })
        })
      );
    });
  });

  describe('getConfig', () => {
    it('should call getCall with config endpoint', async () => {
      const mockResponse = { data: { maxFileSize: 100 }, status: 200 };
      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getConfig();
      expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:5002/config', {});
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getRestrictedKeywords', () => {
    it('should call getCall with contentstack API URL', async () => {
      const mockResponse = { data: { keywords: [] }, status: 200 };
      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getRestrictedKeywords();
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.contentstack.io/v3/restricted_uids',
        {}
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getLocales', () => {
    it('should call getCall with locales endpoint and auth headers', async () => {
      const mockResponse = { data: { locales: [] }, status: 200 };
      mockedAxios.get.mockResolvedValue(mockResponse);

      const result = await getLocales('api-key-123');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://api.contentstack.io/v3/locales',
        expect.objectContaining({
          headers: {
            authtoken: 'mock-app-token',
            api_key: 'api-key-123'
          }
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should handle axios failure and return error response', async () => {
      const errorResponse = { status: 500, data: { message: 'fail' } };
      mockedAxios.get.mockRejectedValue({ response: errorResponse });

      const result = await getLocales('api-key-123');
      expect(result).toEqual(errorResponse);
    });
  });

  describe('error handling for upload service functions', () => {
    it('postCall should throw generic on non-Error', async () => {
      mockedAxios.post.mockRejectedValue('string-error');
      await expect(postCall('http://test', {} as any)).rejects.toThrow('Unknown error in userSession');
    });

    it('fileValidation should return response on axios failure', async () => {
      const errorResponse = { status: 400, data: { valid: false } };
      mockedAxios.get.mockRejectedValue({ response: errorResponse });

      const result = await fileValidation({ projectId: 'p' });
      expect(result).toEqual(errorResponse);
    });

    it('getConfig should return error response on axios failure', async () => {
      const errorResponse = { status: 500, data: {} };
      mockedAxios.get.mockRejectedValue({ response: errorResponse });

      const result = await getConfig();
      expect(result).toEqual(errorResponse);
    });

    it('getRestrictedKeywords should return error response on axios failure', async () => {
      const errorResponse = { status: 403, data: {} };
      mockedAxios.get.mockRejectedValue({ response: errorResponse });

      const result = await getRestrictedKeywords();
      expect(result).toEqual(errorResponse);
    });
  });
});
