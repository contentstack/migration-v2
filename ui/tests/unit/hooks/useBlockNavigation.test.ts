import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockLocation = { pathname: '/migration', search: '', hash: '' };

vi.mock('react-router-dom', () => ({
  useLocation: () => mockLocation
}));

vi.mock('../../../src/utilities/constants', () => ({
  WEBSITE_BASE_URL: 'https://test.contentstack.com'
}));

import useBlockNavigation from '../../../src/hooks/userNavigation';

describe('hooks/useBlockNavigation', () => {
  let pushStateSpy: ReturnType<typeof vi.spyOn>;
  let addEventSpy: ReturnType<typeof vi.spyOn>;
  let removeEventSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
    addEventSpy = vi.spyOn(window, 'addEventListener');
    removeEventSpy = vi.spyOn(window, 'removeEventListener');
  });

  it('should not push state or add listener when modal is closed', () => {
    renderHook(() => useBlockNavigation(false));
    expect(pushStateSpy).not.toHaveBeenCalled();
    expect(addEventSpy).not.toHaveBeenCalledWith('popstate', expect.any(Function));
  });

  it('should push state and add popstate listener when modal is open', () => {
    renderHook(() => useBlockNavigation(true));

    expect(pushStateSpy).toHaveBeenCalledWith(
      { blockNav: true },
      '',
      '/migration'
    );
    expect(addEventSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
  });

  it('should remove popstate listener on unmount', () => {
    const { unmount } = renderHook(() => useBlockNavigation(true));
    unmount();
    expect(removeEventSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
  });

  it('should re-push state on popstate when modal is open', () => {
    renderHook(() => useBlockNavigation(true));

    const handler = addEventSpy.mock.calls.find(
      (call) => call[0] === 'popstate'
    )?.[1] as EventListener;

    pushStateSpy.mockClear();
    handler(new PopStateEvent('popstate'));

    expect(pushStateSpy).toHaveBeenCalledWith(
      { blockNav: true },
      '',
      '/migration'
    );
  });

  it('should update stored pathname when modal closes', () => {
    const { rerender } = renderHook(
      ({ isOpen }) => useBlockNavigation(isOpen),
      { initialProps: { isOpen: true } }
    );

    rerender({ isOpen: false });

    pushStateSpy.mockClear();
    rerender({ isOpen: true });

    expect(pushStateSpy).toHaveBeenCalledWith(
      { blockNav: true },
      '',
      '/migration'
    );
  });
});
