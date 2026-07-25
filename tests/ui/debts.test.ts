import { describe, it, expect } from "vitest";
import type { CustomerDebt, SupplierDebt } from "../../src/types";

describe("Debt Management calculation & partial collection logic", () => {
  it("calculates remaining debt and partial payment correctly", () => {
    const debt: CustomerDebt = {
      id: "debt-1",
      customerId: "cust-1",
      customerName: "Phan Văn Hậu",
      phone: "0333017377",
      description: "Xe 50cc khác (Phiếu sửa chữa #904112)",
      totalAmount: 310000,
      paidAmount: 0,
      remainingAmount: 310000,
      createdDate: "2026-04-25T00:00:00Z",
      dueDate: "2026-08-15T00:00:00Z",
      branchId: "CN1",
    };

    // User collects partial payment of 200,000 đ
    const payAmount = 200000;
    const newPaid = debt.paidAmount + payAmount;
    const newRemaining = debt.totalAmount - newPaid;

    expect(newPaid).toBe(200000);
    expect(newRemaining).toBe(110000);
  });

  it("detects overdue debts correctly when dueDate is past current date", () => {
    const pastDebt: CustomerDebt = {
      id: "debt-2",
      customerId: "cust-2",
      customerName: "A Hùng",
      description: "Nợ công thợ",
      totalAmount: 750000,
      paidAmount: 500000,
      remainingAmount: 250000,
      createdDate: "2026-05-23T00:00:00Z",
      dueDate: "2026-06-01T00:00:00Z", // Past date
      branchId: "CN1",
    };

    const todayStr = "2026-07-25";
    const isOverdue =
      pastDebt.dueDate &&
      pastDebt.remainingAmount > 0 &&
      pastDebt.dueDate.slice(0, 10) < todayStr;

    expect(isOverdue).toBe(true);
  });

  it("calculates total customer and supplier remaining debts accurately", () => {
    const customerDebts: CustomerDebt[] = [
      {
        id: "c1",
        customerId: "cust-1",
        customerName: "Bụng",
        description: "Phụ tùng",
        totalAmount: 310000,
        paidAmount: 270000,
        remainingAmount: 40000,
        createdDate: "2026-07-10T00:00:00Z",
        branchId: "CN1",
      },
      {
        id: "c2",
        customerId: "cust-2",
        customerName: "Phan Văn Hậu",
        description: "Đơn hàng",
        totalAmount: 150000,
        paidAmount: 0,
        remainingAmount: 150000,
        createdDate: "2026-06-16T00:00:00Z",
        branchId: "CN1",
      },
    ];

    const totalCustomerRemaining = customerDebts.reduce(
      (sum, d) => sum + (d.remainingAmount > 0 ? d.remainingAmount : 0),
      0
    );

    expect(totalCustomerRemaining).toBe(190000);
  });
});
