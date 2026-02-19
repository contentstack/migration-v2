import { describe, it, expect, beforeAll } from 'vitest';
import { checkSchema, validationResult } from 'express-validator';

const mockReq = (body: any) => ({
  body,
  query: {},
  params: {},
  headers: {},
  get: () => undefined,
});

async function runValidation(schema: any, body: any) {
  const req = mockReq(body);
  const validations = schema;
  await validations.run(req);
  return validationResult(req);
}

describe('auth.validator', () => {
  let authValidator: any;

  beforeAll(async () => {
    const mod = await import('../../../src/validators/auth.validator.js');
    authValidator = mod.default;
  });

  it('should accept valid auth body', async () => {
    const result = await runValidation(authValidator, {
      email: 'test@example.com',
      password: 'password123',
      region: 'NA',
    });
    expect(result.isEmpty()).toBe(true);
  });

  it('should reject missing email', async () => {
    const result = await runValidation(authValidator, {
      password: 'password123',
      region: 'NA',
    });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject invalid email', async () => {
    const result = await runValidation(authValidator, {
      email: 'not-an-email',
      password: 'password123',
      region: 'NA',
    });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject non-string password', async () => {
    const result = await runValidation(authValidator, {
      email: 'test@example.com',
      password: 12345,
      region: 'NA',
    });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject invalid region', async () => {
    const result = await runValidation(authValidator, {
      email: 'test@example.com',
      password: 'password123',
      region: 'INVALID',
    });
    expect(result.isEmpty()).toBe(false);
  });

  it('should accept valid regions', async () => {
    for (const region of ['NA', 'EU', 'AZURE_NA', 'AZURE_EU', 'GCP_NA', 'AU', 'GCP_EU']) {
      const result = await runValidation(authValidator, {
        email: 'test@example.com',
        password: 'password123',
        region,
      });
      expect(result.isEmpty()).toBe(true);
    }
  });

  it('should accept optional tfa_token', async () => {
    const result = await runValidation(authValidator, {
      email: 'test@example.com',
      password: 'password123',
      region: 'NA',
      tfa_token: '123456',
    });
    expect(result.isEmpty()).toBe(true);
  });
});
