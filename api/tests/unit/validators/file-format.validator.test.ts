import { describe, it, expect, beforeAll } from 'vitest';
import { validationResult } from 'express-validator';

const mockReq = (body: any) => ({ body, query: {}, params: {}, headers: {}, get: () => undefined });

async function runValidation(schema: any, body: any) {
  const req = mockReq(body);
  await schema.run(req);
  return validationResult(req);
}

describe('file-format.validator', () => {
  let validator: any;

  beforeAll(async () => {
    const mod = await import('../../../src/validators/file-format.validator.js');
    validator = mod.default;
  });

  it('should accept valid file_format', async () => {
    const result = await runValidation(validator, { file_format: 'json' });
    expect(result.isEmpty()).toBe(true);
  });

  it('should reject missing file_format', async () => {
    const result = await runValidation(validator, {});
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject non-string', async () => {
    const result = await runValidation(validator, { file_format: 123 });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject empty string', async () => {
    const result = await runValidation(validator, { file_format: '' });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject string exceeding 200 chars', async () => {
    const result = await runValidation(validator, { file_format: 'a'.repeat(201) });
    expect(result.isEmpty()).toBe(false);
  });
});
