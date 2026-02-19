import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDebouncer } from '../../../src/hooks/index';

describe('hooks/useDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should debounce the callback', () => {
    const callback = vi.fn();
    const debounced = useDebouncer(callback, 300);

    debounced('arg1');
    debounced('arg2');
    debounced('arg3');

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('arg3');
  });

  it('should use 250ms as default wait time', () => {
    const callback = vi.fn();
    const debounced = useDebouncer(callback);

    debounced();
    vi.advanceTimersByTime(249);
    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should reset the timer on each call', () => {
    const callback = vi.fn();
    const debounced = useDebouncer(callback, 100);

    debounced('first');
    vi.advanceTimersByTime(80);

    debounced('second');
    vi.advanceTimersByTime(80);

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(20);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('second');
  });

  it('should pass multiple arguments to the callback', () => {
    const callback = vi.fn();
    const debounced = useDebouncer(callback, 100);

    debounced('arg1', 'arg2', 42);
    vi.advanceTimersByTime(100);

    expect(callback).toHaveBeenCalledWith('arg1', 'arg2', 42);
  });

  it('should allow separate invocations after wait period', () => {
    const callback = vi.fn();
    const debounced = useDebouncer(callback, 100);

    debounced('first');
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledWith('first');

    debounced('second');
    vi.advanceTimersByTime(100);
    expect(callback).toHaveBeenCalledWith('second');
    expect(callback).toHaveBeenCalledTimes(2);
  });
});
