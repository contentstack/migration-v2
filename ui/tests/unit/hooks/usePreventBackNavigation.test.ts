import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockNavigate = vi.fn();
const mockLocation = { pathname: '/projects', search: '?id=1', hash: '#top' };

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation
}));

vi.mock('../../../src/utilities/constants', () => ({
  WEBSITE_BASE_URL: 'https://test.contentstack.com'
}));

import usePreventBackNavigation from '../../../src/hooks/usePreventBackNavigation';

describe('hooks/usePreventBackNavigation', () => {
  let pushStateSpy: ReturnType<typeof vi.spyOn>;
  let addEventSpy: ReturnType<typeof vi.spyOn>;
  let removeEventSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    pushStateSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => {});
    addEventSpy = vi.spyOn(window, 'addEventListener');
    removeEventSpy = vi.spyOn(window, 'removeEventListener');
  });

  it('should push history state on mount', () => {
    renderHook(() => usePreventBackNavigation());

    expect(pushStateSpy).toHaveBeenCalledWith(
      { preventBack: true },
      '',
      '/projects?id=1#top'
    );
  });

  it('should add popstate event listener', () => {
    renderHook(() => usePreventBackNavigation());
    expect(addEventSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
  });

  it('should remove popstate event listener on unmount', () => {
    const { unmount } = renderHook(() => usePreventBackNavigation());
    unmount();
    expect(removeEventSpy).toHaveBeenCalledWith('popstate', expect.any(Function));
  });

  it('should push state again on popstate (back navigation)', () => {
    renderHook(() => usePreventBackNavigation());

    const handler = addEventSpy.mock.calls.find(
      (call) => call[0] === 'popstate'
    )?.[1] as EventListener;

    pushStateSpy.mockClear();
    const event = new PopStateEvent('popstate');
    handler(event);

    expect(pushStateSpy).toHaveBeenCalledWith(
      { preventBack: true },
      '',
      '/projects?id=1#top'
    );
  });
});
