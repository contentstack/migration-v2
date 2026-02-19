import { describe, it, expect, beforeAll } from 'vitest';
import { validationResult } from 'express-validator';

const mockReq = (body: any) => ({ body, query: {}, params: {}, headers: {}, get: () => undefined });

async function runValidation(schema: any, body: any) {
  const req = mockReq(body);
  await schema.run(req);
  return validationResult(req);
}

describe('affix.validator', () => {
  let validator: any;

  beforeAll(async () => {
    const mod = await import('../../../src/validators/affix.validator.js');
    validator = mod.default;
  });

  it('should accept valid affix', async () => {
    const result = await runValidation(validator, { affix: 'abc12' });
    expect(result.isEmpty()).toBe(true);
  });

  it('should reject missing affix', async () => {
    const result = await runValidation(validator, {});
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject non-string affix', async () => {
    const result = await runValidation(validator, { affix: 123 });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject affix starting with number', async () => {
    const result = await runValidation(validator, { affix: '1abc' });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject affix with special characters', async () => {
    const result = await runValidation(validator, { affix: 'ab-c' });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject affix exceeding 5 chars', async () => {
    const result = await runValidation(validator, { affix: 'abcdef' });
    expect(result.isEmpty()).toBe(false);
  });
});
