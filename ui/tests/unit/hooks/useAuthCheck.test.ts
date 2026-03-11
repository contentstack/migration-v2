import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import React from 'react';

const mockNavigate = vi.fn();
const mockDispatch = vi.fn();
const mockSelector = vi.fn();

vi.mock('react-redux', () => ({
  useSelector: (fn: any) => mockSelector(fn),
  useDispatch: () => mockDispatch
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}));

vi.mock('jwt-decode', () => ({
  jwtDecode: vi.fn()
}));

vi.mock('../../../src/store/slice/authSlice', () => ({
  reInitiliseState: vi.fn(() => ({ type: 'auth/reInitiliseState' }))
}));

import useAuthCheck from '../../../src/hooks/authentication';
import { jwtDecode } from 'jwt-decode';
import { reInitiliseState } from '../../../src/store/slice/authSlice';

describe('hooks/useAuthCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockClear();
    mockDispatch.mockClear();
  });

  it('should not dispatch or navigate when authToken is falsy', () => {
    let callCount = 0;
    mockSelector.mockImplementation(() => {
      callCount++;
      if (callCount % 2 === 1) return ''; // authToken
      return {}; // selectedOrganisation
    });

    renderHook(() => useAuthCheck());

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should not dispatch if token is valid (not expired)', () => {
    let callCount = 0;
    mockSelector.mockImplementation(() => {
      callCount++;
      if (callCount % 2 === 1) return 'valid-token';
      return {};
    });

    const futureExp = (Date.now() / 1000) + 3600;
    vi.mocked(jwtDecode).mockReturnValue({ exp: futureExp });

    renderHook(() => useAuthCheck());

    expect(mockDispatch).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should dispatch reInitiliseState and navigate to "/" when token is expired', () => {
    let callCount = 0;
    mockSelector.mockImplementation(() => {
      callCount++;
      if (callCount % 2 === 1) return 'expired-token';
      return {};
    });

    const pastExp = (Date.now() / 1000) - 3600;
    vi.mocked(jwtDecode).mockReturnValue({ exp: pastExp });

    renderHook(() => useAuthCheck());

    expect(mockDispatch).toHaveBeenCalledWith(reInitiliseState());
    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('should dispatch reInitiliseState and navigate on jwtDecode error', () => {
    let callCount = 0;
    mockSelector.mockImplementation(() => {
      callCount++;
      if (callCount % 2 === 1) return 'bad-token';
      return {};
    });

    vi.mocked(jwtDecode).mockImplementation(() => {
      throw new Error('Invalid token');
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderHook(() => useAuthCheck());

    expect(mockDispatch).toHaveBeenCalledWith(reInitiliseState());
    expect(mockNavigate).toHaveBeenCalledWith('/');
    consoleSpy.mockRestore();
  });
});
