/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useDebounce, debounceFn } from "../../src/hooks/useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial", 500));
    expect(result.current).toBe("initial");
  });

  it("should debounce value changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "first", delay: 500 } }
    );

    expect(result.current).toBe("first");

    // Change value
    rerender({ value: "second", delay: 500 });

    // Value should still be 'first' before delay
    expect(result.current).toBe("first");

    // Fast-forward time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Now should be updated
    expect(result.current).toBe("second");
  });

  it("should reset timer on rapid changes", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 300 } }
    );

    // Rapid changes
    rerender({ value: "b", delay: 300 });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: "c", delay: 300 });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    rerender({ value: "d", delay: 300 });

    // Should still be 'a' as timer keeps resetting
    expect(result.current).toBe("a");

    // Wait full delay after last change
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should now be 'd' (last value)
    expect(result.current).toBe("d");
  });

  it("should handle number values", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 0, delay: 200 } }
    );

    expect(result.current).toBe(0);

    rerender({ value: 42, delay: 200 });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe(42);
  });

  it("should handle object values", () => {
    const initialObj = { name: "test" };
    const newObj = { name: "updated" };

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: initialObj, delay: 100 } }
    );

    expect(result.current).toBe(initialObj);

    rerender({ value: newObj, delay: 100 });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe(newObj);
  });
});

describe("debounceFn", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should debounce function calls", () => {
    const callback = vi.fn();
    const debouncedFn = debounceFn(callback, 300);

    debouncedFn();
    debouncedFn();
    debouncedFn();

    expect(callback).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("should pass arguments to debounced function", () => {
    const callback = vi.fn();
    const debouncedFn = debounceFn(callback, 200);

    debouncedFn("arg1", "arg2");

    vi.advanceTimersByTime(200);

    expect(callback).toHaveBeenCalledWith("arg1", "arg2");
  });

  it("should use latest arguments when called multiple times", () => {
    const callback = vi.fn();
    const debouncedFn = debounceFn(callback, 200);

    debouncedFn("first");
    debouncedFn("second");
    debouncedFn("third");

    vi.advanceTimersByTime(200);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("third");
  });
});
