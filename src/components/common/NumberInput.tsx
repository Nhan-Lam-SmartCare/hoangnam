import React, { useState, useEffect, useCallback, useRef } from "react";
import { formatNumberWithDots, parseFormattedNumber } from "../../utils/format";

interface NumberInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "value"
  > {
  value: number | string | null | undefined;
  onChange: (value: number) => void;
  /** Whether to allow decimal numbers */
  allowDecimal?: boolean;
  /** Whether to allow negative numbers */
  allowNegative?: boolean;
  /** Suffix to display (e.g., "đ", "%") */
  suffix?: string;
}

/**
 * Number input with Vietnamese thousand separator formatting (dots)
 *
 * Displays numbers with dots (e.g., 1.500.000) while editing,
 * and returns clean numeric values on change.
 */
export const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  allowDecimal = false,
  allowNegative = false,
  suffix,
  className,
  ...props
}) => {
  const [displayValue, setDisplayValue] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync display value when external value changes
  useEffect(() => {
    // 🔹 FIX 2: Only sync if input is NOT focused to prevent cursor jump/focus loss during typing
    if (document.activeElement === inputRef.current) {
      return;
    }

    // 🔹 FIX 1: Don't overwrite if user is in the middle of typing a minus sign
    if (displayValue === "-" && (value === 0 || value === "" || value === null)) {
      return;
    }

    const numValue =
      typeof value === "string" ? parseFormattedNumber(value) : value ?? 0;

    const currentNumInDisplay = parseFormattedNumber(displayValue);
    if (numValue !== currentNumInDisplay || (displayValue === "" && numValue !== 0)) {
      setDisplayValue(numValue ? formatNumberWithDots(numValue) : "");
    }
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value;

      // Allow empty input
      if (inputValue === "") {
        setDisplayValue("");
        onChange(0);
        return;
      }

      // Check for negative sign
      const isNegative = allowNegative && inputValue.startsWith("-");

      // 🔹 Cho phép nhập chỉ dấu "-" mà chưa có số
      if (allowNegative && (inputValue === "-" || inputValue === "")) {
        if (inputValue === "-") {
          setDisplayValue("-");
          return; // Không gọi onChange cho đến khi có số
        }
      }

      // Remove all non-numeric characters except dots and commas
      let cleaned = inputValue.replace(/[^\d.,]/g, "");

      // For decimal, replace comma with dot for parsing
      if (allowDecimal) {
        // Keep only the last decimal separator
        const parts = cleaned.split(/[.,]/);
        if (parts.length > 2) {
          cleaned = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
        } else if (parts.length === 2) {
          cleaned = parts[0] + "." + parts[1];
        }
      } else {
        // Remove all dots and commas for integer
        cleaned = cleaned.replace(/[.,]/g, "");
      }

      // Parse to number
      let numValue = parseFloat(cleaned);

      if (isNaN(numValue)) {
        if (isNegative) {
          setDisplayValue("-");
          return;
        }
        setDisplayValue("");
        onChange(0);
        return;
      }

      // Apply negative sign if needed
      if (isNegative) {
        numValue = -Math.abs(numValue);
      }

      // Format and display
      if (allowDecimal) {
        // For decimals, format integer part and keep decimal part
        const [intPart, decPart] = cleaned.split(".");
        const formattedInt = formatNumberWithDots(parseInt(intPart) || 0);
        const formatted =
          decPart !== undefined ? `${formattedInt},${decPart}` : formattedInt;
        setDisplayValue(isNegative ? `-${formatted}` : formatted);
      } else {
        const formatted = formatNumberWithDots(Math.abs(numValue));
        setDisplayValue(isNegative ? `-${formatted}` : formatted);
      }

      onChange(numValue);
    },
    [onChange, allowDecimal, allowNegative]
  );

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      // 🔹 FIX: avoid full selection on iOS if it causes jumps, 
      // but keeping it for now as it's standard. 
      // Added check for mobile to be safe.
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (!isMobile) {
        e.target.select();
      }
      props.onFocus?.(e);
    },
    [props]
  );

  return (
    <div className="relative">
      <input
        {...props}
        ref={inputRef}
        type="text"
        /* 🔹 FIX: use "text" inputMode for negative numbers on iOS 
           to ensure minus sign is available. If user still sees numeric keyboard,
           then hot reload might be failing. */
        inputMode={allowNegative ? "text" : "numeric"}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        className={className}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
      />
      {suffix && displayValue && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          {suffix}
        </span>
      )}
    </div>
  );
};

export default NumberInput;
