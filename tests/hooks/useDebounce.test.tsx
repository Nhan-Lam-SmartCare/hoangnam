import React, { useState } from "react";
import { render, fireEvent, screen } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import { describe, it, expect, vi } from "vitest";
import { useDebounce } from "../../src/hooks/useDebounce";

function TestComponent() {
  const [value, setValue] = useState("");
  const debounced = useDebounce(value, 300);
  return (
    <div>
      <input
        aria-label="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <output aria-label="debounced">{debounced}</output>
    </div>
  );
}

describe("useDebounce hook", () => {
  it("cập nhật sau 300ms không đổi", () => {
    vi.useFakeTimers();
    render(<TestComponent />);
    const input = screen.getByLabelText("search");
    const out = screen.getByLabelText("debounced");

    expect(out.textContent).toBe("");

    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.change(input, { target: { value: "abc" } });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(out.textContent).toBe("");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(out.textContent).toBe("abc");

    fireEvent.change(input, { target: { value: "abcd" } });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(out.textContent).toBe("abc");
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(out.textContent).toBe("abcd");

    vi.useRealTimers();
  });
});
