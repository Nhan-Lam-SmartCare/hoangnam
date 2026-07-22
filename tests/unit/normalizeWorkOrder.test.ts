/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { normalizeWorkOrder, parseWarrantyMonths, normalizeStatusKey } from "../../src/lib/repository/workOrders/normalize";

describe("normalizeWorkOrder", () => {
  const baseRow = {
    id: "WO-001",
    creationDate: "2024-01-15T10:00:00Z",
    customerName: "Nguyễn Văn A",
    customerPhone: "0909123456",
    vehicleModel: "Wave Alpha",
    licensePlate: "59A-12345",
    currentKm: 15000,
    issueDescription: "Thay nhớt",
    technicianName: "Thợ A",
    status: "Tiếp nhận",
    laborCost: 100000,
    laborTotal: 100000,
    discount: 0,
    partsUsed: [],
    additionalServices: [],
    notes: "",
    total: 200000,
    workerTotal: 50000,
    branchId: "CN1",
    createdBy: "user-1",
    depositAmount: 0,
    depositDate: null,
    depositTransactionId: null,
    paymentStatus: "unpaid",
    paymentMethod: "cash",
    additionalPayment: 0,
    totalPaid: 0,
    remainingAmount: 200000,
    paymentDate: null,
    cashTransactionId: null,
    refunded: false,
    refunded_at: null,
    refund_transaction_id: null,
    refund_reason: null,
    inventoryDeducted: false,
  };

  it("should normalize camelCase row correctly", () => {
    const result = normalizeWorkOrder(baseRow);
    expect(result.id).toBe("WO-001");
    expect(result.creationDate).toBe("2024-01-15T10:00:00Z");
    expect(result.customerName).toBe("Nguyễn Văn A");
    expect(result.technicianName).toBe("Thợ A");
    expect(result.status).toBe("Tiếp nhận");
    expect(result.laborCost).toBe(100000);
    expect(result.total).toBe(200000);
    expect(result.branchId).toBe("CN1");
    expect(result.createdBy).toBe("user-1");
    expect(result.paymentStatus).toBe("unpaid");
    expect(result.inventoryDeducted).toBe(false);
    expect(result.refunded).toBe(false);
  });

  it("should normalize snake_case row", () => {
    const snakeRow: Record<string, any> = {};
    for (const [key, val] of Object.entries(baseRow)) {
      const snakeKey = key.replace(/([A-Z])/g, "_$1").toLowerCase();
      snakeRow[snakeKey] = val;
    }
    // Override with snake_case all fields (normalize looks for lowercase-run-together keys)
    snakeRow.creationdate = "2024-06-01T08:00:00Z";
    snakeRow.customername = "Trần Thị B";
    snakeRow.customerphone = "0918111222";
    snakeRow.vehiclemodel = "SH Mode";
    snakeRow.licenseplate = "59B-67890";
    snakeRow.currentkm = 5000;
    snakeRow.issuedescription = "Bảo dưỡng định kỳ";
    snakeRow.technicianname = "Thợ B";
    snakeRow.laborcost = 200000;
    snakeRow.labor_total = 200000;
    snakeRow.partsused = [];
    snakeRow.additionalservices = [];
    snakeRow.worker_total = 80000;
    snakeRow.branchid = "CN2";
    snakeRow.created_by = "user-2";
    snakeRow.depositamount = 100000;
    snakeRow.depositdate = "2024-06-01T07:00:00Z";
    snakeRow.deposittransactionid = null;
    snakeRow.paymentstatus = "partial";
    snakeRow.paymentmethod = "bank";
    snakeRow.additionalpayment = 0;
    snakeRow.totalpaid = 100000;
    snakeRow.remainingamount = 100000;
    snakeRow.paymentdate = null;
    snakeRow.cashtransactionid = null;
    snakeRow.refunded = false;
    snakeRow.refunded_at = null;
    snakeRow.refund_transaction_id = null;
    snakeRow.refund_reason = null;
    snakeRow.inventory_deducted = false;

    const result = normalizeWorkOrder(snakeRow);
    expect(result.creationDate).toBe("2024-06-01T08:00:00Z");
    expect(result.customerName).toBe("Trần Thị B");
    expect(result.customerPhone).toBe("0918111222");
    expect(result.vehicleModel).toBe("SH Mode");
    expect(result.licensePlate).toBe("59B-67890");
    expect(result.currentKm).toBe(5000);
    expect(result.issueDescription).toBe("Bảo dưỡng định kỳ");
    expect(result.technicianName).toBe("Thợ B");
    expect(result.laborCost).toBe(200000);
    expect(result.laborTotal).toBe(200000);
    expect(result.workerTotal).toBe(80000);
    expect(result.branchId).toBe("CN2");
    expect(result.createdBy).toBe("user-2");
    expect(result.depositAmount).toBe(100000);
    expect(result.paymentStatus).toBe("partial");
    expect(result.paymentMethod).toBe("bank");
    expect(result.totalPaid).toBe(100000);
    expect(result.remainingAmount).toBe(100000);
    expect(result.inventoryDeducted).toBe(false);
  });

  it("should normalize all-lowercase row (worst-case DB schema)", () => {
    const lowerRow: Record<string, any> = {};
    for (const [key, val] of Object.entries(baseRow)) {
      lowerRow[key.toLowerCase()] = val;
    }
    lowerRow.creationdate = "2024-03-20T14:30:00Z";
    lowerRow.customername = "Phạm Văn C";
    lowerRow.customerphone = "0933222111";
    lowerRow.vehiclemodel = "Exciter 150";
    lowerRow.licenseplate = "59C-11111";
    lowerRow.currentkm = 25000;
    lowerRow.issuedescription = "Sửa phanh";
    lowerRow.technicianname = "Thợ C";
    lowerRow.laborcost = 150000;
    lowerRow.partsused = [];
    lowerRow.additionalservices = [];
    lowerRow.worker_total = 60000;
    lowerRow.branchid = "CN3";
    lowerRow.createdby = "user-3";
    lowerRow.depositamount = 50000;
    lowerRow.depositdate = "2024-03-20T10:00:00Z";
    lowerRow.deposittransactionid = null;
    lowerRow.paymentstatus = "unpaid";
    lowerRow.paymentmethod = "cash";
    lowerRow.additionalpayment = 0;
    lowerRow.totalpaid = 50000;
    lowerRow.remainingamount = 200000;
    lowerRow.paymentdate = null;
    lowerRow.cashtransactionid = null;
    lowerRow.inventorydeducted = false;

    const result = normalizeWorkOrder(lowerRow);
    expect(result.creationDate).toBe("2024-03-20T14:30:00Z");
    expect(result.customerName).toBe("Phạm Văn C");
    expect(result.vehicleModel).toBe("Exciter 150");
    expect(result.licensePlate).toBe("59C-11111");
    expect(result.currentKm).toBe(25000);
    expect(result.issueDescription).toBe("Sửa phanh");
    expect(result.technicianName).toBe("Thợ C");
    expect(result.laborCost).toBe(150000);
    expect(result.workerTotal).toBe(60000);
    expect(result.branchId).toBe("CN3");
    expect(result.createdBy).toBe("user-3");
    expect(result.depositAmount).toBe(50000);
    expect(result.paymentStatus).toBe("unpaid");
    expect(result.totalPaid).toBe(50000);
    expect(result.remainingAmount).toBe(200000);
    expect(result.inventoryDeducted).toBe(false);
  });

  it("should prefer all-lowercase over camelCase when both are present", () => {
    const mixedRow = {
      ...baseRow,
      creationDate: "2024-01-01T00:00:00Z",
      creationdate: "2024-06-06T00:00:00Z",
      customerName: "CamelCase Name",
      customername: "lowercase name",
    };
    const result = normalizeWorkOrder(mixedRow);
    // normalize picks row.creationdate (lowercase) first (|| short-circuits on truthy)
    expect(result.creationDate).toBe("2024-06-06T00:00:00Z");
    // same for customerName: customername is truthy → used
    expect(result.customerName).toBe("lowercase name");
  });

  it("should handle createdBy with all three casing variants", () => {
    const onlyCreatedBy = normalizeWorkOrder({ ...baseRow, createdBy: "user-a", created_by: undefined, createdby: undefined });
    const onlyCreatedByUnderscore = normalizeWorkOrder({ ...baseRow, createdBy: undefined, created_by: "user-b", createdby: undefined });
    const onlyCreatedby = normalizeWorkOrder({ ...baseRow, createdBy: undefined, created_by: undefined, createdby: "user-c" });

    expect(onlyCreatedBy.createdBy).toBe("user-a");
    expect(onlyCreatedByUnderscore.createdBy).toBe("user-b");
    expect(onlyCreatedby.createdBy).toBe("user-c");
  });

  it("should normalize refunded from status", () => {
    const cancelledRow = { ...baseRow, status: "Đã hủy" };
    const cancelledRow2 = { ...baseRow, status: "Da huy" };

    expect(normalizeWorkOrder(cancelledRow).refunded).toBe(true);
    expect(normalizeWorkOrder(cancelledRow2).refunded).toBe(true);
  });

  it("should handle null/undefined row gracefully", () => {
    const nullResult = normalizeWorkOrder(null);
    expect(nullResult).toBeDefined();
    expect(nullResult.id).toBeUndefined();
    expect(nullResult.status).toBeUndefined();
    expect(nullResult.createdBy).toBeNull();

    const undefResult = normalizeWorkOrder(undefined);
    expect(undefResult).toBeDefined();
    expect(undefResult.id).toBeUndefined();
  });

  it("should handle inventory_deducted and inventoryDeducted", () => {
    const withDeducted = normalizeWorkOrder({ ...baseRow, inventory_deducted: true, inventoryDeducted: true });
    expect(withDeducted.inventoryDeducted).toBe(true);

    const withoutDeducted = normalizeWorkOrder({ ...baseRow, inventory_deducted: false, inventoryDeducted: false });
    expect(withoutDeducted.inventoryDeducted).toBe(false);

    const onlyUnderscore = normalizeWorkOrder({ ...baseRow, inventory_deducted: true, inventoryDeducted: false });
    expect(onlyUnderscore.inventoryDeducted).toBe(true);
  });

  it("should preserve deprecated fields for backward compat", () => {
    const row = { ...baseRow, created_by: "dep-user", createdBy: "canon-user", createdby: "legacy-user" };
    const result = normalizeWorkOrder(row);
    expect(result.createdBy).toBe("canon-user");
    expect(result.created_by).toBeTruthy();
    expect(result.createdby).toBeTruthy();
  });
});

describe("parseWarrantyMonths", () => {
  it("should parse numeric months", () => {
    expect(parseWarrantyMonths("6")).toBe(6);
    expect(parseWarrantyMonths(12)).toBe(12);
  });

  it("should parse years into months", () => {
    expect(parseWarrantyMonths("2 năm")).toBe(24);
    expect(parseWarrantyMonths("1 nam")).toBe(12);
    expect(parseWarrantyMonths("3 year")).toBe(36);
  });

  it("should return 0 for invalid input", () => {
    expect(parseWarrantyMonths("")).toBe(0);
    expect(parseWarrantyMonths(null)).toBe(0);
    expect(parseWarrantyMonths(undefined)).toBe(0);
    expect(parseWarrantyMonths("không")).toBe(0);
  });
});

describe("normalizeStatusKey", () => {
  it("should remove combining diacritics and lowercase", () => {
    // NFD strips accents (á→a, ả→a, ã→a) but not Đ→D; toLowerCase() turns Đ→đ
    expect(normalizeStatusKey("Đã hủy")).toBe("đa huy");
    expect(normalizeStatusKey("Đã sửa xong")).toBe("đa sua xong");
    expect(normalizeStatusKey("Trả máy")).toBe("tra may");
    expect(normalizeStatusKey("Tiếp nhận")).toBe("tiep nhan");
  });

  it("should handle non-string input", () => {
    expect(normalizeStatusKey(null)).toBe("");
    expect(normalizeStatusKey(undefined)).toBe("");
    expect(normalizeStatusKey(123)).toBe("123");
  });
});
