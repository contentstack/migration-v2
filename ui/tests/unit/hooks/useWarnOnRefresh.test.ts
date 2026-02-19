import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useWarnOnRefresh } from '../../../src/hooks/useWarnOnrefresh';

describe('hooks/useWarnOnRefresh', () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addSpy = vi.spyOn(window, 'addEventListener');
    removeSpy = vi.spyOn(window, 'removeEventListener');
  });

  it('should add beforeunload event listener on mount', () => {
    renderHook(() => useWarnOnRefresh(true));
    expect(addSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('should remove beforeunload event listener on unmount', () => {
    const { unmount } = renderHook(() => useWarnOnRefresh(true));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('should call preventDefault when isUnsaved is true', () => {
    renderHook(() => useWarnOnRefresh(true));

    const handler = addSpy.mock.calls.find(
      (call) => call[0] === 'beforeunload'
    )?.[1] as EventListener;

    const event = new Event('beforeunload') as BeforeUnloadEvent;
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    handler(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('should not call preventDefault when isUnsaved is false', () => {
    renderHook(() => useWarnOnRefresh(false));

    const handler = addSpy.mock.calls.find(
      (call) => call[0] === 'beforeunload'
    )?.[1] as EventListener;

    const event = new Event('beforeunload') as BeforeUnloadEvent;
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    handler(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });
});
