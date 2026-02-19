import { describe, it, expect } from 'vitest';
import { validationResult } from 'express-validator';

const mockReq = (body: any) => ({
  body,
  query: {},
  params: {},
  headers: {},
  get: () => undefined,
});

async function runValidation(schema: any, body: any) {
  const req = mockReq(body);
  await schema.run(req);
  return validationResult(req);
}

describe('project.validator', () => {
  let projectValidator: any;

  beforeAll(async () => {
    const mod = await import('../../../src/validators/project.validator.js');
    projectValidator = mod.default;
  });

  it('should accept valid project body', async () => {
    const result = await runValidation(projectValidator, {
      name: 'My Project',
      description: 'A test project',
    });
    expect(result.isEmpty()).toBe(true);
  });

  it('should reject missing name', async () => {
    const result = await runValidation(projectValidator, {
      description: 'A test project',
    });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject name longer than 200 chars', async () => {
    const result = await runValidation(projectValidator, {
      name: 'a'.repeat(201),
      description: 'A test project',
    });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject non-string name', async () => {
    const result = await runValidation(projectValidator, {
      name: 12345,
      description: 'A test project',
    });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject missing description', async () => {
    const result = await runValidation(projectValidator, {
      name: 'My Project',
    });
    expect(result.isEmpty()).toBe(false);
  });

  it('should reject non-string description', async () => {
    const result = await runValidation(projectValidator, {
      name: 'My Project',
      description: 12345,
    });
    expect(result.isEmpty()).toBe(false);
  });
});
