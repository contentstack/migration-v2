import { describe, it, expect, vi, beforeAll } from 'vitest';

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

describe('validators/index', () => {
  let validatorFactory: any;

  beforeAll(async () => {
    const mod = await import('../../../src/validators/index.js');
    validatorFactory = mod.default;
  });

  it('should export a function', () => {
    expect(typeof validatorFactory).toBe('function');
  });

  it('should return a middleware function for each supported route', () => {
    const routes = ['auth', 'project', 'cms', 'file_format', 'destination_stack', 'affix', 'affix_confirmation_validator', 'fileformat_confirmation_validator', 'stack'];
    for (const route of routes) {
      const middleware = validatorFactory(route);
      expect(typeof middleware).toBe('function');
    }
  });

  it('should call next() when auth validation passes', async () => {
    const middleware = validatorFactory('auth');
    const req = {
      body: { email: 'test@example.com', password: 'pass123', region: 'NA' },
      query: {}, params: {}, headers: {}, get: () => undefined,
    };
    const res = {};
    const next = vi.fn();
    middleware(req, res, next);
    await flushPromises();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('should call next with error when auth validation fails', async () => {
    const middleware = validatorFactory('auth');
    const req = {
      body: {},
      query: {}, params: {}, headers: {}, get: () => undefined,
    };
    const res = {};
    const next = vi.fn();
    middleware(req, res, next);
    await flushPromises();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeDefined();
  });

  it('should call next() when cms validation passes', async () => {
    const middleware = validatorFactory('cms');
    const req = {
      body: { legacy_cms: 'wordpress' },
      query: {}, params: {}, headers: {}, get: () => undefined,
    };
    const res = {};
    const next = vi.fn();
    middleware(req, res, next);
    await flushPromises();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeUndefined();
  });

  it('should call next with error when cms validation fails', async () => {
    const middleware = validatorFactory('cms');
    const req = {
      body: {},
      query: {}, params: {}, headers: {}, get: () => undefined,
    };
    const res = {};
    const next = vi.fn();
    middleware(req, res, next);
    await flushPromises();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeDefined();
  });
});
