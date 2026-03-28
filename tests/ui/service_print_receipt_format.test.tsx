import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ServiceReceiptPreview from "../../src/components/service/ServiceReceiptPreview";
import { formatWorkOrderId } from "../../src/utils/format";

const workOrder = {
  id: "WO-1699999999000",
  creationDate: new Date(2024, 10, 1).toISOString(),
  customerName: "Khách Test",
  customerPhone: "0123456789",
  partsUsed: [{ name: "Part X", quantity: 1, price: 100 }],
  total: 100,
};

describe("ServiceReceiptPreview formatted id", () => {
  it("shows formatted work order ID using store prefix", async () => {
    const formatted = formatWorkOrderId(workOrder.id, "SC");
    render(
      <ServiceReceiptPreview
        workOrder={workOrder as any}
        storeSettings={{ work_order_prefix: "SC" }}
      />
    );

    expect(await screen.findByText(new RegExp(formatted))).not.toBeNull();
  });
});
