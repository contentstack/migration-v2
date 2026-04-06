import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'stream';

const { mockSend, MockGetObjectCommand } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  MockGetObjectCommand: vi.fn().mockImplementation(function (this: any, params: any) {
    Object.assign(this, params);
  }),
}));

vi.mock('../../../src/services/aws/client', () => ({
  client: { send: mockSend },
}));

vi.mock('../../../src/config', () => ({
  default: {
    awsData: {
      awsRegion: 'us-east-2',
      awsAccessKeyId: '',
      awsSecretAccessKey: '',
      awsSessionToken: '',
    },
  },
}));

vi.mock('@aws-sdk/client-s3', () => ({
  GetObjectCommand: MockGetObjectCommand,
  S3Client: vi.fn(),
}));

import getBuketObject from '../../../src/controllers/awsBucket/index';

describe('getBuketObject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return readable stream from S3', async () => {
    const mockStream = new Readable({ read() {} });
    mockSend.mockResolvedValue({ Body: mockStream });

    const result = await getBuketObject({ Key: 'test-key', Bucket: 'test-bucket' });
    expect(result).toBe(mockStream);
    expect(mockSend).toHaveBeenCalled();
  });

  it('should throw error when S3 body is empty', async () => {
    mockSend.mockResolvedValue({ Body: null });

    await expect(
      getBuketObject({ Key: 'test-key', Bucket: 'test-bucket' })
    ).rejects.toThrow('Empty response body from S3');
  });

  it('should throw error when S3 send fails', async () => {
    mockSend.mockRejectedValue(new Error('S3 access denied'));

    await expect(
      getBuketObject({ Key: 'test-key', Bucket: 'test-bucket' })
    ).rejects.toThrow('S3 access denied');
  });

  it('should pass correct params to GetObjectCommand', async () => {
    const mockStream = new Readable({ read() {} });
    mockSend.mockResolvedValue({ Body: mockStream });

    await getBuketObject({ Key: 'my/path/file.zip', Bucket: 'my-bucket' });
    expect(MockGetObjectCommand).toHaveBeenCalledWith({
      Key: 'my/path/file.zip',
      Bucket: 'my-bucket',
    });
  });
});
