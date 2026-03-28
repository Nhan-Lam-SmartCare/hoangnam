import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormattedNumberInput } from "../../src/components/common/FormattedNumberInput";

// Minimal harness to test validation behavior (disallow negatives, clamp big values)
function ValidatedInputs() {
  const [qty, setQty] = React.useState(1);
  const [cost, setCost] = React.useState(0);
  return (
    <div>
      <FormattedNumberInput
        ariaLabel="qty"
        value={qty}
        onValue={(v) => setQty(Math.max(1, Math.round(v)))}
      />
      <FormattedNumberInput
        ariaLabel="cost"
        value={cost}
        onValue={(v) =>
          setCost(Math.max(0, Math.round(v > 50_000_000 ? 50_000_000 : v)))
        }
      />
    </div>
  );
}

describe("Validation rules", () => {
  it("prevents negative values and clamps at threshold", () => {
    render(<ValidatedInputs />);
    const qty = screen.getByLabelText("qty") as HTMLInputElement;
    const cost = screen.getByLabelText("cost") as HTMLInputElement;

    fireEvent.change(qty, { target: { value: "-5" } });
    fireEvent.blur(qty);
    expect(Number(qty.value.replace(/\D/g, ""))).toBe(1);

    fireEvent.change(cost, { target: { value: "60000000" } });
    fireEvent.blur(cost);
    // expect formatted to 50.000.000
    expect(cost.value.replace(/\s/g, "")).toBe("50.000.000");
  });
});
