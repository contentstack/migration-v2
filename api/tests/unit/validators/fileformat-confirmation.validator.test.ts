import { describe, it, expect, beforeAll } from 'vitest';
import { validationResult } from 'express-validator';

const mockReq = (body: any) => ({ body, query: {}, params: {}, headers: {}, get: () => undefined });

async function runValidation(schema: any, body: any) {
  const req = mockReq(body);
  await schema.run(req);
  return validationResult(req);
}

describe('fileformat-confirmation.validator', () => {
  let validator: any;

  beforeAll(async () => {
    const mod = await import('../../../src/validators/fileformat-confirmation.validator.js');
    validator = mod.default;
  });

  it('should accept true', async () => {
    const result = await runValidation(validator, { fileformat_confirmation: true });
    expect(result.isEmpty()).toBe(true);
  });

  it('should accept false', async () => {
    const result = await runValidation(validator, { fileformat_confirmation: false });
    expect(result.isEmpty()).toBe(true);
  });

  it('should reject missing field', async () => {
    const result = await runValidation(validator, {});
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject non-boolean value', async () => {
    const result = await runValidation(validator, { fileformat_confirmation: 123 });
    expect(result.isEmpty()).toBe(false);
  });
});
