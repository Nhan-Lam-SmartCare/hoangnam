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

const nf = new Intl.NumberFormat("vi-VN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function parseToNumber(input: string): number {
  // Accept both dot and comma for decimal; vi-VN uses comma
  // Remove spaces and currency symbols
  let s = input.replace(/[^0-9.,-]/g, "");
  // Normalize: if both comma and dot exist, assume dot thousands, comma decimal
  const hasDot = s.includes(".");
  const hasComma = s.includes(",");
  if (hasDot && hasComma) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma && !hasDot) {
    // only comma -> decimal
    s = s.replace(",", ".");
  } // only dot -> decimal already
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export const FormattedNumberInput: React.FC<FormattedNumberInputProps> = ({
  value,
  onValue,
  placeholder,
  className,
  min,
  max,
  disabled,
  ariaLabel,
}) => {
  const [display, setDisplay] = React.useState<string>(
    value !== undefined && value !== null ? nf.format(value) : ""
  );
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    // Sync when external value changes (e.g., programmatic updates)
    if (!isEditing) {
      setDisplay(value !== undefined && value !== null ? nf.format(value) : "");
    }
  }, [value, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setDisplay(raw);
    const parsed = parseToNumber(raw);

    // Only enforce max during typing if it's way out of bounds? 
    // Actually, better to just let parent handle validation or do it on blur.
    // But for now, let's pass the parsed value directly.
    onValue(parsed);
  };

  const handleBlur = () => {
    setIsEditing(false);
    let finalVal = value;
    if (min !== undefined && finalVal < min) finalVal = min;
    if (max !== undefined && finalVal > max) finalVal = max;

    if (finalVal !== value) onValue(finalVal);

    setDisplay(finalVal !== undefined && finalVal !== null ? nf.format(finalVal) : "");
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={display}
      onChange={handleChange}
      onFocus={() => setIsEditing(true)}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      aria-label={ariaLabel}
    />
  );
};

export default FormattedNumberInput;
