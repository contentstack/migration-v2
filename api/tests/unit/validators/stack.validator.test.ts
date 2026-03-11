import { describe, it, expect, beforeAll } from 'vitest';
import { validationResult } from 'express-validator';

const mockReq = (body: any) => ({ body, query: {}, params: {}, headers: {}, get: () => undefined });

async function runValidation(schema: any, body: any) {
  const req = mockReq(body);
  await schema.run(req);
  return validationResult(req);
}

describe('stack.validator', () => {
  let validator: any;

  beforeAll(async () => {
    const mod = await import('../../../src/validators/stack.validator.js');
    validator = mod.default;
  });

  it('should accept valid name and description', async () => {
    const result = await runValidation(validator, { name: 'My Stack', description: 'A test stack' });
    expect(result.isEmpty()).toBe(true);
  });

  it('should reject missing name', async () => {
    const result = await runValidation(validator, { description: 'A test stack' });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject non-string name', async () => {
    const result = await runValidation(validator, { name: 123, description: 'A test stack' });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject name exceeding 255 chars', async () => {
    const result = await runValidation(validator, { name: 'a'.repeat(256), description: 'A test stack' });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject missing description', async () => {
    const result = await runValidation(validator, { name: 'My Stack' });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject description exceeding 512 chars', async () => {
    const result = await runValidation(validator, { name: 'My Stack', description: 'a'.repeat(513) });
    expect(result.isEmpty()).toBe(false);
  });

  it('should accept empty description', async () => {
    const result = await runValidation(validator, { name: 'My Stack', description: '' });
    expect(result.isEmpty()).toBe(true);
  });
});
