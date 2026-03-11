import { describe, it, expect, beforeAll } from 'vitest';
import { validationResult } from 'express-validator';

const mockReq = (body: any) => ({ body, query: {}, params: {}, headers: {}, get: () => undefined });

async function runValidation(schema: any, body: any) {
  const req = mockReq(body);
  await schema.run(req);
  return validationResult(req);
}

describe('cms.validator', () => {
  let validator: any;

  beforeAll(async () => {
    const mod = await import('../../../src/validators/cms.validator.js');
    validator = mod.default;
  });

  it('should accept valid legacy_cms', async () => {
    const result = await runValidation(validator, { legacy_cms: 'wordpress' });
    expect(result.isEmpty()).toBe(true);
  });

  it('should reject missing legacy_cms', async () => {
    const result = await runValidation(validator, {});
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject non-string legacy_cms', async () => {
    const result = await runValidation(validator, { legacy_cms: 123 });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject legacy_cms exceeding max length', async () => {
    const result = await runValidation(validator, { legacy_cms: 'a'.repeat(201) });
    expect(result.isEmpty()).toBe(false);
  });
});
