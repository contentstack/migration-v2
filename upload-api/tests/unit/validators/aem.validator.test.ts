import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockValidator } = vi.hoisted(() => ({
  mockValidator: vi.fn(),
}));

vi.mock('migration-aem', () => ({
  validator: mockValidator,
}));

import aemValidator from '../../../src/validators/aem/index';

describe('aemValidator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when at least one validation passes', async () => {
    mockValidator.mockResolvedValue([false, true, false]);
    const result = await aemValidator({ data: '/path/to/aem' });
    expect(result).toBe(true);
  });

  it('should return false when all validations fail', async () => {
    mockValidator.mockResolvedValue([false, false, false]);
    const result = await aemValidator({ data: '/path/to/aem' });
    expect(result).toBe(false);
  });

  it('should return false when validation returns empty array', async () => {
    mockValidator.mockResolvedValue([]);
    const result = await aemValidator({ data: '/path/to/aem' });
    expect(result).toBe(false);
  });

  it('should return false when validation returns non-array', async () => {
    mockValidator.mockResolvedValue(null);
    const result = await aemValidator({ data: '/path/to/aem' });
    expect(result).toBe(false);
  });

  it('should return false on error', async () => {
    mockValidator.mockRejectedValue(new Error('AEM validation error'));
    const result = await aemValidator({ data: '/path/to/aem' });
    expect(result).toBe(false);
  });

  it('should return true when all validations pass', async () => {
    mockValidator.mockResolvedValue([true, true, true]);
    const result = await aemValidator({ data: '/path/to/aem' });
    expect(result).toBe(true);
  });
});
