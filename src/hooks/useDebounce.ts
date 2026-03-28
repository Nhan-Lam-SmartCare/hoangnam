import { useEffect, useState } from "react";

/**
 * useDebounce
 * Trả về giá trị đã được "debounce" sau một khoảng trễ (delay ms).
 * Mỗi lần value thay đổi sẽ reset timer; chỉ cập nhật debouncedValue
 * sau khi không có thay đổi mới trong khoảng delay.
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);

  return debounced;
}

/**
 * Tiện ích: debounce callback (thường dùng cho sự kiện liên tục như resize, keypress).
 */
export function debounceFn<F extends (...args: any[]) => void>(
  fn: F,
  delay: number
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<F>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
