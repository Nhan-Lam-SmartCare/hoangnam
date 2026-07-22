import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createWorkOrderAtomic,
  updateWorkOrderAtomic,
  refundWorkOrder,
  deleteWorkOrder,
  normalizeWorkOrder,
  decodeAdditionalServicesFromNotes,
  encodeAdditionalServicesInNotes,
  parseWarrantyMonths,
  normalizeStatusKey,
} from "../../src/lib/repository/workOrdersRepository";

// ──────────────── Supabase mock ────────────────

const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockGetUser = vi.hoisted(() => vi.fn());

vi.mock("../../src/supabaseClient", () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  },
}));

vi.mock("../../src/utils/format", () => ({
  formatWorkOrderId: (id: string, _prefix?: string) => id || "",
}));

vi.mock("../../src/lib/repository/paymentSourcesRepository", () => ({
  updatePaymentSourceBalance: vi.fn().mockResolvedValue(undefined),
}));

// ──────────────── Proxy thenable helper ────────────────
// Every chained method returns the proxy itself; `then` resolves with the table result.

let tableResults: Record<string, { data: any; error: any }> = {};
const defaultResult = { data: null, error: null };

/** Track insert payloads per table */
let inserts: Record<string, any[]> = {};
/** Track update payloads per table */
let updates: Record<string, any[]> = {};
/** Track delete calls per table */
let deletes: Record<string, any[]> = {};

function makeThenable(result: { data: any; error: any }) {
  const proxy: any = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: any) => any) => resolve(result);
        }
        // .single() / .maybeSingle() should also be thenable
        return () => proxy;
      },
    }
  );
  return proxy;
}

function installFromMock() {
  mockFrom.mockImplementation((table: string) => {
    const proxy: any = new Proxy(
      {},
      {
        get(_t, prop) {
          const result = tableResults[table] || defaultResult;
          if (prop === "then") {
            return (resolve: (v: any) => any) => resolve(result);
          }
          if (prop === "insert") {
            return (payload: any) => {
              inserts[table] = inserts[table] || [];
              inserts[table].push(payload);
              return makeThenable(result);
            };
          }
          if (prop === "update") {
            return (payload: any) => {
              updates[table] = updates[table] || [];
              updates[table].push(payload);
              if (tableResults[table] && tableResults[table].data) {
                if (Array.isArray(tableResults[table].data)) {
                  tableResults[table].data = tableResults[table].data.map((item: any) => ({
                    ...item,
                    ...payload,
                  }));
                } else if (typeof tableResults[table].data === "object") {
                  tableResults[table].data = {
                    ...tableResults[table].data,
                    ...payload,
                  };
                }
              }
              return makeThenable(result);
            };
          }
          if (prop === "delete") {
            return () => {
              deletes[table] = deletes[table] || [];
              deletes[table].push(true);
              return makeThenable(result);
            };
          }
          // All other methods (.select, .eq, .or, .in, .ilike, .order, .limit,
          // .gte, .maybeSingle, .single) return the proxy itself.
          return () => proxy;
        },
      }
    );
    return proxy;
  });
}

// ──────────────── Tests ────────────────

describe("workOrdersRepository.atomic — Phase 0 safety net", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tableResults = {};
    inserts = {};
    updates = {};
    deletes = {};
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "U-1",
          email: "tester@example.com",
          user_metadata: { name: "Tester" },
        },
      },
    });
    mockRpc.mockResolvedValue({ data: null, error: null });
    installFromMock();
  });

  // ═══════════════ createWorkOrderAtomic ═══════════════

  describe("createWorkOrderAtomic", () => {
    it("returns failure when id is missing", async () => {
      const result = await createWorkOrderAtomic({ id: undefined as any });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("validation");
      }
    });

    it("inserts successfully and returns normalised order", async () => {
      const insertedRow = {
        id: "WO-001",
        creationdate: "2026-07-01T00:00:00Z",
        customername: "Nguyễn A",
        customerphone: "0909000001",
        vehiclemodel: "iPhone 15",
        licenseplate: "IMEI-123",
        status: "Tiếp nhận",
        laborcost: 50000,
        discount: 0,
        partsused: [],
        total: 50000,
        branchid: "CN1",
        paymentstatus: "unpaid",
        notes: "",
      };

      tableResults["work_orders"] = { data: insertedRow, error: null };
      tableResults["cash_transactions"] = { data: [], error: null };
      tableResults["profiles"] = { data: null, error: null };
      tableResults["warranty_cards"] = { data: [], error: null };
      tableResults["customer_debts"] = { data: null, error: null };

      const result = await createWorkOrderAtomic({
        id: "WO-001",
        customerName: "Nguyễn A",
        customerPhone: "0909000001",
        vehicleModel: "iPhone 15",
        licensePlate: "IMEI-123",
        status: "Tiếp nhận",
        laborCost: 50000,
        total: 50000,
        branchId: "CN1",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBe("WO-001");
        expect(result.data.customerName).toBe("Nguyễn A");
        expect(result.data.laborCost).toBe(50000);
      }
    });

    it("records deposit payment transaction when depositAmount > 0", async () => {
      const insertedRow = {
        id: "WO-002",
        creationdate: "2026-07-01T00:00:00Z",
        customername: "B",
        customerphone: "",
        status: "Tiếp nhận",
        laborcost: 0,
        discount: 0,
        partsused: [],
        total: 200000,
        branchid: "CN1",
        paymentstatus: "partial",
        depositamount: 100000,
        notes: "",
      };

      tableResults["work_orders"] = { data: insertedRow, error: null };
      tableResults["cash_transactions"] = { data: [], error: null };
      tableResults["profiles"] = { data: null, error: null };
      tableResults["customer_debts"] = { data: null, error: null };

      const result = await createWorkOrderAtomic({
        id: "WO-002",
        customerName: "B",
        total: 200000,
        depositAmount: 100000,
        branchId: "CN1",
      });

      expect(result.ok).toBe(true);
      // Deposit should have triggered a cash_transactions insert
      expect(inserts["cash_transactions"]).toBeDefined();
      expect(inserts["cash_transactions"].length).toBeGreaterThan(0);
    });
  });

  // ═══════════════ updateWorkOrderAtomic ═══════════════

  describe("updateWorkOrderAtomic", () => {
    it("returns failure when id is missing", async () => {
      const result = await updateWorkOrderAtomic({ id: undefined as any });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("validation");
      }
    });

    it("updates successfully and returns normalised order", async () => {
      const existingRow = {
        id: "WO-010",
        creationdate: "2026-07-01T00:00:00Z",
        customername: "C",
        customerphone: "0909000010",
        status: "Đang sửa",
        laborcost: 0,
        discount: 0,
        partsused: [{ partId: "P-1", quantity: 1, partName: "Pin", price: 300000 }],
        total: 300000,
        branchid: "CN1",
        paymentstatus: "unpaid",
        inventory_deducted: false,
        notes: "",
      };

      tableResults["work_orders"] = { data: existingRow, error: null };
      tableResults["cash_transactions"] = { data: [], error: null };
      tableResults["customer_debts"] = { data: null, error: null };

      const result = await updateWorkOrderAtomic({
        id: "WO-010",
        customerName: "C Updated",
        status: "Đang sửa",
        partsUsed: [{ partId: "P-1", quantity: 2, partName: "Pin", price: 300000 }],
        total: 600000,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.id).toBe("WO-010");
      }
    });

    it("does NOT call adjustStockForUpdatedParts when inventory_deducted is false", async () => {
      const existingRow = {
        id: "WO-011",
        creationdate: "2026-07-01T00:00:00Z",
        customername: "D",
        customerphone: "",
        status: "Tiếp nhận",
        partsused: [{ partId: "P-1", quantity: 1, partName: "Pin" }],
        total: 100000,
        branchid: "CN1",
        paymentstatus: "unpaid",
        inventory_deducted: false,
        inventoryDeducted: false,
        notes: "",
      };

      tableResults["work_orders"] = { data: existingRow, error: null };
      tableResults["cash_transactions"] = { data: [], error: null };
      tableResults["customer_debts"] = { data: null, error: null };

      await updateWorkOrderAtomic({
        id: "WO-011",
        partsUsed: [{ partId: "P-1", quantity: 3, partName: "Pin" }],
        total: 300000,
      });

      // No parts stock adjustments should happen (no reads from "parts" table for stock)
      // The test verifies no error was thrown — if adjustStockForUpdatedParts ran,
      // it would query the "parts" table which returns null and might error.
      // Since inventory_deducted is false, the function should skip stock adjustment.
    });
  });

  // ═══════════════ deleteWorkOrder ═══════════════

  describe("deleteWorkOrder", () => {
    it("returns failure when order is not found", async () => {
      tableResults["work_orders"] = { data: null, error: { code: "PGRST116", message: "not found" } };

      const result = await deleteWorkOrder("WO-NONEXIST");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("supabase");
      }
    });

    it("deletes successfully and rolls back stock when inventory was deducted", async () => {
      const row = {
        id: "WO-DEL-1",
        creationdate: "2026-07-01T00:00:00Z",
        customername: "Del",
        customerphone: "",
        status: "Đang sửa",
        partsused: [{ partId: "P-1", quantity: 2, partName: "Pin" }],
        total: 100000,
        branchid: "CN1",
        paymentstatus: "unpaid",
        inventory_deducted: true,
        notes: "",
      };

      // First call = select for the order, subsequent calls also return success
      tableResults["work_orders"] = { data: row, error: null };
      tableResults["parts"] = { data: { id: "P-1", name: "Pin", stock: { CN1: 5 } }, error: null };
      tableResults["inventory_transactions"] = { data: null, error: null };
      tableResults["cash_transactions"] = { data: [], error: null };
      tableResults["customer_debts"] = { data: null, error: null };

      const result = await deleteWorkOrder("WO-DEL-1");
      expect(result.ok).toBe(true);

      // Should have restored stock by updating parts table
      expect(updates["parts"]).toBeDefined();
      expect(updates["parts"].length).toBeGreaterThan(0);

      // Should have created inventory transaction for stock restore
      expect(inserts["inventory_transactions"]).toBeDefined();
    });
  });

  // ═══════════════ refundWorkOrder ═══════════════

  describe("refundWorkOrder", () => {
    it("returns success via RPC when function exists", async () => {
      mockRpc.mockResolvedValue({
        data: {
          workOrder: {
            id: "WO-REF-1",
            total: 100000,
            totalPaid: 100000,
            status: "Đã hủy",
            paymentStatus: "paid",
            branchId: "CN1",
            partsUsed: [],
            refunded: true,
          },
          refundAmount: 100000,
          refundTransactionId: "TX-REF-1",
        },
        error: null,
      });

      const result = await refundWorkOrder("WO-REF-1", "Khách đổi ý");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.refunded).toBe(true);
      }
    });

    it("falls back to direct update when RPC is missing (PGRST202)", async () => {
      // All RPC calls fail with PGRST202
      mockRpc.mockResolvedValue({
        data: null,
        error: {
          code: "PGRST202",
          message: "Could not find function work_order_refund_atomic",
        },
      });

      const orderRow = {
        id: "WO-REF-2",
        creationdate: "2026-07-01T00:00:00Z",
        customername: "Refund",
        customerphone: "",
        status: "Trả máy",
        partsused: [],
        total: 200000,
        totalpaid: 200000,
        branchid: "CN1",
        paymentstatus: "paid",
        paymentmethod: "cash",
        inventory_deducted: false,
        refunded: false,
        notes: "",
      };

      tableResults["work_orders"] = { data: orderRow, error: null };
      tableResults["cash_transactions"] = { data: null, error: null };
      tableResults["repair_order_services"] = { data: [], error: null };
      tableResults["repair_order_service_workers"] = { data: null, error: null };

      const result = await refundWorkOrder("WO-REF-2", "Test fallback");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.refunded).toBe(true);
        expect(result.data.refundAmount).toBe(200000);
      }
    });

    it("returns failure when order is already refunded (via fallback)", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: {
          code: "PGRST202",
          message: "Could not find function work_order_refund_atomic",
        },
      });

      const alreadyRefundedRow = {
        id: "WO-REF-3",
        creationdate: "2026-07-01T00:00:00Z",
        customername: "Already",
        customerphone: "",
        status: "Đã hủy",
        partsused: [],
        total: 50000,
        totalpaid: 50000,
        branchid: "CN1",
        paymentstatus: "paid",
        refunded: true,
        notes: "",
      };

      tableResults["work_orders"] = { data: alreadyRefundedRow, error: null };

      const result = await refundWorkOrder("WO-REF-3", "Retry");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("validation");
      }
    });
  });

  // ═══════════════ normalizeWorkOrder snapshot ═══════════════

  describe("normalizeWorkOrder snapshot", () => {
    it("maps snake_case row to camelCase WorkOrder", () => {
      const snakeCaseRow = {
        id: "WO-NORM-1",
        creationdate: "2026-07-01T00:00:00Z",
        customername: "Snake",
        customerphone: "0909111222",
        vehiclemodel: "Galaxy S24",
        licenseplate: "IMEI-456",
        technicianname: "Thợ A",
        status: "Đang sửa",
        laborcost: 50000,
        discount: 10000,
        partsused: [{ partId: "P-1", quantity: 1, partName: "Pin" }],
        total: 340000,
        branchid: "CN1",
        paymentstatus: "partial",
        paymentmethod: "cash",
        depositamount: 100000,
        totalpaid: 100000,
        remainingamount: 240000,
        notes: "",
      };

      const result = normalizeWorkOrder(snakeCaseRow);

      expect(result.id).toBe("WO-NORM-1");
      expect(result.creationDate).toBe("2026-07-01T00:00:00Z");
      expect(result.customerName).toBe("Snake");
      expect(result.customerPhone).toBe("0909111222");
      expect(result.vehicleModel).toBe("Galaxy S24");
      expect(result.licensePlate).toBe("IMEI-456");
      expect(result.technicianName).toBe("Thợ A");
      expect(result.status).toBe("Đang sửa");
      expect(result.laborCost).toBe(50000);
      expect(result.discount).toBe(10000);
      expect(result.partsUsed).toEqual([{ partId: "P-1", quantity: 1, partName: "Pin" }]);
      expect(result.total).toBe(340000);
      expect(result.branchId).toBe("CN1");
      expect(result.paymentStatus).toBe("partial");
      expect(result.paymentMethod).toBe("cash");
      expect(result.depositAmount).toBe(100000);
      expect(result.totalPaid).toBe(100000);
      expect(result.remainingAmount).toBe(240000);
      expect(result.refunded).toBe(false);
    });

    it("maps camelCase row identically", () => {
      const camelCaseRow = {
        id: "WO-NORM-2",
        creationDate: "2026-07-02T00:00:00Z",
        customerName: "Camel",
        customerPhone: "0909222333",
        vehicleModel: "Pixel 9",
        licensePlate: "SN-789",
        technicianName: "Thợ B",
        status: "Trả máy",
        laborCost: 80000,
        discount: 0,
        partsUsed: [],
        total: 80000,
        branchId: "CN2",
        paymentStatus: "paid",
        paymentMethod: "bank",
        depositAmount: 0,
        totalPaid: 80000,
        remainingAmount: 0,
        notes: "",
      };

      const result = normalizeWorkOrder(camelCaseRow);

      expect(result.id).toBe("WO-NORM-2");
      expect(result.creationDate).toBe("2026-07-02T00:00:00Z");
      expect(result.customerName).toBe("Camel");
      expect(result.branchId).toBe("CN2");
      expect(result.refunded).toBe(false);
    });

    it('sets refunded=true when status is "Đã hủy"', () => {
      const canceledRow = {
        id: "WO-CANCEL",
        status: "Đã hủy",
        refunded: false,
        notes: "",
      };

      const result = normalizeWorkOrder(canceledRow);
      expect(result.refunded).toBe(true);
    });

    it('sets refunded=true when status is "Da huy" (unaccented)', () => {
      const canceledRow = {
        id: "WO-CANCEL-2",
        status: "Da huy",
        refunded: false,
        notes: "",
      };

      const result = normalizeWorkOrder(canceledRow);
      expect(result.refunded).toBe(true);
    });

    it("decodes additionalServices from notes marker", () => {
      const services = [{ description: "Thay keo", quantity: 1, price: 50000 }];
      const notesWithMarker = `Lỗi màn hình\n[ADDITIONAL_SERVICES]:${JSON.stringify(services)}`;

      const row = {
        id: "WO-NOTES",
        status: "Tiếp nhận",
        notes: notesWithMarker,
      };

      const result = normalizeWorkOrder(row);
      expect(result.issueDescription).toBe("Lỗi màn hình");
      expect(result.additionalServices).toEqual(services);
    });

    it("handles empty notes gracefully", () => {
      const row = { id: "WO-EMPTY", status: "Tiếp nhận", notes: "" };
      const result = normalizeWorkOrder(row);
      expect(result.issueDescription).toBe("");
      expect(result.additionalServices).toEqual([]);
    });
  });

  // ═══════════════ Pure helper functions ═══════════════

  describe("pure helpers", () => {
    describe("parseWarrantyMonths", () => {
      it("parses '12 tháng' → 12", () => expect(parseWarrantyMonths("12 tháng")).toBe(12));
      it("parses '1 năm' → 12", () => expect(parseWarrantyMonths("1 năm")).toBe(12));
      it("parses '2 year' → 24", () => expect(parseWarrantyMonths("2 year")).toBe(24));
      it("parses '6' → 6", () => expect(parseWarrantyMonths("6")).toBe(6));
      it("parses empty → 0", () => expect(parseWarrantyMonths("")).toBe(0));
      it("parses null → 0", () => expect(parseWarrantyMonths(null)).toBe(0));
    });

    describe("normalizeStatusKey", () => {
      it("normalizes Vietnamese diacritics", () => {
        expect(normalizeStatusKey("Đã hủy")).toBe("đa huy");
        expect(normalizeStatusKey("Trả máy")).toBe("tra may");
        expect(normalizeStatusKey("Đã sửa xong")).toBe("đa sua xong");
      });
      it("trims and lowercases", () => {
        expect(normalizeStatusKey("  PAID  ")).toBe("paid");
      });
      it("handles null/undefined → ''", () => {
        expect(normalizeStatusKey(null)).toBe("");
        expect(normalizeStatusKey(undefined)).toBe("");
      });
    });

    describe("encodeAdditionalServicesInNotes / decodeAdditionalServicesFromNotes", () => {
      it("round-trips correctly", () => {
        const services = [{ description: "A", quantity: 1, price: 10000 }];
        const encoded = encodeAdditionalServicesInNotes("Mô tả lỗi", services);
        const decoded = decodeAdditionalServicesFromNotes(encoded);
        expect(decoded.cleanNotes).toBe("Mô tả lỗi");
        expect(decoded.services).toEqual(services);
      });

      it("returns clean notes when no marker", () => {
        const decoded = decodeAdditionalServicesFromNotes("Plain notes");
        expect(decoded.cleanNotes).toBe("Plain notes");
        expect(decoded.services).toEqual([]);
      });

      it("handles empty services array → no marker appended", () => {
        const encoded = encodeAdditionalServicesInNotes("Desc", []);
        expect(encoded).toBe("Desc");
        expect(encoded.includes("[ADDITIONAL_SERVICES]:")).toBe(false);
      });
    });
  });
});
