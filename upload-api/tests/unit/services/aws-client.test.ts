import { describe, it, expect, vi } from 'vitest';

const { mockS3Client } = vi.hoisted(() => ({
  mockS3Client: vi.fn().mockImplementation(function (this: any, config: any) {
    this.config = config;
    this.send = vi.fn();
  }),
}));

vi.mock('../../../src/config/index', () => ({
  default: {
    awsData: {
      awsRegion: 'us-east-2',
      awsAccessKeyId: 'test-key',
      awsSecretAccessKey: 'test-secret',
      awsSessionToken: 'test-token',
    },
  },
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: mockS3Client,
  GetObjectCommand: vi.fn(),
}));

describe('aws/client', () => {
  it('should create S3Client with config from environment', async () => {
    const { client } = await import('../../../src/services/aws/client');

    expect(mockS3Client).toHaveBeenCalledWith({
      region: 'us-east-2',
      credentials: {
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret',
        sessionToken: 'test-token',
      },
    });
    expect(client).toBeDefined();
  });
});
