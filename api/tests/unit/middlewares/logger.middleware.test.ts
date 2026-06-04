import { describe, it, expect } from 'vitest';

describe('logger.middleware', () => {
  it('exports express-winston middleware', async () => {
    const mod = await import('../../../src/middlewares/logger.middleware.js');
    expect(mod.default).toBeDefined();
  });
});
