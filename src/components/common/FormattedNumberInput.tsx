import React from "react";

// A controlled number input that formats with thousand separators (vi-VN)
// Props: value (number), onValue(number), placeholder, className, min
export interface FormattedNumberInputProps {
  value: number;
  onValue: (v: number) => void;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  ariaLabel?: string;
}

const nf = new Intl.NumberFormat("vi-VN");

/**
 * Parse Vietnamese formatted string (e.g. "1.000.000" or "10.000") to integer
 * Strips all non-digit characters so thousands separators never break parsing.
 */
function parseDigitsToNumber(input: string): number {
  if (!input) return 0;
  const digitsOnly = input.replace(/[^0-9]/g, "");
  if (!digitsOnly) return 0;
  const n = parseInt(digitsOnly, 10);
  return Number.isFinite(n) ? n : 0;
}

export const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({
  value,
  onValue,
  placeholder = "0",
  className,
  min,
  max,
  disabled,
  ariaLabel,
}) => {
  // Format value to string: if 0, show "" so input is empty by default and placeholder shows
  const formatDisplay = (num: number | undefined | null): string => {
    if (num === undefined || num === null || num === 0) return "";
    return nf.format(num);
  };

  const [display, setDisplay] = React.useState<string>(() => formatDisplay(value));
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    if (!isFocused) {
      setDisplay(formatDisplay(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const parsed = parseDigitsToNumber(raw);

    // Pass numeric value back to parent
    onValue(parsed);

    if (!raw || parsed === 0) {
      setDisplay("");
    } else {
      setDisplay(nf.format(parsed));
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    setIsFocused(true);
    // Auto-select text on focus so user can type over existing value immediately
    e.target.select();
  };

  const handleBlur = () => {
    setIsFocused(false);
    let finalVal = value;
    if (min !== undefined && finalVal < min) finalVal = min;
    if (max !== undefined && finalVal > max) finalVal = max;

    if (finalVal !== value) onValue(finalVal);
    setDisplay(formatDisplay(finalVal));
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      aria-label={ariaLabel}
    />
  );
};

export default FormattedNumberInput;
