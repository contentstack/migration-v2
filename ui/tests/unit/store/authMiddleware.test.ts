import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGetUserDetails } = vi.hoisted(() => ({
  mockGetUserDetails: vi.fn()
}));

vi.mock('../../../src/store/slice/authSlice', () => ({
  getUserDetails: mockGetUserDetails,
  default: (state = {}) => state
}));

import authMiddleware from '../../../src/store/middleware/authMiddleware';

describe('store/middleware/authMiddleware', () => {
  let dispatch: ReturnType<typeof vi.fn>;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dispatch = vi.fn();
    next = vi.fn();
    vi.clearAllMocks();
  });

  it('should dispatch getUserDetails on @@INIT action', () => {
    const middleware = authMiddleware({ dispatch, getState: vi.fn() } as any)(next);
    middleware({ type: '@@INIT' });

    expect(dispatch).toHaveBeenCalledWith(mockGetUserDetails());
  });

  it('should call next for any action', () => {
    const middleware = authMiddleware({ dispatch, getState: vi.fn() } as any)(next);
    const action = { type: 'SOME_ACTION' };

    middleware(action);
    expect(next).toHaveBeenCalledWith(action);
  });

  it('should not dispatch getUserDetails for non-INIT actions', () => {
    const middleware = authMiddleware({ dispatch, getState: vi.fn() } as any)(next);
    middleware({ type: 'OTHER_ACTION' });

    expect(dispatch).not.toHaveBeenCalled();
  });

  it('should always pass action to next', () => {
    const middleware = authMiddleware({ dispatch, getState: vi.fn() } as any)(next);
    const action = { type: '@@INIT' };

    const result = middleware(action);
    expect(next).toHaveBeenCalledWith(action);
  });
});
