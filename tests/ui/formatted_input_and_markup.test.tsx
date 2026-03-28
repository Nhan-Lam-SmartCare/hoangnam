import { describe, it, expect } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { FormattedNumberInput } from "../../src/components/common/FormattedNumberInput";

function Wrapper() {
  const [cost, setCost] = React.useState(0);
  const [price, setPrice] = React.useState(0);
  // mimic auto 50% when cost changes until price manually changed
  const [overridden, setOverridden] = React.useState(false);
  return (
    <div>
      <FormattedNumberInput
        ariaLabel="cost"
        value={cost}
        onValue={(v) => {
          setCost(v);
          if (!overridden) setPrice(Math.round(v * 1.5));
        }}
      />
      <FormattedNumberInput
        ariaLabel="price"
        value={price}
        onValue={(v) => {
          setPrice(v);
          setOverridden(true);
        }}
      />
    </div>
  );
}

describe("FormattedNumberInput + 50% markup", () => {
  it("formats with thousand separators and applies 50% auto markup until override", () => {
    render(<Wrapper />);
    const cost = screen.getByLabelText("cost") as HTMLInputElement;
    const price = screen.getByLabelText("price") as HTMLInputElement;

    // type 10000 -> should format to 10.000 on blur
    fireEvent.change(cost, { target: { value: "10000" } });
    fireEvent.blur(cost);
    expect(cost.value.replace(/\s/g, "")).toBe("10.000");

    // price should be auto 15000 -> 15.000
    fireEvent.blur(price);
    expect(price.value.replace(/\s/g, "")).toBe("15.000");

    // user overrides price to 20.000
    fireEvent.change(price, { target: { value: "20000" } });
    fireEvent.blur(price);
    expect(price.value.replace(/\s/g, "")).toBe("20.000");

    // change cost to 5000; price should remain 20.000 because overridden
    fireEvent.change(cost, { target: { value: "5000" } });
    fireEvent.blur(cost);
    expect(price.value.replace(/\s/g, "")).toBe("20.000");
  });
});
