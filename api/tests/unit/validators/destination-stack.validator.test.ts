import { describe, it, expect, beforeAll } from 'vitest';
import { validationResult } from 'express-validator';

const mockReq = (body: any) => ({ body, query: {}, params: {}, headers: {}, get: () => undefined });

async function runValidation(schema: any, body: any) {
  const req = mockReq(body);
  await schema.run(req);
  return validationResult(req);
}

describe('destination-stack.validator', () => {
  let validator: any;

  beforeAll(async () => {
    const mod = await import('../../../src/validators/destination-stack.validator.js');
    validator = mod.default;
  });

  it('should accept valid stack_api_key', async () => {
    const result = await runValidation(validator, { stack_api_key: 'blt0000000000000000' });
    expect(result.isEmpty()).toBe(true);
  });

  it('should reject missing stack_api_key', async () => {
    const result = await runValidation(validator, {});
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject non-string stack_api_key', async () => {
    const result = await runValidation(validator, { stack_api_key: 123 });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject stack_api_key exceeding max length', async () => {
    const result = await runValidation(validator, { stack_api_key: 'a'.repeat(201) });
    expect(result.isEmpty()).toBe(false);
  });
});
